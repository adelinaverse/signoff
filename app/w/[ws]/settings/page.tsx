import { redirect } from 'next/navigation';
import { ActionForm } from '@/components/action-form';
import { cancelInvite, inviteMember, removeMember, resetAccessLink, updateMyName, updateWorkspace } from '@/lib/actions';
import { CopyLink } from '@/components/copy-link';
import { directPath, ensureAccessLinks } from '@/lib/access-links';
import { getWorkspaceContext } from '@/lib/data';
import { TIMEZONES } from '@/lib/time';
import { LogoUpload } from './logo-upload';

export const metadata = { title: 'Settings' };

export default async function SettingsPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const { supabase, workspace, logoUrl, role, user } = await getWorkspaceContext(ws);
  if (role !== 'admin') redirect(`/w/${ws}`);

  const [{ data: members }, { data: invites }, { data: me }] = await Promise.all([
    supabase.from('workspace_members').select('user_id, role, profile:profiles(email, full_name)').eq('workspace_id', ws)
      .returns<{ user_id: string; role: string; profile: { email: string; full_name: string | null } | null }[]>(),
    supabase.from('workspace_invites').select('email, role').eq('workspace_id', ws),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ]);

  const links = await ensureAccessLinks(supabase, ws, [
    ...(members ?? []).map((m) => m.profile?.email ?? '').filter(Boolean),
    ...(invites ?? []).map((i) => i.email as string),
  ]);
  const linkFor = (email?: string | null) => links.find((l) => l.email === (email ?? '').toLowerCase());

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="font-semibold">Workspace</h2>
        <div className="mt-4"><LogoUpload workspaceId={ws} logoUrl={logoUrl} /></div>
        <ActionForm action={updateWorkspace.bind(null, ws)} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="label">Business name</label>
            <input id="name" name="name" defaultValue={workspace.name} required className="field" />
          </div>
          <div>
            <label htmlFor="timezone" className="label">Timezone</label>
            <select id="timezone" name="timezone" defaultValue={workspace.timezone} className="field">
              {[...new Set([workspace.timezone, ...TIMEZONES])].map((tz) => <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>)}
            </select>
            <p className="hint mt-1">Planned post times and the calendar use this.</p>
          </div>
          <div className="sm:col-span-2"><button className="btn btn-primary">Save</button></div>
        </ActionForm>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="font-semibold">People</h2>
        <p className="hint mt-1">Approvers can approve, request changes and suggest caption edits. Viewers can see the calendar and comment.</p>
        <p className="hint mt-1">
          Each person has a direct link that signs them in without an email. It&apos;s personal to them, so if one is shared by mistake, reset it and the old link stops working.
        </p>

        <ul className="mt-4 divide-y divide-line border-y border-line">
          {(members ?? []).map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{m.profile?.full_name || m.profile?.email}</span>
                {m.profile?.full_name && <span className="block truncate text-muted">{m.profile.email}</span>}
              </span>
              <span className="text-muted">{m.role === 'approver' ? 'Approver' : 'Viewer'}</span>
              {linkFor(m.profile?.email) && <CopyLink path={directPath(linkFor(m.profile?.email)!.token, `/w/${ws}`)} label="Copy direct link" />}
              {linkFor(m.profile?.email) && <form action={resetAccessLink.bind(null, ws, m.profile?.email ?? '')}><button className="btn btn-ghost btn-sm">Reset link</button></form>}
              <form action={removeMember.bind(null, ws, m.user_id)}><button className="btn btn-ghost btn-sm">Remove</button></form>
            </li>
          ))}
          {(invites ?? []).map((inv) => (
            <li key={inv.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{inv.email} <span className="text-muted">hasn&apos;t opened their link yet</span></span>
              <span className="text-muted">{inv.role === 'approver' ? 'Approver' : 'Viewer'}</span>
              {linkFor(inv.email) && <CopyLink path={directPath(linkFor(inv.email)!.token, `/w/${ws}`)} label="Copy direct link" />}
              <form action={cancelInvite.bind(null, ws, inv.email)}><button className="btn btn-ghost btn-sm">Cancel</button></form>
            </li>
          ))}
          {!(members ?? []).length && !(invites ?? []).length && (
            <li className="py-3 text-sm text-muted">No one from {workspace.name} has been added yet.</li>
          )}
        </ul>

        <ActionForm action={inviteMember.bind(null, ws)} resetOnSuccess className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input name="email" type="email" required placeholder="name@business.com" aria-label="Email" className="field" />
          <select name="role" defaultValue="approver" aria-label="Role" className="field sm:w-36">
            <option value="approver">Approver</option>
            <option value="viewer">Viewer</option>
          </select>
          <button className="btn btn-primary">Add person</button>
        </ActionForm>
      </section>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="font-semibold">Your name</h2>
        <p className="hint mt-1">Shown to clients next to your comments.</p>
        <form action={updateMyName} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input name="full_name" defaultValue={me?.full_name ?? ''} placeholder="Your name" aria-label="Your name" className="field" />
          <button className="btn btn-quiet">Save name</button>
        </form>
      </section>
    </main>
  );
}
