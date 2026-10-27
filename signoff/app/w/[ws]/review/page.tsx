import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getWorkspaceContext } from '@/lib/data';

export const metadata = { title: 'Review' };

/** Starts the one-at-a-time review run, or says everything is done. */
export default async function ReviewQueue({ params, searchParams }: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { ws } = await params;
  const { done } = await searchParams;
  const { supabase, workspace } = await getWorkspaceContext(ws);
  const { data: ready } = await supabase.from('posts').select('id').eq('workspace_id', ws).eq('status', 'ready')
    .order('planned_at', { ascending: true, nullsFirst: false }).order('created_at').limit(1);

  if (ready?.length) redirect(`/w/${ws}/posts/${ready[0].id}?queue=1`);

  return (
    <main className="mx-auto grid max-w-md place-items-center px-4 py-24 text-center">
      <span className="stamp stamp-lg stamp-in text-green">All done</span>
      <h1 className="mt-8 text-2xl font-bold tracking-tight">{done ? "That's everything for now" : 'Nothing is waiting for you'}</h1>
      <p className="mt-2 text-muted">
        {done ? 'Thanks. Your decisions and comments are with the team now.' : `We'll email you when new posts for ${workspace.name} are ready.`}
      </p>
      <Link href={`/w/${ws}/calendar`} className="btn btn-quiet mt-6">See the calendar</Link>
    </main>
  );
}
