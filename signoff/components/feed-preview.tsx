'use client';

import { useState } from 'react';
import { PLATFORM_INFO } from '@/lib/platforms';
import type { Platform } from '@/lib/types';

export interface PreviewMedia {
  url: string;
  kind: 'image' | 'video';
  width: number | null;
  height: number | null;
}

interface Props {
  platform: Platform;
  caption: string;
  media: PreviewMedia[];
  isReel: boolean;
  accountName: string;
  logoUrl: string | null;
}

/** An approximation of how the post sits in each feed, so the client approves it in context. */
export function FeedPreview(props: Props) {
  if (props.platform === 'instagram') return props.isReel ? <ReelPreview {...props} /> : <InstagramPreview {...props} />;
  return <StackedPreview {...props} />;
}

function Avatar({ logoUrl, name, size = 36 }: { logoUrl: string | null; name: string; size?: number }) {
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="shrink-0 rounded-full border border-line bg-white object-contain" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white" style={{ width: size, height: size }}>
      {name.slice(0, 1)}
    </span>
  );
}

function FoldedCaption({ text, foldAt, prefix }: { text: string; foldAt: number; prefix?: string }) {
  const [open, setOpen] = useState(false);
  const needsFold = text.length > foldAt;
  const shown = open || !needsFold ? text : text.slice(0, foldAt).replace(/\s+\S*$/, '');
  return (
    <p className="whitespace-pre-wrap break-words text-[14px] leading-snug">
      {prefix && <span className="mr-1 font-semibold">{prefix}</span>}
      {shown || <span className="text-muted">No caption yet</span>}
      {needsFold && !open && (
        <>
          {'… '}
          <button type="button" onClick={() => setOpen(true)} className="text-muted hover:underline">more</button>
        </>
      )}
    </p>
  );
}

function MediaEl({ m, className, cover }: { m: PreviewMedia; className?: string; cover?: boolean }) {
  const fit = cover ? 'object-cover' : 'object-contain';
  return m.kind === 'video' ? (
    <video src={m.url} controls playsInline preload="metadata" className={`${className} ${fit} bg-black`} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={m.url} alt="" className={`${className} ${fit}`} />
  );
}

/** LinkedIn and Facebook: caption above, media below, multi-image grid */
function StackedPreview({ platform, caption, media, accountName, logoUrl }: Props) {
  const info = PLATFORM_INFO[platform];
  const first = media[0];
  const ratio = first?.width && first?.height ? Math.min(Math.max(first.width / first.height, 0.8), 1.91) : 1;
  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white text-ink" aria-label={`${info.name} preview`}>
      <div className="flex items-center gap-2.5 px-3 pt-3">
        <Avatar logoUrl={logoUrl} name={accountName} size={platform === 'linkedin' ? 40 : 36} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold leading-tight">{accountName}</p>
          <p className="text-[12px] text-muted">{platform === 'linkedin' ? 'Company page' : 'Page'} · Just now</p>
        </div>
      </div>
      <div className="px-3 py-2.5"><FoldedCaption text={caption} foldAt={info.foldAt} /></div>
      {media.length === 1 && first && (
        <div className="bg-paper" style={{ aspectRatio: String(ratio) }}><MediaEl m={first} className="h-full w-full" cover /></div>
      )}
      {media.length === 2 && (
        <div className="grid grid-cols-2 gap-0.5">
          {media.map((m, i) => <div key={i} className="aspect-square bg-paper"><MediaEl m={m} className="h-full w-full" cover /></div>)}
        </div>
      )}
      {media.length > 2 && (
        <div className="space-y-0.5">
          <div className="aspect-[1.6] bg-paper"><MediaEl m={media[0]} className="h-full w-full" cover /></div>
          <div className={`grid gap-0.5 ${media.length === 3 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {media.slice(1, 4).map((m, i) => (
              <div key={i} className="relative aspect-square bg-paper">
                <MediaEl m={m} className="h-full w-full" cover />
                {i === 2 && media.length > 4 && (
                  <span className="absolute inset-0 grid place-items-center bg-black/50 text-xl font-semibold text-white">+{media.length - 4}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-around border-t border-line px-3 py-2 text-[12px] text-muted">
        <span>Like</span><span>Comment</span><span>{platform === 'linkedin' ? 'Repost' : 'Share'}</span>
      </div>
    </article>
  );
}

function InstagramPreview({ caption, media, accountName, logoUrl }: Props) {
  const [i, setI] = useState(0);
  const handle = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const first = media[0];
  // Instagram crops the whole carousel to the first item's shape, within 4:5 and 1.91:1
  const ratio = first?.width && first?.height ? Math.min(Math.max(first.width / first.height, 0.8), 1.91) : 1;
  const current = media[Math.min(i, media.length - 1)];
  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white text-ink" aria-label="Instagram preview">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar logoUrl={logoUrl} name={accountName} size={32} />
        <p className="text-[13px] font-semibold">{handle}</p>
      </div>
      <div className="relative bg-paper" style={{ aspectRatio: String(ratio) }}>
        {current ? <MediaEl m={current} className="h-full w-full" cover /> : (
          <span className="grid h-full place-items-center text-sm text-muted">Instagram needs an image or video</span>
        )}
        {media.length > 1 && (
          <>
            <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">{i + 1}/{media.length}</span>
            {i > 0 && <button type="button" onClick={() => setI(i - 1)} aria-label="Previous slide" className="absolute left-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow">‹</button>}
            {i < media.length - 1 && <button type="button" onClick={() => setI(i + 1)} aria-label="Next slide" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 shadow">›</button>}
          </>
        )}
      </div>
      {media.length > 1 && (
        <div className="flex justify-center gap-1 pt-2" aria-hidden>
          {media.map((_, j) => <span key={j} className={`h-1.5 w-1.5 rounded-full ${j === i ? 'bg-cobalt' : 'bg-line-strong'}`} />)}
        </div>
      )}
      <div className="px-3 pb-3 pt-2"><FoldedCaption text={caption} foldAt={PLATFORM_INFO.instagram.foldAt} prefix={handle} /></div>
    </article>
  );
}

function ReelPreview({ caption, media, accountName, logoUrl }: Props) {
  const v = media.find((m) => m.kind === 'video');
  const handle = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return (
    <article className="relative mx-auto aspect-[9/16] max-h-[640px] overflow-hidden rounded-lg bg-black text-white" aria-label="Instagram Reel preview">
      {v ? <video src={v.url} controls playsInline preload="metadata" className="h-full w-full object-cover" /> : (
        <span className="grid h-full place-items-center text-sm text-white/70">A Reel needs one video</span>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pb-14">
        <div className="flex items-center gap-2">
          <Avatar logoUrl={logoUrl} name={accountName} size={28} />
          <span className="text-[13px] font-semibold">{handle}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-[13px] leading-snug">{caption || 'No caption yet'}</p>
      </div>
    </article>
  );
}
