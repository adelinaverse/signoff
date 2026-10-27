import Link from 'next/link';
import { CopyLink } from '@/components/copy-link';
import { PostThumb } from '@/components/post-thumb';
import { StatusStamp } from '@/components/status-stamp';
import { createPost } from '@/lib/actions';
import { loadBoardPosts } from '@/lib/board';
import { getWorkspaceContext } from '@/lib/data';
import { mediaSummary, PLATFORM_INFO } from '@/lib/platforms';
import { STATUS_ORDER, statusLabel } from '@/lib/status';
import { formatPlanned } from '@/lib/time';
import { EmailApproversButton } from './email-approvers';

export default async function BoardPage({ params, searchParams }: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const { ws } = await params;
  const { show } = await searchParams;
  const { supabase, workspace, role } = await getWorkspaceContext(ws);
  const posts = await loadBoardPosts(supabase, ws);
  const isAdmin = role === 'admin';

  const waiting = posts.filter((p) => p.status === 'ready');
  const showDone = show === 'all';
  const doneStatuses = ['published', 'rejected'];
  const hiddenCount = posts.filter((p) => doneStatuses.includes(p.status)).length;
  const groups = STATUS_ORDER
    .filter((s) => showDone || !doneStatuses.includes(s))
    .map((status) => ({ status, items: posts.filter((p) => p.status === status) }))
    .filter((g) => g.items.length > 0);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold tracking-tight">Posts</h1>
        {isAdmin && waiting.length > 0 && (
          <CopyLink path={`/w/${ws}/review`} label={`Copy review link (${waiting.length} waiting)`} className="btn btn-quiet" />
        )}
        {isAdmin && waiting.length > 0 && <EmailApproversButton workspaceId={ws} count={waiting.length} />}
        {isAdmin && (
          <form action={createPost.bind(null, ws)}>
            <button className="btn btn-primary">New post</button>
          </form>
        )}
      </div>

      {role === 'approver' && waiting.length > 0 && (
        <div className="mt-6 flex flex-col gap-4 rounded-lg border-2 border-cobalt bg-surface p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-lg font-semibold">
              {waiting.length === 1 ? 'One post is' : `${waiting.length} posts are`} waiting for your approval
            </p>
            <p className="text-sm text-muted">Go through them one at a time. Each takes a minute or two.</p>
          </div>
          <Link href={`/w/${ws}/review`} className="btn btn-primary">Start reviewing</Link>
        </div>
      )}

      {posts.length === 0 && (
        <div className="mt-10 rounded-lg border border-dashed border-line-strong p-10 text-center">
          <p className="font-semibold">{isAdmin ? `No posts for ${workspace.name} yet` : 'Nothing to review yet'}</p>
          <p className="mt-1 text-sm text-muted">
            {isAdmin ? 'Create a post, add the imagery and captions, then send it for approval.' : 'Posts will appear here when they are ready for you.'}
          </p>
        </div>
      )}

      <div className="mt-8 space-y-8">
        {groups.map((g) => (
          <section key={g.status} aria-labelledby={`h-${g.status}`}>
            <h2 id={`h-${g.status}`} className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
              {statusLabel(g.status, role)} <span className="font-normal text-muted">{g.items.length}</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {g.items.map((p) => {
                const reel = p.platform_versions.some((v) => v.is_reel);
                return (
                  <li key={p.id}>
                    <Link href={`/w/${ws}/posts/${p.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-paper/60">
                      <PostThumb url={p.thumbUrl} kind={p.media_items[0]?.kind} count={p.media_items.length} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{p.title}</span>
                        <span className="flex flex-wrap gap-x-4 text-sm text-muted">
                          <span>{formatPlanned(p.planned_at, workspace.timezone)}</span>
                          <span>{p.platform_versions.map((v) => PLATFORM_INFO[v.platform].name).join(', ') || 'No platforms yet'}</span>
                          <span>{mediaSummary(p.media_items, reel)}</span>
                        </span>
                      </span>
                      <span className="hidden sm:block"><StatusStamp status={p.status} role={role} /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {hiddenCount > 0 && (
        <p className="mt-6 text-sm">
          <Link href={showDone ? `/w/${ws}` : `/w/${ws}?show=all`} className="text-muted underline underline-offset-2 hover:text-ink">
            {showDone ? 'Hide published and rejected posts' : `Show ${hiddenCount} published and rejected`}
          </Link>
        </p>
      )}
    </main>
  );
}
