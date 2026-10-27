'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { addComment } from '@/lib/actions';
import { formatSeconds } from '@/lib/time';
import type { Comment, MediaView } from '@/lib/types';

interface Props {
  postId: string;
  media: MediaView[];
  /** comments that point at a spot or a moment, already numbered in display order */
  marks: (Comment & { n: number })[];
  canComment: boolean;
  activeMark?: string | null;
  onActiveMark?: (id: string | null) => void;
}

type Draft = { mediaId: string; x?: number; y?: number; at?: number };

export function MediaViewer({ postId, media, marks, canComment, activeMark, onActiveMark }: Props) {
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  const item = media[Math.min(index, media.length - 1)];

  // Jump to the media a selected comment belongs to
  useEffect(() => {
    if (!activeMark) return;
    const mark = marks.find((m) => m.id === activeMark);
    if (!mark?.media_item_id) return;
    const i = media.findIndex((m) => m.id === mark.media_item_id);
    if (i >= 0) setIndex(i);
    if (mark.at_seconds != null) {
      requestAnimationFrame(() => {
        if (videoRef.current) { videoRef.current.currentTime = Number(mark.at_seconds); videoRef.current.pause(); }
      });
    }
  }, [activeMark, marks, media]);

  if (!item) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-lg border border-dashed border-line-strong bg-surface text-sm text-muted">
        No imagery on this post. It goes out as text only.
      </div>
    );
  }

  const here = marks.filter((m) => m.media_item_id === item.id);

  function placePin(e: React.MouseEvent<HTMLDivElement>) {
    if (!canComment || item.kind !== 'image') return;
    const r = e.currentTarget.getBoundingClientRect();
    setDraft({ mediaId: item.id, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
    setText('');
    setError('');
    onActiveMark?.(null);
  }

  function commentAtTime() {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setDraft({ mediaId: item.id, at: v.currentTime });
    setText('');
    setError('');
  }

  function save() {
    if (!draft) return;
    start(async () => {
      const r = await addComment(postId, {
        body: text, mediaItemId: draft.mediaId, pinX: draft.x ?? null, pinY: draft.y ?? null, atSeconds: draft.at ?? null,
      });
      if (r.error) { setError(r.error); return; }
      setDraft(null);
      setText('');
      router.refresh();
    });
  }

  const composer = draft && (
    <div className="max-w-md rounded-lg border border-line bg-surface p-3 text-left" onClick={(e) => e.stopPropagation()}>
      <label htmlFor="pin-text" className="label">
        {draft.at != null ? `Comment at ${formatSeconds(draft.at)}` : 'Comment on this spot'}
      </label>
      <textarea
        id="pin-text" autoFocus rows={3} className="field text-sm" value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); if (e.key === 'Escape') setDraft(null); }}
        placeholder={draft.at != null ? 'What should change here?' : 'e.g. Use a photo of the new crew here'}
      />
      {error && <p className="mt-1 text-xs text-red">{error}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={pending || !text.trim()} onClick={save}>
          {pending ? 'Saving…' : 'Add comment'}
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="relative overflow-hidden rounded-lg bg-ink/95">
        {item.kind === 'image' ? (
          <div className="relative mx-auto w-fit">
            <div className={`relative ${canComment ? 'cursor-crosshair' : ''}`} onClick={placePin}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.file_name ?? ''} className="block max-h-[70vh] w-auto max-w-full select-none" draggable={false} />
              {here.filter((m) => m.pin_x != null).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onActiveMark?.(activeMark === m.id ? null : m.id); }}
                  aria-label={`Comment ${m.n}`}
                  className={`absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-xs font-bold shadow
                    ${m.resolved ? 'bg-muted text-white' : 'bg-cobalt text-white'} ${activeMark === m.id ? 'ring-4 ring-cobalt/40' : ''}`}
                  style={{ left: `${Number(m.pin_x) * 100}%`, top: `${Number(m.pin_y) * 100}%` }}
                >
                  {m.n}
                </button>
              ))}
              {draft?.x != null && draft.mediaId === item.id && (
                <span className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-cobalt text-xs font-bold text-white shadow ring-4 ring-cobalt/40"
                  style={{ left: `${draft.x * 100}%`, top: `${draft.y! * 100}%` }}>+</span>
              )}
            </div>
          </div>
        ) : (
          <div>
            <video ref={videoRef} key={item.id} src={item.url} controls playsInline className="mx-auto block max-h-[70vh] w-auto max-w-full" />
          </div>
        )}

        {media.length > 1 && (
          <>
            <button type="button" disabled={index === 0} onClick={() => { setIndex(index - 1); setDraft(null); }}
              aria-label="Previous" className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg shadow disabled:opacity-0">‹</button>
            <button type="button" disabled={index === media.length - 1} onClick={() => { setIndex(index + 1); setDraft(null); }}
              aria-label="Next" className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-lg shadow disabled:opacity-0">›</button>
          </>
        )}
      </div>

      {item.kind === 'video' && (
        <div className="mt-2">
          {here.some((m) => m.at_seconds != null) && item.duration_sec ? (
            <div className="relative h-5" aria-label="Comments on the video timeline">
              <div className="absolute inset-x-0 top-1/2 h-px bg-line-strong" />
              {here.filter((m) => m.at_seconds != null).map((m) => (
                <button key={m.id} type="button" onClick={() => onActiveMark?.(m.id)} aria-label={`Comment ${m.n} at ${formatSeconds(Number(m.at_seconds))}`}
                  className={`absolute top-0 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full text-[10px] font-bold text-white ${m.resolved ? 'bg-muted' : 'bg-cobalt'}`}
                  style={{ left: `${Math.min(Number(m.at_seconds) / Number(item.duration_sec), 1) * 100}%` }}>
                  {m.n}
                </button>
              ))}
            </div>
          ) : null}
          {canComment && !draft && (
            <button type="button" className="btn btn-quiet btn-sm mt-1" onClick={commentAtTime}>Pause and comment at this moment</button>
          )}
          {draft?.at != null && <div className="mt-2">{composer}</div>}
        </div>
      )}

      {draft?.x != null && <div className="mt-3">{composer}</div>}

      <div className="mt-2 flex items-center gap-3 text-sm text-muted">
        {media.length > 1 && <span>{index + 1} of {media.length}</span>}
        {canComment && item.kind === 'image' && !draft && <span>Tap the image to comment on a spot.</span>}
      </div>

      {media.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {media.map((m, i) => (
            <button key={m.id} type="button" onClick={() => { setIndex(i); setDraft(null); }} aria-label={`Show item ${i + 1}`}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded border-2 ${i === index ? 'border-cobalt' : 'border-transparent'}`}>
              {m.kind === 'image'
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={m.url} alt="" className="h-full w-full object-cover" />
                : <video src={`${m.url}#t=0.1`} muted preload="metadata" className="h-full w-full object-cover" />}
              {marks.some((c) => c.media_item_id === m.id && !c.resolved) && (
                <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border border-white bg-cobalt" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
