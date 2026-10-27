'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { CaptionDiff } from '@/components/caption-diff';
import { FeedPreview } from '@/components/feed-preview';
import { FeedbackPanel } from '@/components/feedback-panel';
import { MediaViewer } from '@/components/media-viewer';
import { StatusStamp } from '@/components/status-stamp';
import { VersionHistory, type VersionView } from '@/components/version-history';
import { decide, suggestCaption } from '@/lib/actions';
import { PLATFORM_INFO } from '@/lib/platforms';
import type { Decision, Platform, Role } from '@/lib/types';
import type { LoadedPostView } from './types';

export function PostReview({ data, versions, workspace, logoUrl, role, userId, plannedText, queue, previewing }: {
  data: LoadedPostView;
  versions: VersionView[];
  workspace: { id: string; name: string; timezone: string };
  logoUrl: string | null;
  role: Role;
  userId: string;
  plannedText: string;
  queue: { position: number; total: number; nextId: string | null } | null;
  /** the agency looking at the client view */
  previewing: boolean;
}) {
  const { post, media, platforms, comments, suggestions, approvals } = data;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<Platform | undefined>(platforms[0]?.platform);
  const [activeMark, setActiveMark] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [choice, setChoice] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [decided, setDecided] = useState<Decision | null>(null);

  const pv = platforms.find((p) => p.platform === tab) ?? platforms[0];
  const canDecide = post.status === 'ready' && (role === 'approver' || (role === 'admin' && !previewing));
  const canSuggest = post.status === 'ready' && role !== 'viewer';
  const canComment = !previewing;

  const marked = comments.filter((c) => c.media_item_id);
  const marks = new Map(marked.map((c, i) => [c.id, i + 1]));
  const markList = marked.map((c) => ({ ...c, n: marks.get(c.id)! }));
  const myPending = suggestions.filter((s) => s.status === 'pending' && s.author_id === userId && s.platform === pv?.platform);
  const boardUrl = `/w/${workspace.id}`;

  function submitSuggestion() {
    if (!pv) return;
    start(async () => {
      const r = await suggestCaption(post.id, pv.platform, draft, draftNote);
      if (r.error) { setError(r.error); return; }
      setEditing(false);
      setError('');
      router.refresh();
    });
  }

  function submitDecision(d: Decision) {
    start(async () => {
      const r = await decide(post.id, d, reason);
      if (r.error) { setError(r.error); return; }
      setError('');
      setDecided(d);
      setTimeout(() => {
        if (queue?.nextId) router.push(`/w/${workspace.id}/posts/${queue.nextId}?queue=1`);
        else if (queue) router.push(`/w/${workspace.id}/review?done=1`);
        else router.refresh();
      }, 1100);
    });
  }

  const doneStamp = decided && (
    <span className={`stamp stamp-lg stamp-in ${decided === 'approved' ? 'text-green' : decided === 'rejected' ? 'text-red' : 'text-amber'}`}>
      {decided === 'approved' ? 'Approved' : decided === 'rejected' ? 'Rejected' : 'Changes requested'}
    </span>
  );

  return (
    <main className={`mx-auto max-w-6xl px-4 py-6 sm:px-6 ${canDecide ? 'pb-40' : ''}`}>
      {previewing && (
        <div className="mb-4 flex items-center gap-3 rounded-md bg-cobalt-soft px-3 py-2 text-sm">
          <span className="mr-auto">This is what {workspace.name} sees.</span>
          <Link href={`/w/${workspace.id}/posts/${post.id}`} className="btn btn-quiet btn-sm">Back to editing</Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={boardUrl} className="text-muted hover:text-ink">All posts</Link>
        {queue && <span className="ml-auto text-muted">Post {queue.position} of {queue.total}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-4">
        <div className="mr-auto min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{post.title}</h1>
          <p className="mt-1 text-muted">{plannedText}</p>
        </div>
        {!decided && <StatusStamp status={post.status} role={role === 'admin' && previewing ? 'approver' : role} large />}
        {doneStamp}
      </div>

      {post.context_note && (
        <p className="mt-4 max-w-2xl rounded-md border-l-4 border-line-strong bg-surface px-4 py-3 text-sm">{post.context_note}</p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section aria-labelledby="h-feed">
          <div className="mb-3 flex items-center gap-2">
            <h2 id="h-feed" className="mr-auto font-semibold">How it will look</h2>
            {platforms.length > 1 && (
              <div className="flex gap-1" role="tablist" aria-label="Platform">
                {platforms.map((p) => (
                  <button key={p.platform} type="button" role="tab" aria-selected={pv?.platform === p.platform}
                    onClick={() => { setTab(p.platform); setEditing(false); }}
                    className={`rounded px-2.5 py-1 text-sm ${pv?.platform === p.platform ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>
                    {PLATFORM_INFO[p.platform].name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {pv ? (
            <FeedPreview platform={pv.platform} caption={editing ? draft : pv.caption} media={media} isReel={pv.is_reel} accountName={workspace.name} logoUrl={logoUrl} />
          ) : <p className="text-sm text-muted">No platforms on this post yet.</p>}
        </section>

        <div className="space-y-8">
          {pv && (
            <section aria-labelledby="h-caption">
              <div className="flex items-center gap-2">
                <h2 id="h-caption" className="mr-auto font-semibold">{PLATFORM_INFO[pv.platform].name} caption</h2>
                {canSuggest && !editing && canComment && (
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setDraft(pv.caption); setDraftNote(''); setEditing(true); setError(''); }}>
                    Suggest an edit
                  </button>
                )}
              </div>
              {!editing ? (
                <p className="mt-2 whitespace-pre-wrap break-words rounded-md border border-line bg-surface p-4 text-[15px] leading-relaxed">{pv.caption}</p>
              ) : (
                <div className="mt-2 space-y-3 rounded-md border border-cobalt bg-surface p-4">
                  <label htmlFor="suggest" className="label">Edit the caption the way you&apos;d like it</label>
                  <textarea id="suggest" rows={8} className="field text-[15px]" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                  {draft !== pv.caption && (
                    <div>
                      <p className="label">Your changes</p>
                      <div className="rounded bg-paper p-3"><CaptionDiff before={pv.caption} after={draft} /></div>
                    </div>
                  )}
                  <div>
                    <label htmlFor="suggest-note" className="label">Why (optional)</label>
                    <input id="suggest-note" className="field text-sm" value={draftNote} onChange={(e) => setDraftNote(e.target.value)} placeholder="e.g. We call them our crew, not our team" />
                  </div>
                  {error && <p className="text-sm text-red">{error}</p>}
                  <div className="flex justify-end gap-2">
                    <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                    <button type="button" className="btn btn-primary" disabled={pending || draft === pv.caption} onClick={submitSuggestion}>Save suggestion</button>
                  </div>
                </div>
              )}
              {myPending.length > 0 && !editing && (
                <p className="mt-2 text-sm text-muted">You&apos;ve suggested an edit to this caption. The agency will review it.</p>
              )}
            </section>
          )}

          {media.length > 0 && (
            <section aria-labelledby="h-imagery">
              <h2 id="h-imagery" className="mb-3 font-semibold">Comment on the imagery</h2>
              <MediaViewer postId={post.id} media={media} marks={markList} canComment={canComment} activeMark={activeMark} onActiveMark={setActiveMark} />
            </section>
          )}

          <section aria-labelledby="h-fb">
            <h2 id="h-fb" className="mb-3 font-semibold">Feedback</h2>
            <FeedbackPanel postId={post.id} role={previewing ? 'approver' : role} userId={userId} version={post.version} timezone={workspace.timezone}
              comments={comments} marks={marks} suggestions={suggestions} approvals={approvals} activeMark={activeMark} onActiveMark={setActiveMark} />
          </section>

          {versions.length > 1 && (
            <section aria-labelledby="h-v">
              <h2 id="h-v" className="mb-3 font-semibold">Earlier versions</h2>
              <VersionHistory versions={versions} timezone={workspace.timezone} />
            </section>
          )}
        </div>
      </div>

      {canDecide && !decided && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
            {choice && choice !== 'approved' ? (
              <div className="space-y-2">
                <label htmlFor="reason" className="label">
                  {choice === 'rejected' ? 'Why is this post not going ahead?' : 'What needs to change?'}
                </label>
                <textarea id="reason" rows={2} autoFocus className="field text-sm" value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder={choice === 'rejected' ? 'e.g. This project is confidential for now' : 'e.g. Swap the second photo and mention the safety record'} />
                {error && <p className="text-sm text-red">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn btn-ghost" onClick={() => { setChoice(null); setError(''); }}>Back</button>
                  <button type="button" className={`btn ${choice === 'rejected' ? 'bg-red text-white' : 'bg-amber text-white'}`}
                    disabled={pending || !reason.trim()} onClick={() => submitDecision(choice)}>
                    {choice === 'rejected' ? 'Reject post' : 'Request changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <p className="mr-auto hidden text-sm text-muted sm:block">Happy with this post?</p>
                {error && <p className="w-full text-sm text-red">{error}</p>}
                <button type="button" className="btn btn-ghost text-red hover:text-red" disabled={pending} onClick={() => setChoice('rejected')}>Reject</button>
                <button type="button" className="btn btn-quiet flex-1 sm:flex-none" disabled={pending} onClick={() => setChoice('changes_requested')}>Request changes</button>
                <button type="button" className="btn flex-1 border-2 border-green bg-green text-white hover:bg-green/90 sm:flex-none" disabled={pending}
                  onClick={() => submitDecision('approved')}>
                  {pending ? 'Approving…' : 'Approve'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
