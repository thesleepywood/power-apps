import { Badge, type Tone } from './primitives';

const STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'warning' },
  waiting: { label: 'Waiting for approver', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  created: { label: 'Created', tone: 'brand' },
};

/** One badge for every status in every app. Unknown statuses fall back to a neutral badge. */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = STATUS[status] ?? { label: status, tone: 'neutral' as Tone };
  return (
    <Badge tone={s.tone} dot>
      {label ?? s.label}
    </Badge>
  );
}
