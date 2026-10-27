export type Platform = 'linkedin' | 'instagram' | 'facebook';
export type PostStatus = 'draft' | 'ready' | 'changes_requested' | 'approved' | 'rejected' | 'scheduled' | 'published';
export type MemberRole = 'approver' | 'viewer';
export type Decision = 'approved' | 'changes_requested' | 'rejected';
export type Role = 'admin' | MemberRole;

export interface Workspace {
  id: string;
  name: string;
  logo_path: string | null;
  timezone: string;
  created_at: string;
}

export interface Post {
  id: string;
  workspace_id: string;
  title: string;
  context_note: string | null;
  status: PostStatus;
  planned_at: string | null;
  version: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaItem {
  id: string;
  post_id: string;
  storage_path: string;
  kind: 'image' | 'video';
  position: number;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
  file_name: string | null;
}

/** A media item with a short-lived URL the browser can load */
export interface MediaView extends MediaItem {
  url: string;
}

export interface PlatformVersion {
  id: string;
  post_id: string;
  platform: Platform;
  caption: string;
  is_reel: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  version: number;
  author_id: string;
  body: string;
  media_item_id: string | null;
  pin_x: number | null;
  pin_y: number | null;
  at_seconds: number | null;
  platform: Platform | null;
  resolved: boolean;
  created_at: string;
  author?: { email: string; full_name: string | null } | null;
}

export interface CaptionSuggestion {
  id: string;
  post_id: string;
  platform: Platform;
  version: number;
  author_id: string;
  original: string;
  suggested: string;
  note: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  author?: { email: string; full_name: string | null } | null;
}

export interface Approval {
  id: string;
  post_id: string;
  version: number;
  user_id: string;
  decision: Decision;
  reason: string | null;
  created_at: string;
  author?: { email: string; full_name: string | null } | null;
}

export interface VersionSnapshot {
  title: string;
  media: { storage_path: string; kind: 'image' | 'video'; width: number | null; height: number | null }[];
  platforms: { platform: Platform; caption: string; is_reel: boolean }[];
}

export interface PostVersion {
  id: string;
  post_id: string;
  version: number;
  snapshot: VersionSnapshot;
  sent_at: string;
}
