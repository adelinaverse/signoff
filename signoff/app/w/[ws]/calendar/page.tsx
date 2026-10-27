import Link from 'next/link';
import { PostThumb } from '@/components/post-thumb';
import { createPost } from '@/lib/actions';
import { loadBoardPosts } from '@/lib/board';
import { getWorkspaceContext } from '@/lib/data';
import { STATUS_TONE } from '@/lib/status';
import { dayKey, localInputToUtc, utcToLocalInput } from '@/lib/time';

export const metadata = { title: 'Calendar' };

const TONE_BORDER = {
  ink: 'border-l-ink', cobalt: 'border-l-cobalt', amber: 'border-l-amber', green: 'border-l-green', red: 'border-l-red', muted: 'border-l-line-strong',
} as const;

export default async function CalendarPage({ params, searchParams }: {
  params: Promise<{ ws: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { ws } = await params;
  const { month } = await searchParams;
  const { supabase, workspace, role } = await getWorkspaceContext(ws);
  const tz = workspace.timezone;

  const today = utcToLocalInput(new Date().toISOString(), tz).slice(0, 10);
  const [y, m] = (/^\d{4}-\d{2}$/.test(month ?? '') ? month! : today.slice(0, 7)).split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // weeks start Monday
  const key = (d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  const from = localInputToUtc(`${key(1)}T00:00`, tz)!;
  const to = localInputToUtc(`${shift(1)}-01T00:00`, tz)!;
  const posts = await loadBoardPosts(supabase, ws, { from, to });
  const byDay = new Map<string, typeof posts>();
  for (const p of posts) {
    const k = dayKey(p.planned_at!, tz);
    byDay.set(k, [...(byDay.get(k) ?? []), p]);
  }

  const { count: unscheduled } = await supabase.from('posts').select('id', { count: 'exact', head: true })
    .eq('workspace_id', ws).is('planned_at', null);

  const monthName = new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold tracking-tight">{monthName}</h1>
        <Link href={`/w/${ws}/calendar?month=${shift(-1)}`} className="btn btn-quiet btn-sm">Previous</Link>
        <Link href={`/w/${ws}/calendar`} className="btn btn-quiet btn-sm">Today</Link>
        <Link href={`/w/${ws}/calendar?month=${shift(1)}`} className="btn btn-quiet btn-sm">Next</Link>
      </div>
      <p className="hint mt-1">
        {posts.length} post{posts.length === 1 ? '' : 's'} planned, times in {tz.replace('_', ' ')}.
        {role === 'admin' && (unscheduled ?? 0) > 0 && <> {unscheduled} without a date are on the <Link href={`/w/${ws}`} className="underline">Posts</Link> list.</>}
      </p>

      {/* Month grid on wider screens */}
      <div className="mt-6 hidden overflow-hidden rounded-lg border border-line bg-line md:block">
        <div className="grid grid-cols-7 gap-px text-xs font-semibold text-muted">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="bg-surface px-2 py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-px">
          {cells.map((d, i) => {
            const items = d ? byDay.get(key(d)) ?? [] : [];
            const isToday = d && key(d) === today;
            return (
              <div key={i} className={`group min-h-28 p-1.5 ${d ? 'bg-surface' : 'bg-paper'}`}>
                {d && (
                  <div className="flex items-center justify-between px-1">
                    <span className={`text-xs ${isToday ? 'grid h-5 w-5 place-items-center rounded-full bg-ink font-semibold text-white' : 'text-muted'}`}>{d}</span>
                    {role === 'admin' && (
                      <form action={createPost.bind(null, ws)} className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                        <input type="hidden" name="date" value={key(d)} />
                        <button className="text-xs text-muted hover:text-ink" aria-label={`New post on ${key(d)}`}>Add</button>
                      </form>
                    )}
                  </div>
                )}
                <div className="mt-1 space-y-1">
                  {items.map((p) => (
                    <Link
                      key={p.id}
                      href={`/w/${ws}/posts/${p.id}`}
                      className={`flex items-center gap-1.5 rounded border-l-[3px] bg-paper/70 p-1 text-xs hover:bg-paper ${TONE_BORDER[STATUS_TONE[p.status]]}`}
                    >
                      <PostThumb url={p.thumbUrl} kind={p.media_items[0]?.kind} count={0} size={24} />
                      <span className="line-clamp-2">{p.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda on phones */}
      <ul className="mt-6 space-y-4 md:hidden">
        {[...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, items]) => (
          <li key={day}>
            <p className="text-sm font-semibold">
              {new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00Z`))}
            </p>
            <ul className="mt-1 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {items.map((p) => (
                <li key={p.id}>
                  <Link href={`/w/${ws}/posts/${p.id}`} className={`flex items-center gap-3 border-l-[3px] px-3 py-2 ${TONE_BORDER[STATUS_TONE[p.status]]}`}>
                    <PostThumb url={p.thumbUrl} kind={p.media_items[0]?.kind} count={p.media_items.length} size={40} />
                    <span className="truncate text-sm">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
        {byDay.size === 0 && <li className="text-sm text-muted">Nothing planned this month.</li>}
      </ul>

      <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="border-l-[3px] border-l-cobalt pl-1.5">Waiting for approval</span>
        <span className="border-l-[3px] border-l-amber pl-1.5">Changes requested</span>
        <span className="border-l-[3px] border-l-green pl-1.5">Approved</span>
        <span className="border-l-[3px] border-l-ink pl-1.5">Scheduled or published</span>
        <span className="border-l-[3px] border-l-line-strong pl-1.5">Draft</span>
      </p>
    </main>
  );
}
