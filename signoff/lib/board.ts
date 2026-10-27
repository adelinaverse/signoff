import 'server-only';
import { signUrls } from './data';
import type { createClient } from './supabase/server';
import type { Platform, Post } from './types';

export interface BoardPost extends Post {
  media_items: { storage_path: string; kind: 'image' | 'video'; position: number }[];
  platform_versions: { platform: Platform; is_reel: boolean }[];
  thumbUrl?: string;
}

/** Posts for a workspace with their first image or video signed for display */
export async function loadBoardPosts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  range?: { from: string; to: string },
) {
  let q = supabase.from('posts')
    .select('*, media_items(storage_path, kind, position), platform_versions(platform, is_reel)')
    .eq('workspace_id', workspaceId);
  if (range) q = q.gte('planned_at', range.from).lt('planned_at', range.to);
  const { data } = await q.order('planned_at', { ascending: true, nullsFirst: false }).returns<BoardPost[]>();
  const posts = (data ?? []).map((p) => ({ ...p, media_items: [...p.media_items].sort((a, b) => a.position - b.position) }));
  const urls = await signUrls(supabase, posts.map((p) => p.media_items[0]?.storage_path ?? ''));
  return posts.map((p) => ({ ...p, thumbUrl: p.media_items[0] ? urls[p.media_items[0].storage_path] : undefined }));
}
