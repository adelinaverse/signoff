import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from './supabase/server';
import type {
  Approval, CaptionSuggestion, Comment, MediaItem, MediaView, PlatformVersion, Post, PostVersion, Role, Workspace,
} from './types';

type Supa = Awaited<ReturnType<typeof createClient>>;

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: isAdmin } = await supabase.rpc('is_agency_admin');
  return { supabase, user, isAdmin: Boolean(isAdmin) };
});

export async function requireAdmin() {
  const session = await getSession();
  if (!session.isAdmin) redirect('/');
  return session;
}

export const getWorkspaceContext = cache(async (workspaceId: string) => {
  const session = await getSession();
  const { supabase, user, isAdmin } = session;
  const { data: workspace } = await supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle<Workspace>();
  if (!workspace) notFound();

  let role: Role = 'admin';
  if (!isAdmin) {
    const { data: m } = await supabase.from('workspace_members').select('role')
      .eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle<{ role: Role }>();
    if (!m) notFound();
    role = m.role;
  }

  const logoUrl = workspace.logo_path ? (await signUrls(supabase, [workspace.logo_path]))[workspace.logo_path] : null;
  return { ...session, workspace, role, logoUrl };
});

export async function signUrls(supabase: Supa, paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return {};
  const { data } = await supabase.storage.from('media').createSignedUrls(unique, 60 * 60 * 4);
  const out: Record<string, string> = {};
  for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  return out;
}

export async function withUrls(supabase: Supa, media: MediaItem[]): Promise<MediaView[]> {
  const urls = await signUrls(supabase, media.map((m) => m.storage_path));
  return media.map((m) => ({ ...m, url: urls[m.storage_path] ?? '' }));
}

const AUTHOR = 'author:profiles(email, full_name)';

export async function loadPost(supabase: Supa, postId: string) {
  const { data: post } = await supabase.from('posts').select('*').eq('id', postId).maybeSingle<Post>();
  if (!post) notFound();

  const [media, platforms, comments, suggestions, approvals, versions] = await Promise.all([
    supabase.from('media_items').select('*').eq('post_id', postId).order('position').returns<MediaItem[]>(),
    supabase.from('platform_versions').select('*').eq('post_id', postId).returns<PlatformVersion[]>(),
    supabase.from('comments').select(`*, ${AUTHOR}`).eq('post_id', postId).order('created_at').returns<Comment[]>(),
    supabase.from('caption_suggestions').select(`*, ${AUTHOR}`).eq('post_id', postId).order('created_at').returns<CaptionSuggestion[]>(),
    supabase.from('approvals').select(`*, ${AUTHOR}`).eq('post_id', postId).order('created_at').returns<Approval[]>(),
    supabase.from('post_versions').select('*').eq('post_id', postId).order('version', { ascending: false }).returns<PostVersion[]>(),
  ]);

  return {
    post,
    media: await withUrls(supabase, media.data ?? []),
    platforms: platforms.data ?? [],
    comments: comments.data ?? [],
    suggestions: suggestions.data ?? [],
    approvals: approvals.data ?? [],
    versions: versions.data ?? [],
  };
}

export type LoadedPost = Awaited<ReturnType<typeof loadPost>>;

export function displayName(p: { email: string; full_name: string | null } | null | undefined) {
  if (!p) return 'Someone';
  return p.full_name || p.email.split('@')[0];
}
