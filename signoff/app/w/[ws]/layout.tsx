import { AppHeader } from '@/components/app-header';
import { getWorkspaceContext } from '@/lib/data';

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  const { workspace, logoUrl, role, user, isAdmin, supabase } = await getWorkspaceContext(ws);

  let showAll = isAdmin;
  if (!isAdmin) {
    const { count } = await supabase.from('workspace_members').select('workspace_id', { count: 'exact', head: true }).eq('user_id', user.id);
    showAll = (count ?? 0) > 1;
  }

  const base = `/w/${ws}`;
  const nav = [
    { href: base, label: 'Posts' },
    { href: `${base}/calendar`, label: 'Calendar' },
    ...(role === 'admin' ? [{ href: `${base}/settings`, label: 'Settings' }] : []),
  ];

  return (
    <>
      <AppHeader workspace={workspace} logoUrl={logoUrl} nav={nav} email={user.email} showAllWorkspaces={showAll} />
      {children}
    </>
  );
}
