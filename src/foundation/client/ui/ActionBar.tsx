import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import type { Decision } from '../../shared/types';
import { Button } from './primitives';

export interface RecordAction {
  label: string;
  decision: Decision;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: ReactNode;
  /** Hide entirely (instead of showing disabled) when not allowed. */
  hideWhenDenied?: boolean;
}

/**
 * Primary actions for a record. Denied actions stay visible but locked, and
 * the server's reasons are listed underneath so the screen always says why.
 */
export function ActionBar({ actions }: { actions: RecordAction[] }) {
  const visible = actions.filter((a) => a.decision.allowed || !a.hideWhenDenied);
  const reasons = [...new Set(visible.flatMap((a) => (a.decision.allowed ? [] : [a.decision.reason])))];
  if (visible.length === 0) return null;
  return (
    <div className="action-bar">
      <div className="action-buttons">
        {visible.map((a) => (
          <Button
            key={a.label}
            variant={a.variant ?? 'secondary'}
            icon={a.decision.allowed ? a.icon : <Lock size={14} />}
            disabled={!a.decision.allowed}
            title={a.decision.allowed ? undefined : a.decision.reason}
            onClick={a.onClick}
          >
            {a.label}
          </Button>
        ))}
      </div>
      {reasons.length > 0 && (
        <ul className="action-reasons" aria-label="Why some actions are unavailable">
          {reasons.map((r) => (
            <li key={r}>
              <Lock size={12} />
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
