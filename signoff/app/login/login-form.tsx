'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({ next, defaultEmail }: { next?: string; defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    const supabase = createClient();
    const redirect = new URL('/auth/callback', window.location.origin);
    if (next?.startsWith('/')) redirect.searchParams.set('next', next);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirect.toString() },
    });
    if (error) {
      setState('error');
      setMessage(error.message);
    } else {
      setState('sent');
    }
  }

  if (state === 'sent') {
    return (
      <div className="mt-8 rounded-lg border border-line bg-surface p-5">
        <p className="font-semibold">Check your email</p>
        <p className="mt-1 text-sm text-muted">
          We sent a sign-in link to <span className="text-ink">{email}</span>. Open it on this device to continue.
        </p>
        <button type="button" className="btn btn-ghost btn-sm mt-3 -ml-2" onClick={() => setState('idle')}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input
          id="email" type="email" required autoComplete="email" autoFocus
          className="field" value={email} onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {state === 'error' && <p className="text-sm text-red">{message}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending link…' : 'Email me a sign-in link'}
      </button>
    </form>
  );
}
