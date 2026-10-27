import { notFound } from 'next/navigation';
import type { VersionView } from '@/components/version-history';
import { getWorkspaceContext, loadPost, signUrls } from '@/lib/data';
import { formatPlanned, utcToLocalInput } from '@/lib/time';
import { PostEditor } from './post-editor';
import { PostReview } from './post-review';

export async function generateMetadata({ params }: { params: Promise<{ ws: string; post: string }> }) {
  const { ws, post } = await params;
  const { supabase } = await getWorkspaceContext(ws);
  const { data } = await supabase.from('posts').select('title').eq('id', post).maybeSingle();
  return { title: data?.title ?? 'Post' };
}

export default async function PostPage({ params, searchParams }: {
  params: Promise<{ ws: string; post: string }>;
  searchParams: Promise<{ view?: string; queue?: string }>;
}) {
  const { ws, post: postId } = await params;
  const { view, queue } = await searchParams;
  const { supabase, workspace, role, user, logoUrl } = await getWorkspaceContext(ws);
  const data = await loadPost(supabase, postId);
  if (data.post.workspace_id !== ws) notFound();

  // Sign media for every version sent, so earlier versions stay viewable
  const urls = await signUrls(supabase, data.versions.flatMap((v) => v.snapshot.media.map((m) => m.storage_path)));
  const versions: VersionView[] = data.versions.map((v) => ({
    version: v.version,
    sent_at: v.sent_at,
    media: v.snapshot.media.map((m) => ({ kind: m.kind, storage_path: m.storage_path, url: urls[m.storage_path] ?? '' })),
    platforms: v.snapshot.platforms,
  }));
  const ws_ = { id: workspace.id, name: workspace.name, timezone: workspace.timezone };

  if (role === 'admin' && view !== 'client') {
    const [{ data: members }, { data: invites }] = await Promise.all([
      supabase.from('workspace_members').select('profile:profiles(email)').eq('workspace_id', ws).eq('role', 'approver')
        .returns<{ profile: { email: string } | null }[]>(),
      supabase.from('workspace_invites').select('email').eq('workspace_id', ws).eq('role', 'approver'),
    ]);
    const approvers = [
      ...(members ?? []).map((m) => m.profile?.email).filter((e): e is string => Boolean(e)),
      ...(invites ?? []).map((i) => i.email),
    ];
    return (
      <PostEditor data={data} versions={versions} workspace={ws_} logoUrl={logoUrl} userId={user.id}
        plannedLocal={utcToLocalInput(data.post.planned_at, workspace.timezone)} approvers={approvers} />
    );
  }

  let queueInfo = null;
  if (queue) {
    const { data: ready } = await supabase.from('posts').select('id').eq('workspace_id', ws).eq('status', 'ready')
      .order('planned_at', { ascending: true, nullsFirst: false }).order('created_at');
    const ids = (ready ?? []).map((r) => r.id);
    const i = ids.indexOf(postId);
    if (i >= 0) queueInfo = { position: i + 1, total: ids.length, nextId: ids[i + 1] ?? null };
  }

  return (
    <PostReview data={data} versions={versions} workspace={ws_} logoUrl={logoUrl} role={role} userId={user.id}
      plannedText={`Planned for ${formatPlanned(data.post.planned_at, workspace.timezone)}`}
      queue={queueInfo} previewing={role === 'admin'} />
  );
}
