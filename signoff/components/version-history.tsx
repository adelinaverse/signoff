'use client';

import { useState } from 'react';
import { PLATFORM_INFO } from '@/lib/platforms';
import { formatShort } from '@/lib/time';
import type { Platform } from '@/lib/types';
import { CaptionDiff } from './caption-diff';

export interface VersionView {
  version: number;
  sent_at: string;
  media: { url: string; kind: 'image' | 'video'; storage_path: string }[];
  platforms: { platform: Platform; caption: string; is_reel: boolean }[];
}

export function VersionHistory({ versions, timezone }: { versions: VersionView[]; timezone: string }) {
  const [selected, setSelected] = useState(versions[0]?.version);
  if (versions.length === 0) return <p className="text-sm text-muted">Nothing has been sent for approval yet.</p>;

  const current = versions.find((v) => v.version === selected) ?? versions[0];
  const previous = versions.find((v) => v.version === current.version - 1);
  const mediaChanged = previous && previous.media.map((m) => m.storage_path).join() !== current.media.map((m) => m.storage_path).join();

  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Versions">
        {versions.map((v) => (
          <button key={v.version} type="button" role="tab" aria-selected={v.version === current.version}
            onClick={() => setSelected(v.version)}
            className={`rounded-full border px-3 py-1 text-sm ${v.version === current.version ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface hover:border-ink'}`}>
            Version {v.version}
          </button>
        ))}
      </div>
      <p className="hint mt-2">
        Sent {formatShort(current.sent_at, timezone)}.
        {previous ? ' Changes since the version before are highlighted.' : ' This was the first version sent.'}
      </p>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {current.media.map((m, i) => (
          <span key={i} className="h-16 w-16 shrink-0 overflow-hidden rounded bg-paper">
            {m.kind === 'image'
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={m.url} alt="" className="h-full w-full object-cover" />
              : <video src={`${m.url}#t=0.1`} muted preload="metadata" className="h-full w-full object-cover" />}
          </span>
        ))}
        {current.media.length === 0 && <span className="text-sm text-muted">No media</span>}
      </div>
      {mediaChanged && <p className="mt-1 text-sm font-semibold text-amber">The imagery changed in this version.</p>}

      <div className="mt-3 space-y-3">
        {current.platforms.map((p) => {
          const before = previous?.platforms.find((x) => x.platform === p.platform)?.caption;
          return (
            <div key={p.platform} className="rounded-md border border-line bg-surface p-3">
              <p className="mb-1 text-xs font-semibold text-muted">{PLATFORM_INFO[p.platform].name}{p.is_reel ? ' Reel' : ''}</p>
              {before != null && before !== p.caption
                ? <CaptionDiff before={before} after={p.caption} />
                : <p className="whitespace-pre-wrap break-words text-sm">{p.caption}{before != null && <span className="ml-2 text-muted">(unchanged)</span>}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
