'use client';

import { useState, useTransition } from 'react';
import { emailApprovers } from '@/lib/actions';

export function EmailApproversButton({ workspaceId, count }: { workspaceId: string; count: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>();
  return (
    <span className="flex items-center gap-2">
      {msg && <span className={`text-sm ${msg.error ? 'text-red' : 'text-green'}`}>{msg.error ?? msg.ok}</span>}
      <button
        type="button"
        className="btn btn-quiet"
        disabled={pending}
        onClick={() => start(async () => setMsg(await emailApprovers(workspaceId)))}
        title="Sends one email listing every post waiting for approval"
      >
        {pending ? 'Sending…' : `Email client about ${count} waiting`}
      </button>
    </span>
  );
}
