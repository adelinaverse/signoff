'use client';

import { useEffect, useState } from 'react';

/** Copies a link to this app (path only, the current address is added) and says so. */
export function CopyLink({ path, label = 'Copy link', className = 'btn btn-quiet btn-sm' }: { path: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link', url);
    }
    setCopied(true);
  }

  return (
    <button type="button" className={className} onClick={copy} aria-live="polite">
      {copied ? 'Link copied' : label}
    </button>
  );
}

/** The full address shown as text, so it can be seen and selected too. */
export function LinkText({ path }: { path: string }) {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  return <code className="block truncate rounded bg-paper px-2 py-1.5 text-[13px]">{origin}{path}</code>;
}
