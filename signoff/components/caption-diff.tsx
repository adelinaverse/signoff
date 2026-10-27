import { diffWords } from '@/lib/diff';

export function CaptionDiff({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {parts.map((p, i) =>
        p.type === 'same' ? <span key={i}>{p.text}</span>
          : p.type === 'added' ? <ins key={i} className="rounded-sm bg-green-soft px-0.5 text-green no-underline decoration-green">{p.text}</ins>
            : <del key={i} className="rounded-sm bg-red-soft px-0.5 text-red">{p.text}</del>,
      )}
    </p>
  );
}
