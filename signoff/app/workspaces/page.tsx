import Link from 'next/link';
import { AppHeader } from '@/components/app-header';
import { createWorkspace } from '@/lib/actions';
import { getSession, signUrls } from '@/lib/data';
import type { PostStatus, Workspace } from '@/lib/types';

export const metadata = { title: 'Clients' };

export default async function WorkspacesPage() {
  const { supabase, user, isAdmin } = await getSession();
  const [{ data: workspaces }, { data: posts }] = await Promise.all([
    supabase.from('workspaces').select('*').order('name').returns<Workspace[]>(),
    supabase.from('posts').select('workspace_id, status').in('status', ['ready', 'changes_requested', 'approved'])
      .returns<{ workspace_id: string; status: PostStatus }[]>(),
  ]);
  const logos = await signUrls(supabase, (workspaces ?? []).map((w) => w.logo_path ?? ''));
  const count = (ws: string, s: PostStatus) => (posts ?? []).filter((p) => p.workspace_id === ws && p.status === s).length;

  return (
    <>
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">{isAdmin ? 'Clients' : 'Your workspaces'}</h1>

        {(workspaces ?? []).length === 0 ? (
          <p className="mt-4 text-muted">Add your first client below to start sending posts for approval.</p>
        ) : (
          <ul className="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {(workspaces ?? []).map((w) => {
              const ready = count(w.id, 'ready');
              const changes = count(w.id, 'changes_requested');
              const approved = count(w.id, 'approved');
              return (
                <li key={w.id}>
                  <Link href={`/w/${w.id}`} className="flex items-center gap-4 px-4 py-4 hover:bg-paper/60">
                    {w.logo_path && logos[w.logo_path] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logos[w.logo_path]} alt="" className="h-10 w-10 rounded object-contain" />
                    ) : (
                      <span className="grid h-10 w-10 place-items-center rounded bg-ink font-bold text-white">{w.name.slice(0, 1)}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{w.name}</span>
                      <span className="block text-sm text-muted">
                        {[
                          ready && `${ready} waiting for approval`,
                          changes && `${changes} with changes requested`,
                          approved && `${approved} approved, not yet scheduled`,
                        ].filter(Boolean).join(', ') || 'Nothing waiting'}
                      </span>
                    </span>
                    {changes > 0 && isAdmin && <span className="stamp text-amber">{changes} to revise</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {isAdmin && (
          <form action={createWorkspace} className="mt-10 rounded-lg border border-line bg-surface p-5">
            <label htmlFor="name" className="label">Add a client</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="name" name="name" required placeholder="Business name" className="field" />
              <button className="btn btn-primary">Create workspace</button>
            </div>
            <p className="hint mt-2">You&apos;ll set their logo, timezone and approver next.</p>
          </form>
        )}
      </main>
    </>
  );
}
