import type { PostStatus, Role } from './types';

export const STATUS_ORDER: PostStatus[] = ['ready', 'changes_requested', 'draft', 'approved', 'scheduled', 'published', 'rejected'];

const LABELS: Record<PostStatus, string> = {
  draft: 'Draft',
  ready: 'Ready for approval',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  rejected: 'Rejected',
  scheduled: 'Scheduled',
  published: 'Published',
};

export function statusLabel(status: PostStatus, role: Role) {
  if (status === 'ready' && role === 'approver') return 'Waiting for you';
  if (status === 'changes_requested' && role !== 'admin') return 'Being revised';
  return LABELS[status];
}

/** colour token name used by the stamp and board */
export const STATUS_TONE: Record<PostStatus, 'ink' | 'cobalt' | 'amber' | 'green' | 'red' | 'muted'> = {
  draft: 'muted',
  ready: 'cobalt',
  changes_requested: 'amber',
  approved: 'green',
  rejected: 'red',
  scheduled: 'ink',
  published: 'ink',
};
