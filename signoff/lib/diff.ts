export type DiffPart = { type: 'same' | 'added' | 'removed'; text: string };

/** Word-level diff (longest common subsequence), keeping whitespace attached to words. */
export function diffWords(before: string, after: string): DiffPart[] {
  // words, runs of whitespace, and single punctuation marks are separate tokens
  const TOKEN = /\s+|[\p{L}\p{N}#@'’_-]+|[^\s\p{L}\p{N}]/gu;
  const a = before.match(TOKEN) ?? [];
  const b = after.match(TOKEN) ?? [];
  const n = a.length;
  const m = b.length;

  // Guard against very long captions: fall back to a whole-text replace.
  if (n * m > 400_000) {
    return [
      ...(before ? [{ type: 'removed' as const, text: before }] : []),
      ...(after ? [{ type: 'added' as const, text: after }] : []),
    ];
  }

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (type: DiffPart['type'], text: string) => {
    const last = parts.at(-1);
    if (last && last.type === type) last.text += text;
    else parts.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push('same', a[i]); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { push('removed', a[i]); i++; }
    else { push('added', b[j]); j++; }
  }
  while (i < n) push('removed', a[i++]);
  while (j < m) push('added', b[j++]);
  return parts;
}
