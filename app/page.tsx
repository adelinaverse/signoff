import { redirect } from 'next/navigation';
import { getSession } from '@/lib/data';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Sign Off';

export default async function Home() {
  const { supabase, user, isAdmin } = await getSession();
  if (isAdmin) redirect('/workspaces');

  const { data: memberships } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id);
  if (memberships?.length === 1) redirect(`/w/${memberships[0].workspace_id}`);
  if (memberships && memberships.length > 1) redirect('/workspaces');

  return (
    <main className="min-h-dvh grid place-items-center px-4">
      <div className="max-w-sm">
        <p className="text-lg font-semibold">{APP_NAME}</p>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">You&apos;re signed in, but not added to a workspace yet</h1>
        <p className="mt-2 text-muted">
          Signed in as {user.email}. Ask the person who manages your social media to add this email, then sign in again.
        </p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="btn btn-quiet">Sign out</button>
        </form>
      </div>
    </main>
  );
}
