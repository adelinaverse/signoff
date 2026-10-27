export function PostThumb({ url, kind, count, size = 56 }: { url?: string; kind?: 'image' | 'video'; count: number; size?: number }) {
  return (
    <span className="relative block shrink-0 overflow-hidden rounded bg-paper" style={{ width: size, height: size }}>
      {url && kind === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      )}
      {url && kind === 'video' && (
        <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      )}
      {!url && <span className="grid h-full w-full place-items-center text-[11px] text-muted">Text</span>}
      {kind === 'video' && (
        <span className="absolute bottom-1 left-1 grid h-4 w-4 place-items-center rounded-full bg-ink/80">
          <svg viewBox="0 0 10 10" className="h-2 w-2 fill-white" aria-hidden><path d="M3 2l5 3-5 3z" /></svg>
        </span>
      )}
      {count > 1 && (
        <span className="absolute right-1 top-1 rounded bg-ink/80 px-1 text-[10px] font-semibold text-white">{count}</span>
      )}
    </span>
  );
}
