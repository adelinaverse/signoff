import { STATUS_TONE, statusLabel } from '@/lib/status';
import type { PostStatus, Role } from '@/lib/types';

const TONE_CLASS = {
  ink: 'text-ink',
  cobalt: 'text-cobalt',
  amber: 'text-amber',
  green: 'text-green',
  red: 'text-red',
  muted: 'text-muted',
} as const;

export function StatusStamp({ status, role, large, animate }: { status: PostStatus; role: Role; large?: boolean; animate?: boolean }) {
  return (
    <span className={`stamp ${large ? 'stamp-lg' : ''} ${animate ? 'stamp-in' : ''} ${TONE_CLASS[STATUS_TONE[status]]}`}>
      {statusLabel(status, role)}
    </span>
  );
}
