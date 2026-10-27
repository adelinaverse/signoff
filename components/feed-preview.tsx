'use client';

import { useLayoutEffect, useRef, useState } from 'react';
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

/** How the post sits in each feed, so the client approves it in context. */
export function FeedPreview(props: Props) {
  if (props.platform === 'instagram') return props.isReel ? <ReelPreview {...props} /> : <InstagramPreview {...props} />;
  if (props.platform === 'linkedin') return <LinkedInPreview {...props} />;
  return <FacebookPreview {...props} />;
}

// The feeds use the phone's own font, so the preview does too
const FEED_FONT = { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' };

const ratioOf = (m?: PreviewMedia) => (m?.width && m?.height ? m.width / m.height : 1);
const clamp = (r: number, lo: number, hi: number) => Math.min(Math.max(r, lo), hi);

function Avatar({ logoUrl, name, size, square }: { logoUrl: string | null; name: string; size: number; square?: boolean }) {
  const shape = square ? 'rounded-[3px]' : 'rounded-full';
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className={`shrink-0 bg-white object-cover ${shape}`} style={{ width: size, height: size }} />
  ) : (
    <span className={`grid shrink-0 place-items-center bg-ink font-bold text-white ${shape}`} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.slice(0, 1)}
    </span>
  );
}

/** Caption cut off after a set number of lines with "…more" sitting at the end, as the feeds do it */
function ClampedCaption({ text, lines, prefix, className = '' }: { text: string; lines: number; prefix?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, open, lines]);

  return (
    <div className={className}>
      <div className="relative">
      <p
        ref={ref}
        className="whitespace-pre-wrap break-words"
        style={open ? undefined : { display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        {prefix && <span className="mr-1 font-semibold">{prefix}</span>}
        {text || <span className="text-[#666]">No caption yet</span>}
      </p>
      {overflows && !open && (
        <button type="button" onClick={() => setOpen(true)}
          className="absolute bottom-0 right-0 bg-white pl-1 text-[#666] hover:text-[#0a66c2] hover:underline">
          …more
        </button>
      )}
      </div>
    </div>
  );
}

function Tile({ m, className = '', more, style }: { m: PreviewMedia; className?: string; more?: number; style?: React.CSSProperties }) {
  return (
    <div style={style} className={`relative min-h-0 overflow-hidden bg-[#f3f2ef] ${className}`}>
      {m.kind === 'video' ? (
        <video src={m.url} controls playsInline preload="metadata" className="h-full w-full bg-black object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.url} alt="" className="h-full w-full object-cover" />
      )}
      {more ? <span className="absolute inset-0 grid place-items-center bg-black/40 text-[28px] font-semibold text-white">+{more}</span> : null}
    </div>
  );
}

/**
 * Multi-image grid, matched to AWE's real LinkedIn posts. One image keeps its own shape
 * (within the feed's limits). Two portrait images sit side by side at full 4:5. Three or more:
 * the first large on the left, up to three stacked on the right, the last showing how many more.
 */
function Grid({ media, portraitLayout }: { media: PreviewMedia[]; portraitLayout: boolean }) {
  const n = media.length;
  if (n === 0) return null;
  if (n === 1) {
    const r = clamp(ratioOf(media[0]), 0.8, 1.91);
    return <div style={{ aspectRatio: String(r) }}><Tile m={media[0]} className="h-full w-full" /></div>;
  }
  if (n === 2) {
    return (
      <div className="grid grid-cols-2 gap-[2px]" style={{ aspectRatio: portraitLayout ? String(2 * clamp(ratioOf(media[0]), 0.8, 1)) : '2 / 1' }}>
        {media.map((m, i) => <Tile key={i} m={m} className="h-full" />)}
      </div>
    );
  }
  const rest = media.slice(1, 4);
  const extra = n - 4;
  if (portraitLayout) {
    // Large first image on the left, up to three stacked on the right
    return (
      <div className="grid gap-[2px]" style={{ aspectRatio: '6 / 5', gridTemplateColumns: '2fr 1fr', gridTemplateRows: `repeat(${rest.length}, 1fr)` }}>
        <Tile m={media[0]} className="h-full" style={{ gridRow: '1 / -1' }} />
        {rest.map((m, i) => <Tile key={i} m={m} className="h-full" more={i === rest.length - 1 && extra > 0 ? extra : undefined} />)}
      </div>
    );
  }
  // Wide first image across the top, the rest in a row underneath
  return (
    <div className="space-y-[2px]">
      <div style={{ aspectRatio: String(clamp(ratioOf(media[0]), 1.2, 1.91)) }}><Tile m={media[0]} className="h-full w-full" /></div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${rest.length}, 1fr)` }}>
        {rest.map((m, i) => <Tile key={i} m={m} className="aspect-square" more={i === rest.length - 1 && extra > 0 ? extra : undefined} />)}
      </div>
    </div>
  );
}

const Icon = {
  like: <path d="M7 10v10H4V10h3zm2 10h8.2a2 2 0 0 0 2-1.6l1.2-6A2 2 0 0 0 18.4 10H14V6.5A2.5 2.5 0 0 0 11.5 4L9 10v10z" />,
  comment: <path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />,
  repost: <path d="M7 7h10l-2.5-2.5M17 17H7l2.5 2.5M5 10v-1a2 2 0 0 1 2-2M19 14v1a2 2 0 0 1-2 2" />,
  send: <path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" />,
  share: <path d="M14 5l7 7-7 7v-4c-6 0-9 2-11 5 1-6 4-10 11-11V5z" />,
};

function Action({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5 px-2 py-3 text-[14px] font-semibold text-[#666]">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{icon}</svg>
      {label}
    </span>
  );
}

function LinkedInPreview({ caption, media, accountName, logoUrl }: Props) {
  const portrait = ratioOf(media[0]) < 1;
  return (
    <article style={FEED_FONT} className="overflow-hidden rounded-lg border border-[#dcdad6] bg-white text-[rgba(0,0,0,0.9)]" aria-label="LinkedIn preview">
      <div className="flex items-start gap-2 px-4 pt-3">
        <Avatar logoUrl={logoUrl} name={accountName} size={48} square />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[14px] font-semibold">{accountName}</p>
          <p className="text-[12px] text-[#666]">Followers</p>
          <p className="flex items-center gap-1 text-[12px] text-[#666]">
            Now <span aria-hidden>•</span>
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-label="Public"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm4.9 6h-2a11 11 0 0 0-.8-3.9A5.5 5.5 0 0 1 12.9 7zM8 2.6c.6.8 1.2 2.3 1.4 4.4H6.6C6.8 4.9 7.4 3.4 8 2.6zM5.9 3.1A11 11 0 0 0 5.1 7h-2a5.5 5.5 0 0 1 2.8-3.9zM3.1 9h2c.1 1.4.4 2.8.8 3.9A5.5 5.5 0 0 1 3.1 9zM8 13.4c-.6-.8-1.2-2.3-1.4-4.4h2.8c-.2 2.1-.8 3.6-1.4 4.4zm2.1-.5c.4-1.1.7-2.5.8-3.9h2a5.5 5.5 0 0 1-2.8 3.9z"/></svg>
          </p>
        </div>
        <span className="text-[20px] leading-none text-[#666]" aria-hidden>···</span>
      </div>
      <ClampedCaption text={caption} lines={3} className="px-4 pb-2 pt-3 text-[14px] leading-[1.43]" />
      <Grid media={media} portraitLayout={portrait} />
      <div className="mx-4 flex items-center justify-between border-b border-[#e8e8e8] py-2 text-[12px] text-[#666]">
        <span className="flex items-center gap-1">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-[#378fe9]">
            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="white" aria-hidden>{Icon.like}</svg>
          </span>
          Reactions
        </span>
        <span>Reposts</span>
      </div>
      <div className="flex justify-around px-2">
        <Action icon={Icon.like} label="Like" />
        <Action icon={Icon.comment} label="Comment" />
        <Action icon={Icon.repost} label="Repost" />
        <Action icon={Icon.send} label="Send" />
      </div>
    </article>
  );
}

function FacebookPreview({ caption, media, accountName, logoUrl }: Props) {
  const portrait = ratioOf(media[0]) < 1;
  return (
    <article style={FEED_FONT} className="overflow-hidden rounded-lg border border-[#dddfe2] bg-white text-[#050505]" aria-label="Facebook preview">
      <div className="flex items-center gap-2 px-4 pt-3">
        <Avatar logoUrl={logoUrl} name={accountName} size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[15px] font-semibold">{accountName}</p>
          <p className="text-[13px] text-[#65676b]">Just now · Public</p>
        </div>
        <span className="text-[20px] leading-none text-[#65676b]" aria-hidden>···</span>
      </div>
      <ClampedCaption text={caption} lines={5} className="px-4 pb-3 pt-2 text-[15px] leading-[1.33]" />
      <Grid media={media} portraitLayout={portrait} />
      <div className="mx-4 flex justify-around border-t border-[#ced0d4]">
        <Action icon={Icon.like} label="Like" />
        <Action icon={Icon.comment} label="Comment" />
        <Action icon={Icon.share} label="Share" />
      </div>
    </article>
  );
}

function InstagramPreview({ caption, media, accountName, logoUrl }: Props) {
  const [i, setI] = useState(0);
  const handle = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  // Instagram crops the whole carousel to the first item's shape, within 4:5 and 1.91:1
  const ratio = clamp(ratioOf(media[0]), 0.8, 1.91);
  const current = media[Math.min(i, media.length - 1)];
  return (
    <article style={FEED_FONT} className="overflow-hidden rounded-lg border border-[#dbdbdb] bg-white text-[#0c1014]" aria-label="Instagram preview">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar logoUrl={logoUrl} name={accountName} size={32} />
        <p className="flex-1 text-[14px] font-semibold">{handle}</p>
        <span className="text-[18px] leading-none" aria-hidden>···</span>
      </div>
      <div className="relative bg-[#efefef]" style={{ aspectRatio: String(ratio) }}>
        {current ? <Tile m={current} className="h-full w-full" /> : (
          <span className="grid h-full place-items-center text-sm text-[#737373]">Instagram needs an image or video</span>
        )}
        {media.length > 1 && (
          <>
            <span className="absolute right-3 top-3 rounded-full bg-black/70 px-2 py-0.5 text-[12px] font-semibold text-white">{i + 1}/{media.length}</span>
            {i > 0 && <button type="button" onClick={() => setI(i - 1)} aria-label="Previous slide" className="absolute left-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-[#262626] shadow">‹</button>}
            {i < media.length - 1 && <button type="button" onClick={() => setI(i + 1)} aria-label="Next slide" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/80 text-[#262626] shadow">›</button>}
          </>
        )}
      </div>
      <div className="flex items-center gap-4 px-3 pt-2.5" aria-hidden>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 12a8 8 0 1 1-3-6.2L20 4l-.8 4A8 8 0 0 1 20 12z" /></svg>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z" /></svg>
        {media.length > 1 && (
          <span className="mx-auto flex gap-1 pr-14">
            {media.map((_, j) => <span key={j} className={`h-1.5 w-1.5 rounded-full ${j === i ? 'bg-[#0095f6]' : 'bg-[#c7c7c7]'}`} />)}
          </span>
        )}
      </div>
      <ClampedCaption text={caption} lines={2} prefix={handle} className="px-3 pb-3 pt-2 text-[14px] leading-[1.3]" />
    </article>
  );
}

function ReelPreview({ caption, media, accountName, logoUrl }: Props) {
  const v = media.find((m) => m.kind === 'video');
  const handle = accountName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return (
    <article style={FEED_FONT} className="relative mx-auto aspect-[9/16] max-h-[640px] overflow-hidden rounded-lg bg-black text-white" aria-label="Instagram Reel preview">
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
