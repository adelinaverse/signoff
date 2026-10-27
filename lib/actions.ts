'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSession, requireAdmin } from './data';
import { digestHtml, sendEmail, SITE_URL, APP_NAME } from './email';
import { checkPlatform, PLATFORMS } from './platforms';
import { localInputToUtc } from './time';
import type { Decision, MediaItem, MemberRole, Platform, PlatformVersion, Post, VersionSnapshot } from './types';

type Result = { error?: string; ok?: string };

const EDITABLE: Post['status'][] = ['draft', 'changes_requested', 'rejected'];

async function getPost(postId: string) {
  const { supabase } = await getSession();
  const { data } = await supabase.from('posts').select('*').eq('id', postId).maybeSingle<Post>();
  if (!data) throw new Error('Post not found');
  return data;
}

function refresh(workspaceId: string, postId?: string) {
  revalidatePath(`/w/${workspaceId}`, 'layout');
  if (postId) revalidatePath(`/w/${workspaceId}/posts/${postId}`);
}

// ---------------------------------------------------------------------------
// Workspaces and people
// ---------------------------------------------------------------------------
export async function createWorkspace(formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = String(formData.get('name') || '').trim();
  if (!name) return;
  const { data, error } = await supabase.from('workspaces').insert({ name }).select('id').single();
  if (error) throw new Error(error.message);
  redirect(`/w/${data.id}/settings`);
}

export async function updateWorkspace(workspaceId: string, formData: FormData): Promise<Result> {
  const { supabase } = await requireAdmin();
  const name = String(formData.get('name') || '').trim();
  const timezone = String(formData.get('timezone') || 'Australia/Perth');
  if (!name) return { error: 'Give the workspace a name.' };
  const { error } = await supabase.from('workspaces').update({ name, timezone }).eq('id', workspaceId);
  if (error) return { error: error.message };
  refresh(workspaceId);
  return { ok: 'Saved' };
}

export async function setWorkspaceLogo(workspaceId: string, path: string | null): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('workspaces').update({ logo_path: path }).eq('id', workspaceId);
  if (error) return { error: error.message };
  refresh(workspaceId);
  return { ok: 'Logo updated' };
}

export async function inviteMember(workspaceId: string, formData: FormData): Promise<Result> {
  const { supabase } = await requireAdmin();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const role = (String(formData.get('role') || 'approver') as MemberRole);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.' };

  const { data: existing } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle<{ id: string }>();
  const { error } = existing
    ? await supabase.from('workspace_members').upsert({ workspace_id: workspaceId, user_id: existing.id, role })
    : await supabase.from('workspace_invites').upsert({ workspace_id: workspaceId, email, role });
  if (error) return { error: error.message };

  const { data: ws } = await supabase.from('workspaces').select('name').eq('id', workspaceId).single();
  const mail = await sendEmail(
    [email],
    `You've been invited to review ${ws?.name ?? 'posts'}`,
    digestHtml({
      intro: `You've been added to ${ws?.name ?? 'a workspace'} on ${APP_NAME}, where you'll review and approve social posts before they go out.`,
      items: [role === 'approver' ? 'You can approve posts, request changes and suggest caption edits.' : 'You can see the content calendar and leave comments.'],
      buttonLabel: 'Sign in',
      buttonUrl: `${SITE_URL}/login?email=${encodeURIComponent(email)}`,
    }),
  );
  refresh(workspaceId);
  return { ok: mail.sent ? `Invite sent to ${email}` : `Added ${email}. They can sign in at ${SITE_URL}/login (${mail.reason.toLowerCase()}).` };
}

export async function removeMember(workspaceId: string, userId: string) {
  const { supabase } = await requireAdmin();
  await supabase.from('workspace_members').delete().eq('workspace_id', workspaceId).eq('user_id', userId);
  refresh(workspaceId);
}

export async function cancelInvite(workspaceId: string, email: string) {
  const { supabase } = await requireAdmin();
  await supabase.from('workspace_invites').delete().eq('workspace_id', workspaceId).eq('email', email);
  refresh(workspaceId);
}

export async function updateMyName(formData: FormData) {
  const { supabase, user } = await getSession();
  const full_name = String(formData.get('full_name') || '').trim() || null;
  await supabase.from('profiles').update({ full_name }).eq('id', user.id);
  revalidatePath('/', 'layout');
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------
export async function createPost(workspaceId: string, formData?: FormData) {
  const { supabase, user } = await requireAdmin();
  const date = formData ? String(formData.get('date') || '') : '';
  let planned_at: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const { data: ws } = await supabase.from('workspaces').select('timezone').eq('id', workspaceId).single();
    planned_at = localInputToUtc(`${date}T09:00`, ws?.timezone ?? 'Australia/Perth');
  }
  const { data, error } = await supabase.from('posts')
    .insert({ workspace_id: workspaceId, created_by: user.id, planned_at })
    .select('id').single();
  if (error) throw new Error(error.message);
  redirect(`/w/${workspaceId}/posts/${data.id}`);
}

export interface SavePostInput {
  title: string;
  contextNote: string;
  plannedLocal: string;
  platforms: { platform: Platform; caption: string; is_reel: boolean }[];
}

export async function savePost(postId: string, input: SavePostInput): Promise<Result> {
  const { supabase } = await requireAdmin();
  const post = await getPost(postId);
  const { data: ws } = await supabase.from('workspaces').select('timezone').eq('id', post.workspace_id).single();

  const planned_at = input.plannedLocal ? localInputToUtc(input.plannedLocal, ws?.timezone ?? 'Australia/Perth') : null;
  const { error } = await supabase.from('posts').update({
    title: input.title.trim() || 'Untitled post',
    context_note: input.contextNote.trim() || null,
    planned_at,
    updated_at: new Date().toISOString(),
  }).eq('id', postId);
  if (error) return { error: error.message };

  // Captions and platforms only change while the post is with the agency
  if (EDITABLE.includes(post.status)) {
    const chosen = input.platforms.filter((p) => PLATFORMS.includes(p.platform));
    const keep = chosen.map((p) => p.platform);
    if (keep.length) {
      const { error: upErr } = await supabase.from('platform_versions').upsert(
        chosen.map((p) => ({
          post_id: postId, platform: p.platform, caption: p.caption,
          is_reel: p.platform === 'instagram' && p.is_reel, updated_at: new Date().toISOString(),
        })),
        { onConflict: 'post_id,platform' },
      );
      if (upErr) return { error: upErr.message };
    }
    let del = supabase.from('platform_versions').delete().eq('post_id', postId);
    if (keep.length) del = del.not('platform', 'in', `(${keep.join(',')})`);
    await del;
  }

  refresh(post.workspace_id, postId);
  return { ok: 'Saved' };
}

export async function addMedia(postId: string, items: Omit<MediaItem, 'id' | 'post_id' | 'position'>[]): Promise<Result> {
  const { supabase } = await requireAdmin();
  const post = await getPost(postId);
  if (!EDITABLE.includes(post.status)) return { error: 'Move the post back to draft before changing media.' };
  const { data: last } = await supabase.from('media_items').select('position').eq('post_id', postId)
    .order('position', { ascending: false }).limit(1).maybeSingle<{ position: number }>();
  const start = (last?.position ?? -1) + 1;
  const { error } = await supabase.from('media_items').insert(items.map((m, i) => ({ ...m, post_id: postId, position: start + i })));
  if (error) return { error: error.message };
  refresh(post.workspace_id, postId);
  return { ok: 'Added' };
}

export async function removeMedia(mediaId: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { data: m } = await supabase.from('media_items').select('post_id').eq('id', mediaId).single();
  if (!m) return { error: 'Not found' };
  const post = await getPost(m.post_id);
  if (!EDITABLE.includes(post.status)) return { error: 'Move the post back to draft before changing media.' };
  // The file stays in storage so earlier versions can still be viewed.
  await supabase.from('media_items').delete().eq('id', mediaId);
  refresh(post.workspace_id, post.id);
  return {};
}

export async function moveMedia(mediaId: string, direction: -1 | 1): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { data: m } = await supabase.from('media_items').select('post_id').eq('id', mediaId).single();
  if (!m) return { error: 'Not found' };
  const post = await getPost(m.post_id);
  if (!EDITABLE.includes(post.status)) return { error: 'Move the post back to draft before changing media.' };
  const { data: all } = await supabase.from('media_items').select('id, position').eq('post_id', m.post_id).order('position');
  const list = (all ?? []).map((x) => x.id);
  const i = list.indexOf(mediaId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return {};
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((id, position) => supabase.from('media_items').update({ position }).eq('id', id)));
  refresh(post.workspace_id, post.id);
  return {};
}

export async function sendForApproval(postId: string): Promise<Result> {
  const { supabase, user } = await requireAdmin();
  const post = await getPost(postId);
  if (!EDITABLE.includes(post.status)) return { error: 'Only drafts and posts with requested changes can be sent.' };

  const [{ data: media }, { data: pvs }] = await Promise.all([
    supabase.from('media_items').select('*').eq('post_id', postId).order('position').returns<MediaItem[]>(),
    supabase.from('platform_versions').select('*').eq('post_id', postId).returns<PlatformVersion[]>(),
  ]);
  if (!pvs?.length) return { error: 'Choose at least one platform and write its caption.' };
  for (const pv of pvs) {
    const blocking = checkPlatform(pv, media ?? []).filter((c) => c.level === 'error');
    if (blocking.length) return { error: `${pv.platform[0].toUpperCase() + pv.platform.slice(1)}: ${blocking[0].message}` };
  }

  const version = post.version + 1;
  const snapshot: VersionSnapshot = {
    title: post.title,
    media: (media ?? []).map((m) => ({ storage_path: m.storage_path, kind: m.kind, width: m.width, height: m.height })),
    platforms: pvs.map((p) => ({ platform: p.platform, caption: p.caption, is_reel: p.is_reel })),
  };
  const { error: vErr } = await supabase.from('post_versions').insert({ post_id: postId, version, snapshot, sent_by: user.id });
  if (vErr) return { error: vErr.message };

  const now = new Date().toISOString();
  await supabase.from('posts').update({ status: 'ready', version, sent_at: now, updated_at: now }).eq('id', postId);
  // Suggestions on the previous version that were never answered are closed off
  await supabase.from('caption_suggestions').update({ status: 'rejected' }).eq('post_id', postId).eq('status', 'pending');
  refresh(post.workspace_id, postId);
  return { ok: version === 1 ? 'Sent for approval' : `Version ${version} sent for approval` };
}

export async function setStatus(postId: string, status: 'draft' | 'approved' | 'scheduled' | 'published'): Promise<Result> {
  const { supabase } = await requireAdmin();
  const post = await getPost(postId);
  const allowed: Record<typeof status, Post['status'][]> = {
    draft: ['ready', 'approved', 'rejected', 'changes_requested'],
    approved: ['scheduled', 'published'],
    scheduled: ['approved', 'published'],
    published: ['approved', 'scheduled'],
  };
  if (!allowed[status].includes(post.status)) return { error: 'That move is not available for this post.' };
  await supabase.from('posts').update({ status, updated_at: new Date().toISOString() }).eq('id', postId);
  refresh(post.workspace_id, postId);
  return {};
}

export async function deletePost(postId: string) {
  const { supabase } = await requireAdmin();
  const post = await getPost(postId);
  await supabase.from('posts').delete().eq('id', postId);
  refresh(post.workspace_id);
  redirect(`/w/${post.workspace_id}`);
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------
export interface CommentInput {
  body: string;
  mediaItemId?: string | null;
  pinX?: number | null;
  pinY?: number | null;
  atSeconds?: number | null;
  platform?: Platform | null;
}

export async function addComment(postId: string, input: CommentInput): Promise<Result> {
  const { supabase, user } = await getSession();
  const body = input.body.trim();
  if (!body) return { error: 'Write a comment first.' };
  const post = await getPost(postId);
  const { error } = await supabase.from('comments').insert({
    post_id: postId,
    version: post.version,
    author_id: user.id,
    body,
    media_item_id: input.mediaItemId ?? null,
    pin_x: input.pinX ?? null,
    pin_y: input.pinY ?? null,
    at_seconds: input.atSeconds ?? null,
    platform: input.platform ?? null,
  });
  if (error) return { error: error.message };
  refresh(post.workspace_id, postId);
  return {};
}

export async function setCommentResolved(commentId: string, resolved: boolean): Promise<Result> {
  const { supabase } = await getSession();
  const { data, error } = await supabase.from('comments').update({ resolved }).eq('id', commentId).select('post_id').single();
  if (error) return { error: 'You can only resolve your own comments.' };
  const post = await getPost(data.post_id);
  refresh(post.workspace_id, post.id);
  return {};
}

export async function deleteComment(commentId: string): Promise<Result> {
  const { supabase } = await getSession();
  const { data } = await supabase.from('comments').select('post_id').eq('id', commentId).single();
  await supabase.from('comments').delete().eq('id', commentId);
  if (data) {
    const post = await getPost(data.post_id);
    refresh(post.workspace_id, post.id);
  }
  return {};
}

export async function suggestCaption(postId: string, platform: Platform, suggested: string, note: string): Promise<Result> {
  const { supabase, user } = await getSession();
  const post = await getPost(postId);
  if (post.status !== 'ready') return { error: 'Suggestions can be made while a post is waiting for approval.' };
  const { data: pv } = await supabase.from('platform_versions').select('caption').eq('post_id', postId).eq('platform', platform).single();
  if (!pv) return { error: 'That platform is not part of this post.' };
  if (pv.caption.trim() === suggested.trim()) return { error: 'Change the caption first, then save your suggestion.' };
  const { error } = await supabase.from('caption_suggestions').insert({
    post_id: postId, platform, version: post.version, author_id: user.id,
    original: pv.caption, suggested, note: note.trim() || null,
  });
  if (error) return { error: error.message };
  refresh(post.workspace_id, postId);
  return { ok: 'Suggestion saved' };
}

export async function reviewSuggestion(suggestionId: string, accept: boolean): Promise<Result> {
  const { supabase } = await requireAdmin();
  const { data: s } = await supabase.from('caption_suggestions').select('*').eq('id', suggestionId).single();
  if (!s) return { error: 'Not found' };
  const post = await getPost(s.post_id);
  if (accept) {
    if (!EDITABLE.includes(post.status) && post.status !== 'ready') {
      return { error: 'Move the post back to draft before changing its caption.' };
    }
    await supabase.from('platform_versions').update({ caption: s.suggested, updated_at: new Date().toISOString() })
      .eq('post_id', s.post_id).eq('platform', s.platform);
    await supabase.from('learning_records').insert({
      workspace_id: post.workspace_id, post_id: post.id, platform: s.platform,
      kind: 'accepted_edit', before_text: s.original, after_text: s.suggested, note: s.note,
    });
  }
  await supabase.from('caption_suggestions').update({ status: accept ? 'accepted' : 'rejected' }).eq('id', suggestionId);
  refresh(post.workspace_id, post.id);
  return {};
}

export async function decide(postId: string, decision: Decision, reason: string): Promise<Result> {
  const { supabase } = await getSession();
  const post = await getPost(postId);
  const { error } = await supabase.rpc('decide_post', { pid: postId, choice: decision, why: reason });
  if (error) return { error: error.message };
  refresh(post.workspace_id, postId);
  return { ok: decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : 'Changes requested' };
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export async function emailApprovers(workspaceId: string): Promise<Result> {
  const { supabase } = await requireAdmin();
  const [{ data: ws }, { data: posts }, { data: members }] = await Promise.all([
    supabase.from('workspaces').select('name').eq('id', workspaceId).single(),
    supabase.from('posts').select('title').eq('workspace_id', workspaceId).eq('status', 'ready').order('planned_at'),
    supabase.from('workspace_members').select('role, profile:profiles(email)').eq('workspace_id', workspaceId).eq('role', 'approver')
      .returns<{ role: string; profile: { email: string } | null }[]>(),
  ]);
  const to = (members ?? []).map((m) => m.profile?.email).filter((e): e is string => Boolean(e));
  if (!posts?.length) return { error: 'Nothing is waiting for approval.' };
  if (!to.length) return { error: 'Add an approver in Settings first.' };

  const n = posts.length;
  const mail = await sendEmail(
    to,
    `${n} post${n === 1 ? '' : 's'} ready for your review`,
    digestHtml({
      intro: `${n === 1 ? 'A post is' : `${n} posts are`} ready for you to review for ${ws?.name ?? 'your business'}.`,
      items: posts.map((p) => p.title),
      buttonLabel: 'Review posts',
      buttonUrl: `${SITE_URL}/w/${workspaceId}/review`,
    }),
  );
  return mail.sent ? { ok: `Emailed ${to.join(', ')}` } : { error: `Couldn't send: ${mail.reason}.` };
}
