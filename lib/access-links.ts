import 'server-only';
import { randomBytes } from 'node:crypto';
import type { createClient } from './supabase/server';

type Supa = Awaited<ReturnType<typeof createClient>>;

export interface PersonLink {
  email: string;
  token: string;
}

const newToken = () => randomBytes(24).toString('base64url');

/**
 * Direct sign-in links for the given people in a workspace, creating any that are missing.
 * Agency admins only (row level security enforces it).
 */
export async function ensureAccessLinks(supabase: Supa, workspaceId: string, emails: string[]): Promise<PersonLink[]> {
  const wanted = [...new Set(emails.map((e) => e.toLowerCase()))];
  if (wanted.length === 0) return [];

  const { data: existing } = await supabase.from('access_links').select('email, token').eq('workspace_id', workspaceId);
  const have = new Map((existing ?? []).map((l) => [l.email.toLowerCase(), l.token as string]));

  const missing = wanted.filter((e) => !have.has(e));
  if (missing.length) {
    const rows = missing.map((email) => ({ workspace_id: workspaceId, email, token: newToken() }));
    const { error } = await supabase.from('access_links').upsert(rows, { onConflict: 'workspace_id,email', ignoreDuplicates: true });
    if (!error) {
      const { data: again } = await supabase.from('access_links').select('email, token').eq('workspace_id', workspaceId).in('email', missing);
      for (const l of again ?? []) have.set(l.email.toLowerCase(), l.token);
    }
  }

  return wanted.filter((e) => have.has(e)).map((email) => ({ email, token: have.get(email)! }));
}

/** Everyone who can approve in a workspace, signed in already or still invited */
export async function approverEmails(supabase: Supa, workspaceId: string) {
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from('workspace_members').select('profile:profiles(email)').eq('workspace_id', workspaceId).eq('role', 'approver')
      .returns<{ profile: { email: string } | null }[]>(),
    supabase.from('workspace_invites').select('email').eq('workspace_id', workspaceId).eq('role', 'approver'),
  ]);
  return [
    ...(members ?? []).map((m) => m.profile?.email).filter((e): e is string => Boolean(e)),
    ...(invites ?? []).map((i) => i.email as string),
  ];
}

/** A direct link for one person that opens the given page in the app */
export const directPath = (token: string, next: string) => `/r/${token}?next=${encodeURIComponent(next)}`;
