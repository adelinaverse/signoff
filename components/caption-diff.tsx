import { diffWords } from '@/lib/diff';

export function CaptionDiff({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {parts.map((p, i) =>
        // added or removed blank lines read as layout, not as a change worth colouring
        p.type === 'same' || !p.text.trim() ? <span key={i}>{p.type === 'removed' ? '' : p.text}</span>
          : p.type === 'added' ? <ins key={i} className="rounded-sm bg-green-soft px-0.5 text-green no-underline decoration-green">{p.text}</ins>
            : <del key={i} className="rounded-sm bg-red-soft px-0.5 text-red">{p.text}</del>,
      )}
    </p>
  );
}
