import JSZip from 'jszip';
import { NextResponse } from 'next/server';
import { PLATFORM_INFO } from '@/lib/platforms';
import { createClient } from '@/lib/supabase/server';
import { formatPlanned } from '@/lib/time';
import type { MediaItem, PlatformVersion, Post } from '@/lib/types';

/** A zip of the approved media in order, plus each platform's caption, ready to schedule by hand. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_agency_admin');
  if (!isAdmin) return new NextResponse('Not allowed', { status: 403 });

  const { data: post } = await supabase.from('posts').select('*, workspace:workspaces(name, timezone)').eq('id', id)
    .maybeSingle<Post & { workspace: { name: string; timezone: string } }>();
  if (!post) return new NextResponse('Not found', { status: 404 });

  const [{ data: media }, { data: pvs }] = await Promise.all([
    supabase.from('media_items').select('*').eq('post_id', id).order('position').returns<MediaItem[]>(),
    supabase.from('platform_versions').select('*').eq('post_id', id).returns<PlatformVersion[]>(),
  ]);

  const zip = new JSZip();
  for (const [i, m] of (media ?? []).entries()) {
    const { data: blob, error } = await supabase.storage.from('media').download(m.storage_path);
    if (error || !blob) continue;
    const ext = m.storage_path.split('.').pop();
    zip.file(`${String(i + 1).padStart(2, '0')}.${ext}`, await blob.arrayBuffer());
  }

  const header = `${post.title}\nPlanned for ${formatPlanned(post.planned_at, post.workspace.timezone)} (${post.workspace.timezone})\n`;
  for (const pv of pvs ?? []) {
    const name = PLATFORM_INFO[pv.platform].name;
    zip.file(`caption-${pv.platform}.txt`, `${header}${name}${pv.is_reel ? ' Reel' : ''}\n\n${pv.caption}\n`);
  }

  const body = await zip.generateAsync({ type: 'uint8array' });
  const slug = `${post.workspace.name}-${post.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return new NextResponse(Buffer.from(body), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${slug || 'post'}.zip"`,
    },
  });
}
