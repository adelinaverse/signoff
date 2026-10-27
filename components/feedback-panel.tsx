'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addComment, deleteComment, reviewSuggestion, setCommentResolved } from '@/lib/actions';
import { PLATFORM_INFO } from '@/lib/platforms';
import { formatSeconds, formatShort } from '@/lib/time';
import type { Approval, CaptionSuggestion, Comment, Role } from '@/lib/types';
import { CaptionDiff } from './caption-diff';

const nameOf = (p?: { email: string; full_name: string | null } | null) => (p ? p.full_name || p.email.split('@')[0] : 'Someone');

const DECISION_TEXT = { approved: 'approved', changes_requested: 'requested changes to', rejected: 'rejected' } as const;
const DECISION_TONE = { approved: 'text-green', changes_requested: 'text-amber', rejected: 'text-red' } as const;

export function FeedbackPanel({
  postId, role, userId, version, timezone, comments, marks, suggestions, approvals, activeMark, onActiveMark,
}: {
  postId: string;
  role: Role;
  userId: string;
  version: number;
  timezone: string;
  comments: Comment[];
  marks: Map<string, number>;
  suggestions: CaptionSuggestion[];
  approvals: Approval[];
  activeMark?: string | null;
  onActiveMark?: (id: string | null) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const isAdmin = role === 'admin';

  const run = (fn: () => Promise<{ error?: string } | void>) => start(async () => {
    const r = await fn();
    if (r && r.error) setError(r.error); else { setError(''); router.refresh(); }
  });

  const openSuggestions = suggestions.filter((s) => s.status === 'pending');
  const closedSuggestions = suggestions.filter((s) => s.status !== 'pending');
  const open = comments.filter((c) => !c.resolved);
  const resolved = comments.filter((c) => c.resolved);

  return (
    <div className="space-y-6">
      {approvals.length > 0 && (
        <section aria-labelledby="h-decisions">
          <h3 id="h-decisions" className="text-sm font-semibold">Decisions</h3>
          <ul className="mt-2 space-y-2">
            {[...approvals].reverse().map((a) => (
              <li key={a.id} className="rounded-md border border-line bg-surface p-3 text-sm">
                <p>
                  <span className="font-semibold">{nameOf(a.author)}</span>{' '}
                  <span className={`font-semibold ${DECISION_TONE[a.decision]}`}>{DECISION_TEXT[a.decision]}</span>{' '}
                  version {a.version}
                  <span className="text-muted">, {formatShort(a.created_at, timezone)}</span>
                </p>
                {a.reason && <p className="mt-1 whitespace-pre-wrap text-ink">{a.reason}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(openSuggestions.length > 0 || closedSuggestions.length > 0) && (
        <section aria-labelledby="h-suggestions">
          <h3 id="h-suggestions" className="text-sm font-semibold">Caption suggestions</h3>
          <ul className="mt-2 space-y-2">
            {openSuggestions.map((s) => (
              <li key={s.id} className="rounded-md border border-line bg-surface p-3">
                <p className="text-sm">
                  <span className="font-semibold">{nameOf(s.author)}</span> suggested an edit to the {PLATFORM_INFO[s.platform].name} caption
                </p>
                <div className="mt-2 rounded bg-paper p-2"><CaptionDiff before={s.original} after={s.suggested} /></div>
                {s.note && <p className="mt-2 text-sm text-muted">{s.note}</p>}
                {isAdmin ? (
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => reviewSuggestion(s.id, true))}>Accept edit</button>
                    <button type="button" className="btn btn-quiet btn-sm" disabled={pending} onClick={() => run(() => reviewSuggestion(s.id, false))}>Dismiss</button>
                  </div>
                ) : (
                  <p className="hint mt-2">Waiting for the agency to accept it.</p>
                )}
              </li>
            ))}
            {closedSuggestions.map((s) => (
              <li key={s.id} className="text-sm text-muted">
                {nameOf(s.author)}&apos;s {PLATFORM_INFO[s.platform].name} edit was {s.status === 'accepted' ? 'accepted' : 'not used'}.
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="h-comments">
        <h3 id="h-comments" className="text-sm font-semibold">
          Comments {open.length > 0 && <span className="font-normal text-muted">{open.length} open</span>}
        </h3>
        {open.length === 0 && <p className="mt-2 text-sm text-muted">No open comments.</p>}
        <ul className="mt-2 space-y-2">
          {open.map((c) => (
            <CommentRow key={c.id} c={c} n={marks.get(c.id)} active={activeMark === c.id} onSelect={onActiveMark}
              canResolve={isAdmin || c.author_id === userId} canDelete={c.author_id === userId}
              olderVersion={c.version < version} timezone={timezone} disabled={pending}
              onResolve={() => run(() => setCommentResolved(c.id, true))} onDelete={() => run(() => deleteComment(c.id))} />
          ))}
        </ul>
        {resolved.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm mt-2 -ml-2" onClick={() => setShowResolved(!showResolved)}>
            {showResolved ? 'Hide' : 'Show'} {resolved.length} resolved
          </button>
        )}
        {showResolved && (
          <ul className="mt-1 space-y-2 opacity-70">
            {resolved.map((c) => (
              <CommentRow key={c.id} c={c} n={marks.get(c.id)} active={activeMark === c.id} onSelect={onActiveMark}
                canResolve={isAdmin || c.author_id === userId} canDelete={false} olderVersion={c.version < version}
                timezone={timezone} disabled={pending} resolved onResolve={() => run(() => setCommentResolved(c.id, false))} />
            ))}
          </ul>
        )}

        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await addComment(postId, { body: text });
              if (!r.error) setText('');
              return r;
            });
          }}
        >
          <label htmlFor="general-comment" className="sr-only">Add a comment about the whole post</label>
          <textarea id="general-comment" rows={2} className="field text-sm" placeholder="Add a comment about the whole post"
            value={text} onChange={(e) => setText(e.target.value)} />
          <div className="mt-2 flex items-center justify-between gap-2">
            {error ? <p className="text-sm text-red">{error}</p> : <span />}
            <button className="btn btn-quiet btn-sm" disabled={pending || !text.trim()}>Comment</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CommentRow({
  c, n, active, onSelect, canResolve, canDelete, olderVersion, timezone, disabled, resolved, onResolve, onDelete,
}: {
  c: Comment; n?: number; active: boolean; onSelect?: (id: string | null) => void;
  canResolve: boolean; canDelete: boolean; olderVersion: boolean; timezone: string; disabled: boolean;
  resolved?: boolean; onResolve: () => void; onDelete?: () => void;
}) {
  return (
    <li className={`rounded-md border bg-surface p-3 text-sm ${active ? 'border-cobalt' : 'border-line'}`}>
      <div className="flex items-start gap-2">
        {n != null && (
          <button type="button" onClick={() => onSelect?.(active ? null : c.id)} aria-label={`Show comment ${n} on the media`}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cobalt text-[11px] font-bold text-white">{n}</button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-muted">
            <span className="font-semibold text-ink">{nameOf(c.author)}</span>
            {c.at_seconds != null && <> at {formatSeconds(Number(c.at_seconds))}</>}
            {olderVersion && <> on version {c.version}</>}
            <span>, {formatShort(c.created_at, timezone)}</span>
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
          {(canResolve || canDelete) && (
            <div className="mt-1 flex gap-1">
              {canResolve && <button type="button" className="btn btn-ghost btn-sm -ml-2" disabled={disabled} onClick={onResolve}>{resolved ? 'Reopen' : 'Mark resolved'}</button>}
              {canDelete && onDelete && <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={onDelete}>Delete</button>}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
