'use client';

import { useMemo, useState } from 'react';
import { addHashtag, extractHashtags, hasHashtag, removeHashtag, type HashtagStat } from '@/lib/hashtags';

const SHOW = 16;

/**
 * Hashtags this client has used before, as chips under a caption.
 * Tap one to add it to the caption, tap again to take it out.
 */
export function HashtagPicker({ caption, onChange, memory, alsoInThisPost, platform }: {
  caption: string;
  onChange: (caption: string) => void;
  memory: HashtagStat[];
  /** hashtags in this post's other captions, offered first */
  alsoInThisPost: string[];
  platform: 'linkedin' | 'instagram' | 'facebook';
}) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const options = useMemo(() => {
    const seen = new Set<string>();
    const list: { tag: string; note: string }[] = [];
    const push = (tag: string, note: string) => {
      const k = tag.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      list.push({ tag, note });
    };
    for (const t of alsoInThisPost) push(t, 'In this post’s other captions');
    for (const m of memory) push(m.tag, `Used in ${m.posts} post${m.posts === 1 ? '' : 's'}${m.approved ? `, ${m.approved} approved` : ''}`);
    return list;
  }, [memory, alsoInThisPost]);

  const typed = query.trim().replace(/^#*/, '').replace(/[^\p{L}\p{N}_]/gu, '');
  const filtered = typed ? options.filter((o) => o.tag.toLowerCase().includes(typed.toLowerCase())) : options;
  const visible = showAll || typed ? filtered : filtered.slice(0, SHOW);
  const isNew = typed && !options.some((o) => o.tag.slice(1).toLowerCase() === typed.toLowerCase());
  const count = extractHashtags(caption).length;

  const toggle = (tag: string) => onChange(hasHashtag(caption, tag) ? removeHashtag(caption, tag) : addHashtag(caption, tag));

  return (
    <div className="mt-3 rounded-md border border-line bg-paper/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-semibold">
          Hashtags <span className="font-normal text-muted">{count} in this caption{platform === 'linkedin' && count > 5 ? ', LinkedIn works best with 3 to 5' : ''}</span>
        </p>
        <label className="sr-only" htmlFor={`tag-search-${platform}`}>Find or add a hashtag</label>
        <input
          id={`tag-search-${platform}`}
          className="field py-1.5 text-sm"
          placeholder="Find or add #tag"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && typed) {
              e.preventDefault();
              onChange(addHashtag(caption, `#${typed}`));
              setQuery('');
            }
          }}
        />
      </div>

      {options.length === 0 && !typed && (
        <p className="mt-2 text-sm text-muted">
          Hashtags you use for this client will show up here to reuse. Type one above and press Enter to add it.
        </p>
      )}

      {(visible.length > 0 || isNew) && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {isNew && (
            <li>
              <button type="button" onClick={() => { onChange(addHashtag(caption, `#${typed}`)); setQuery(''); }}
                className="rounded-full border border-dashed border-ink px-2.5 py-1 text-sm hover:bg-surface">
                Add #{typed}
              </button>
            </li>
          )}
          {visible.map((o) => {
            const on = hasHashtag(caption, o.tag);
            return (
              <li key={o.tag}>
                <button
                  type="button"
                  aria-pressed={on}
                  title={o.note}
                  onClick={() => toggle(o.tag)}
                  className={`rounded-full border px-2.5 py-1 text-sm ${on ? 'border-ink bg-ink text-white' : 'border-line-strong bg-surface hover:border-ink'}`}
                >
                  {o.tag}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!typed && filtered.length > SHOW && (
        <button type="button" className="btn btn-ghost btn-sm mt-1 -ml-2" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show fewer' : `Show all ${filtered.length}`}
        </button>
      )}
    </div>
  );
}
