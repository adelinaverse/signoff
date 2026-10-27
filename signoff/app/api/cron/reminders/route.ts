import { NextResponse, type NextRequest } from 'next/server';
import { digestHtml, sendEmail, SITE_URL } from '@/lib/email';
import { createServiceClient } from '@/lib/supabase/server';

/** Daily: remind approvers about posts that have waited longer than REMINDER_DAYS. Called by Vercel Cron. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Not allowed', { status: 401 });
  }

  const days = Number(process.env.REMINDER_DAYS || 3);
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const supabase = createServiceClient();

  const { data: waiting } = await supabase.from('posts').select('workspace_id, title, sent_at, workspace:workspaces(name)')
    .eq('status', 'ready').lt('sent_at', cutoff)
    .returns<{ workspace_id: string; title: string; sent_at: string; workspace: { name: string } | null }[]>();

  const byWs = new Map<string, { name: string; titles: string[] }>();
  for (const p of waiting ?? []) {
    const entry = byWs.get(p.workspace_id) ?? { name: p.workspace?.name ?? '', titles: [] };
    entry.titles.push(p.title);
    byWs.set(p.workspace_id, entry);
  }

  const results: { workspace: string; sent: boolean }[] = [];
  for (const [wsId, { name, titles }] of byWs) {
    const { data: members } = await supabase.from('workspace_members').select('profile:profiles(email)')
      .eq('workspace_id', wsId).eq('role', 'approver').returns<{ profile: { email: string } | null }[]>();
    const to = (members ?? []).map((m) => m.profile?.email).filter((e): e is string => Boolean(e));
    const n = titles.length;
    const mail = await sendEmail(
      to,
      `Reminder: ${n} post${n === 1 ? '' : 's'} still waiting for your approval`,
      digestHtml({
        intro: `${n === 1 ? 'This post has' : 'These posts have'} been waiting more than ${days} days for ${name}. A quick look keeps the schedule on track.`,
        items: titles,
        buttonLabel: 'Review posts',
        buttonUrl: `${SITE_URL}/w/${wsId}/review`,
      }),
    );
    results.push({ workspace: name, sent: mail.sent });
  }

  return NextResponse.json({ checked: waiting?.length ?? 0, reminders: results });
}
