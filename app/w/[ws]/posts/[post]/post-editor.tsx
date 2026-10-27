'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { FeedPreview } from '@/components/feed-preview';
import { FeedbackPanel } from '@/components/feedback-panel';
import { MediaViewer } from '@/components/media-viewer';
import { StatusStamp } from '@/components/status-stamp';
import { VersionHistory, type VersionView } from '@/components/version-history';
import { addMedia, deletePost, moveMedia, removeMedia, savePost, sendForApproval, setStatus } from '@/lib/actions';
import { checkPlatform, mediaSummary, PLATFORM_INFO, PLATFORMS } from '@/lib/platforms';
import type { LoadedPostView } from './types';
import { measure, uploadToMedia } from '@/lib/upload';
import type { Platform } from '@/lib/types';

type PState = Record<Platform, { on: boolean; caption: string; is_reel: boolean }>;

export function PostEditor({ data, versions, workspace, logoUrl, userId, plannedLocal }: {
  data: LoadedPostView;
  versions: VersionView[];
  workspace: { id: string; name: string; timezone: string };
  logoUrl: string | null;
  userId: string;
  plannedLocal: string;
}) {
  const { post, media, comments, suggestions, approvals } = data;
  const router = useRouter();
  const editable = ['draft', 'changes_requested', 'rejected'].includes(post.status);

  const initial = useMemo<PState>(() => {
    const s = {} as PState;
    for (const p of PLATFORMS) {
      const pv = data.platforms.find((x) => x.platform === p);
      s[p] = { on: Boolean(pv), caption: pv?.caption ?? '', is_reel: pv?.is_reel ?? false };
    }
    return s;
  }, [data.platforms]);

  const [title, setTitle] = useState(post.title);
  const [note, setNote] = useState(post.context_note ?? '');
  const [planned, setPlanned] = useState(plannedLocal);
  const [platforms, setPlatforms] = useState<PState>(initial);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>();
  const [pending, start] = useTransition();
  const [uploads, setUploads] = useState<{ name: string; progress: number }[]>([]);
  const [activeMark, setActiveMark] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<Platform | null>(null);

  const touch = () => { setDirty(true); setMsg(undefined); };
  const setP = (p: Platform, patch: Partial<PState[Platform]>) => { setPlatforms((s) => ({ ...s, [p]: { ...s[p], ...patch } })); touch(); };
  const chosen = PLATFORMS.filter((p) => platforms[p].on);
  const tab = previewTab && platforms[previewTab].on ? previewTab : chosen[0];

  const marked = comments.filter((c) => c.media_item_id);
  const marks = new Map(marked.map((c, i) => [c.id, i + 1]));
  const markList = marked.map((c) => ({ ...c, n: marks.get(c.id)! }));

  const lastDecision = approvals.at(-1);

  function save(then?: () => Promise<{ error?: string; ok?: string }>) {
    start(async () => {
      const r = await savePost(post.id, {
        title, contextNote: note, plannedLocal: planned,
        platforms: chosen.map((p) => ({ platform: p, caption: platforms[p].caption, is_reel: platforms[p].is_reel })),
      });
      if (r.error) { setMsg(r); return; }
      setDirty(false);
      const r2 = then ? await then() : r;
      setMsg(r2);
      router.refresh();
    });
  }

  const act = (fn: () => Promise<{ error?: string; ok?: string } | void>) => start(async () => {
    const r = await fn();
    setMsg(r || undefined);
    router.refresh();
  });

  async function onFiles(files: FileList) {
    const list = [...files].filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (!list.length) return;
    setUploads(list.map((f) => ({ name: f.name, progress: 0 })));
    const added = [];
    try {
      for (const [i, file] of list.entries()) {
        const dims = await measure(file);
        const ext = file.name.split('.').pop()?.toLowerCase() || (file.type.startsWith('video/') ? 'mp4' : 'jpg');
        const path = `${workspace.id}/${post.id}/${crypto.randomUUID()}.${ext}`;
        await uploadToMedia(file, path, (p) => setUploads((u) => u.map((x, j) => (j === i ? { ...x, progress: p } : x))));
        added.push({ storage_path: path, kind: file.type.startsWith('video/') ? 'video' as const : 'image' as const, file_name: file.name, ...dims });
      }
      const r = await addMedia(post.id, added);
      if (r.error) setMsg(r);
    } catch (e) {
      setMsg({ error: `Upload failed: ${e instanceof Error ? e.message : 'unknown error'}. Try again.` });
    }
    setUploads([]);
    router.refresh();
  }

  const checks = chosen.map((p) => ({ p, list: checkPlatform({ platform: p, caption: platforms[p].caption, is_reel: platforms[p].is_reel }, media) }));
  const blocking = checks.some((c) => c.list.some((x) => x.level === 'error')) || chosen.length === 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/w/${workspace.id}`} className="text-sm text-muted hover:text-ink">All posts</Link>
        <span className="ml-auto" />
        <Link href={`/w/${workspace.id}/posts/${post.id}?view=client`} className="btn btn-ghost btn-sm">See what the client sees</Link>
        {['approved', 'scheduled', 'published'].includes(post.status) && (
          <a href={`/api/posts/${post.id}/export`} className="btn btn-quiet btn-sm">Download for scheduling</a>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <StatusStamp status={post.status} role="admin" large />
        {post.version > 0 && <span className="text-sm text-muted">Version {post.version}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {editable && (
            <button type="button" className="btn btn-primary" disabled={pending || blocking}
              title={blocking ? 'Fix the issues marked in red first' : undefined}
              onClick={() => save(() => sendForApproval(post.id))}>
              {post.version === 0 ? 'Send for approval' : `Send version ${post.version + 1} for approval`}
            </button>
          )}
          {post.status === 'ready' && <button type="button" className="btn btn-quiet" disabled={pending} onClick={() => act(() => setStatus(post.id, 'draft'))}>Withdraw to edit</button>}
          {post.status === 'approved' && <button type="button" className="btn btn-primary" disabled={pending} onClick={() => act(() => setStatus(post.id, 'scheduled'))}>Mark as scheduled</button>}
          {post.status === 'scheduled' && <button type="button" className="btn btn-primary" disabled={pending} onClick={() => act(() => setStatus(post.id, 'published'))}>Mark as published</button>}
          {['approved', 'scheduled', 'published'].includes(post.status) && (
            <button type="button" className="btn btn-quiet" disabled={pending}
              onClick={() => { if (confirm('Move this post back to draft? It will need approving again.')) act(() => setStatus(post.id, 'draft')); }}>
              Reopen as draft
            </button>
          )}
        </div>
      </div>
      {msg?.error && <p role="alert" className="mt-3 rounded-md bg-red-soft px-3 py-2 text-sm text-red">{msg.error}</p>}
      {msg?.ok && <p role="status" className="mt-3 text-sm text-green">{msg.ok}</p>}

      {lastDecision && lastDecision.decision !== 'approved' && editable && (
        <div className="mt-4 rounded-lg border-l-4 border-amber bg-amber-soft px-4 py-3">
          <p className="text-sm font-semibold">
            {lastDecision.decision === 'rejected' ? 'Rejected' : 'Changes requested'} on version {lastDecision.version}
          </p>
          {lastDecision.reason && <p className="mt-1 whitespace-pre-wrap text-sm">{lastDecision.reason}</p>}
        </div>
      )}
      {!editable && (
        <p className="mt-4 text-sm text-muted">
          {post.status === 'ready' ? 'With the client for approval. Withdraw it to change the media or captions.' : 'Captions and media are locked. Reopen as draft to change them.'}
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Media */}
        <section aria-labelledby="h-media">
          <div className="mb-2 flex items-center gap-2">
            <h2 id="h-media" className="mr-auto font-semibold">Media <span className="font-normal text-muted">{mediaSummary(media, platforms.instagram.on && platforms.instagram.is_reel)}</span></h2>
            {editable && (
              <label className="btn btn-quiet btn-sm cursor-pointer">
                Add images or video
                <input type="file" multiple accept="image/*,video/*" className="sr-only" disabled={uploads.length > 0}
                  onChange={(e) => { if (e.target.files) onFiles(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>

          {uploads.length > 0 && (
            <ul className="mb-3 space-y-1.5 rounded-md border border-line bg-surface p-3 text-sm">
              {uploads.map((u) => (
                <li key={u.name}>
                  <div className="flex justify-between"><span className="truncate">{u.name}</span><span className="text-muted">{Math.round(u.progress * 100)}%</span></div>
                  <div className="mt-1 h-1 rounded bg-paper"><div className="h-1 rounded bg-cobalt" style={{ width: `${u.progress * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}

          <MediaViewer postId={post.id} media={media} marks={markList} canComment activeMark={activeMark} onActiveMark={setActiveMark} />

          {editable && media.length > 0 && (
            <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-surface text-sm">
              {media.map((m, i) => (
                <li key={m.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-5 text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{m.file_name ?? (m.kind === 'video' ? 'Video' : 'Image')}</span>
                  {m.width && m.height && <span className="hidden text-muted sm:inline">{m.width}×{m.height}</span>}
                  <button type="button" className="btn btn-ghost btn-sm" disabled={pending || i === 0} aria-label="Move earlier" onClick={() => act(() => moveMedia(m.id, -1))}>↑</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={pending || i === media.length - 1} aria-label="Move later" onClick={() => act(() => moveMedia(m.id, 1))}>↓</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => act(() => removeMedia(m.id))}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Details and captions */}
        <section aria-labelledby="h-details" className="space-y-5">
          <h2 id="h-details" className="sr-only">Post details</h2>
          <div>
            <label htmlFor="title" className="label">Title</label>
            <input id="title" className="field" value={title} onChange={(e) => { setTitle(e.target.value); touch(); }} />
            <p className="hint mt-1">For you and the client. Not posted.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="planned" className="label">Planned for</label>
              <input id="planned" type="datetime-local" className="field" value={planned} onChange={(e) => { setPlanned(e.target.value); touch(); }} />
              <p className="hint mt-1">{workspace.timezone.replace('_', ' ')} time</p>
            </div>
            <div>
              <label htmlFor="note" className="label">Note for the client</label>
              <input id="note" className="field" value={note} placeholder="e.g. New crane at the Pilbara site" onChange={(e) => { setNote(e.target.value); touch(); }} />
            </div>
          </div>

          <fieldset disabled={!editable}>
            <legend className="label">Platforms</legend>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <label key={p} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${platforms[p].on ? 'border-ink bg-surface font-semibold' : 'border-line-strong bg-surface/60 text-muted'}`}>
                  <input type="checkbox" checked={platforms[p].on} onChange={(e) => setP(p, { on: e.target.checked })} className="accent-ink" />
                  {PLATFORM_INFO[p].name}
                </label>
              ))}
            </div>
          </fieldset>

          {chosen.map((p) => {
            const c = checks.find((x) => x.p === p)!.list;
            const len = platforms[p].caption.length;
            const limit = PLATFORM_INFO[p].captionLimit;
            return (
              <div key={p} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex items-center gap-2">
                  <label htmlFor={`cap-${p}`} className="mr-auto font-semibold">{PLATFORM_INFO[p].name} caption</label>
                  <span className={`text-xs tabular-nums ${len > limit ? 'text-red' : 'text-muted'}`}>{len.toLocaleString()} / {limit.toLocaleString()}</span>
                </div>
                {p === 'instagram' && (
                  <label className="mt-2 flex items-center gap-2 text-sm">
                    <input type="checkbox" disabled={!editable} checked={platforms.instagram.is_reel} onChange={(e) => setP('instagram', { is_reel: e.target.checked })} className="accent-ink" />
                    Post as a Reel
                  </label>
                )}
                <textarea id={`cap-${p}`} rows={Math.min(Math.max(platforms[p].caption.split('\n').length + 3, 6), 18)} className="field mt-2 resize-y text-sm" readOnly={!editable}
                  value={platforms[p].caption} onChange={(e) => setP(p, { caption: e.target.value })} />
                {p !== 'linkedin' && platforms.linkedin.on && platforms.linkedin.caption && !platforms[p].caption && editable && (
                  <button type="button" className="btn btn-ghost btn-sm mt-1 -ml-2" onClick={() => setP(p, { caption: platforms.linkedin.caption })}>Copy the LinkedIn caption</button>
                )}
                {c.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {c.map((x, i) => (
                      <li key={i} className={`flex gap-2 text-sm ${x.level === 'error' ? 'text-red' : 'text-amber'}`}>
                        <span aria-hidden>{x.level === 'error' ? '●' : '▲'}</span>{x.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {chosen.length === 0 && <p className="text-sm text-muted">Choose where this post is going.</p>}

          <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-lg border border-line bg-surface/95 p-3 backdrop-blur">
            <span className="mr-auto text-sm text-muted">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
            <button type="button" className="btn btn-primary" disabled={pending || !dirty} onClick={() => save()}>
              {pending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </section>
      </div>

      {chosen.length > 0 && (
        <section aria-labelledby="h-preview" className="mt-10">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="h-preview" className="mr-auto font-semibold">Preview</h2>
            <div className="flex gap-1" role="tablist" aria-label="Preview platform">
              {chosen.map((p) => (
                <button key={p} type="button" role="tab" aria-selected={tab === p} onClick={() => setPreviewTab(p)}
                  className={`rounded px-3 py-1.5 text-sm ${tab === p ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{PLATFORM_INFO[p].name}</button>
              ))}
            </div>
          </div>
          <div className="mx-auto mt-4 max-w-[420px]">
            {tab && <FeedPreview platform={tab} caption={platforms[tab].caption} media={media} isReel={tab === 'instagram' && platforms.instagram.is_reel} accountName={workspace.name} logoUrl={logoUrl} />}
          </div>
        </section>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="h-feedback">
          <h2 id="h-feedback" className="mb-3 font-semibold">Feedback</h2>
          <FeedbackPanel postId={post.id} role="admin" userId={userId} version={post.version} timezone={workspace.timezone}
            comments={comments} marks={marks} suggestions={suggestions} approvals={approvals} activeMark={activeMark} onActiveMark={setActiveMark} />
        </section>
        <section aria-labelledby="h-versions">
          <h2 id="h-versions" className="mb-3 font-semibold">Versions sent</h2>
          <VersionHistory versions={versions} timezone={workspace.timezone} />
        </section>
      </div>

      <div className="mt-12 border-t border-line pt-6">
        <button type="button" className="btn btn-ghost btn-sm text-red hover:text-red" disabled={pending}
          onClick={() => { if (confirm('Delete this post and all its feedback? This cannot be undone.')) start(() => deletePost(post.id)); }}>
          Delete post
        </button>
      </div>
    </main>
  );
}
