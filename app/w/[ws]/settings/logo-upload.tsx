'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setWorkspaceLogo } from '@/lib/actions';
import { createClient } from '@/lib/supabase/client';

export function LogoUpload({ workspaceId, logoUrl }: { workspaceId: string; logoUrl: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function onFile(file: File) {
    setBusy(true);
    setError('');
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${workspaceId}/logo/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await createClient().storage.from('media').upload(path, file, { contentType: file.type });
    if (upErr) {
      setError(upErr.message);
    } else {
      const r = await setWorkspaceLogo(workspaceId, path);
      if (r.error) setError(r.error);
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Current logo" className="h-16 w-16 rounded border border-line object-contain p-1" />
      ) : (
        <span className="grid h-16 w-16 place-items-center rounded border border-dashed border-line-strong text-xs text-muted">No logo</span>
      )}
      <div>
        <label className="btn btn-quiet btn-sm cursor-pointer">
          {busy ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
          <input
            type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
          />
        </label>
        <p className="hint mt-1">Shown to the client and on post previews. A square image works best.</p>
        {error && <p className="mt-1 text-sm text-red">{error}</p>}
      </div>
    </div>
  );
}
