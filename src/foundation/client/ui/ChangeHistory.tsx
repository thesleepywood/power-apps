import { History } from 'lucide-react';
import { diffSnapshots } from '../../shared/diff';
import type { ChangeEntry } from '../../shared/types';
import { formatDateTime, humanize, timeAgo } from '../format';
import { useApi } from '../session';
import { Avatar } from './primitives';
import { EmptyState, ErrorState, LoadingState } from './states';
import { StatusBadge } from './StatusBadge';

const HIDDEN = new Set(['id', 'requestedAt', 'decidedAt', 'decidedBy', 'requestedBy', 'escalatedBy', 'escalatedAt']);

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/** The change log for one record: who did what, when, and what changed. */
export function ChangeHistory({ app, recordId, limit }: { app: string; recordId: string; limit?: number }) {
  const q = new URLSearchParams({ app, recordId, ...(limit ? { limit: String(limit) } : {}) });
  const { data, error, loading, reload } = useApi<ChangeEntry[]>(`/changes?${q}`);

  if (loading && !data) return <LoadingState rows={3} />;
  if (error) return <ErrorState message={error.message} onRetry={reload} status={error.status} />;
  if (!data?.length) return <EmptyState icon={<History size={22} />} title="No changes yet" message="Changes to this record will appear here." />;

  return (
    <ol className="timeline">
      {data.map((e) => {
        const changes = e.before ? diffSnapshots(e.before, e.after).filter((c) => !HIDDEN.has(c.field)) : [];
        return (
          <li key={e.id} className="timeline-item">
            <Avatar initials={e.actor.name.split(' ').map((p) => p[0]).join('')} role={e.actor.role} size="sm" />
            <div className="timeline-content">
              <div className="timeline-line">
                <strong>{e.actor.name}</strong> <span className="muted">{e.summary.toLowerCase()}</span>
                {e.action !== 'created' && <StatusBadge status={e.action} />}
              </div>
              <div className="timeline-when" title={formatDateTime(e.at)}>
                {timeAgo(e.at)} · {formatDateTime(e.at)} · <span className="mono">{e.id}</span>
              </div>
              {changes.length > 0 && (
                <ul className="diff">
                  {changes.map((c) => (
                    <li key={c.field}>
                      <span className="diff-field">{humanize(c.field)}</span>
                      <span className="diff-before">{show(c.before)}</span>
                      <span className="diff-arrow">→</span>
                      <span className="diff-after">{show(c.after)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
