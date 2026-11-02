/** Hashtags in a piece of text, as written (#WesternAustralia, #mining) */
export function extractHashtags(text: string): string[] {
  return [...text.matchAll(/(?:^|[^\p{L}\p{N}_&])(#[\p{L}\p{N}_]+)/gu)].map((m) => m[1]);
}

const key = (tag: string) => tag.toLowerCase();

export function hasHashtag(text: string, tag: string) {
  return extractHashtags(text).some((t) => key(t) === key(tag));
}

/** Adds a hashtag to the end of a caption, on the hashtag line if there is one */
export function addHashtag(text: string, tag: string) {
  if (hasHashtag(text, tag)) return text;
  const trimmed = text.replace(/\s+$/, '');
  if (!trimmed) return tag;
  const lastLine = trimmed.split('\n').at(-1) ?? '';
  const lastLineIsTags = lastLine.trim().split(/\s+/).every((w) => w.startsWith('#'));
  return lastLineIsTags ? `${trimmed} ${tag}` : `${trimmed}\n\n${tag}`;
}

/**
 * Takes a hashtag out of a caption. On a line of hashtags it's removed outright;
 * inside a sentence only the # goes, so "Proud of #AWE crew" reads "Proud of AWE crew".
 */
export function removeHashtag(text: string, tag: string) {
  const escaped = tag.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^\\p{L}\\p{N}_&])#(${escaped})(?![\\p{L}\\p{N}_])`, 'giu');
  const lines = text.split('\n').map((line) => {
    const words = line.trim().split(/\s+/).filter(Boolean);
    const tagsOnly = words.length > 0 && words.every((w) => w.startsWith('#'));
    if (tagsOnly) return words.filter((w) => w.toLowerCase() !== tag.toLowerCase()).join(' ');
    return line.replace(re, '$1$2');
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
}

export interface HashtagStat {
  tag: string;
  /** posts it has appeared in */
  posts: number;
  /** posts that were approved or later with it */
  approved: number;
  lastUsed: string;
}

/** Tally hashtags across a client's past captions, most useful first */
export function tallyHashtags(rows: { caption: string; post_id: string; status: string; updated_at: string }[]): HashtagStat[] {
  const byKey = new Map<string, { forms: Map<string, number>; posts: Set<string>; approved: Set<string>; lastUsed: string }>();
  for (const r of rows) {
    for (const tag of new Set(extractHashtags(r.caption))) {
      const k = key(tag);
      const e = byKey.get(k) ?? { forms: new Map(), posts: new Set(), approved: new Set(), lastUsed: r.updated_at };
      e.forms.set(tag, (e.forms.get(tag) ?? 0) + 1);
      e.posts.add(r.post_id);
      if (['approved', 'scheduled', 'published'].includes(r.status)) e.approved.add(r.post_id);
      if (r.updated_at > e.lastUsed) e.lastUsed = r.updated_at;
      byKey.set(k, e);
    }
  }
  return [...byKey.values()]
    .map((e) => ({
      // the spelling used most often wins (#WesternAustralia over #westernaustralia)
      tag: [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0],
      posts: e.posts.size,
      approved: e.approved.size,
      lastUsed: e.lastUsed,
    }))
    .sort((a, b) => (b.approved * 2 + b.posts) - (a.approved * 2 + a.posts) || b.lastUsed.localeCompare(a.lastUsed));
}
