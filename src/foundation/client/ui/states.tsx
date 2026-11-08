import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Lock, RotateCw } from 'lucide-react';
import { Button } from './primitives';

export function EmptyState({ title, message, icon, action }: { title: string; message?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state state-empty">
      <div className="state-icon">{icon ?? <Inbox size={22} />}</div>
      <h3 className="state-title">{title}</h3>
      {message && <p className="state-message">{message}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, message, onRetry, status }: { title?: string; message: ReactNode; onRetry?: () => void; status?: number }) {
  const forbidden = status === 403;
  return (
    <div className={`state state-error ${forbidden ? 'state-forbidden' : ''}`} role="alert">
      <div className="state-icon">{forbidden ? <Lock size={22} /> : <AlertTriangle size={22} />}</div>
      <h3 className="state-title">{title ?? (forbidden ? "You don't have access" : status === 404 ? 'Not found' : 'Something went wrong')}</h3>
      <p className="state-message">{message}</p>
      {onRetry && (
        <div className="state-action">
          <Button icon={<RotateCw size={15} />} onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="loading" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${92 - i * 9}%` }} />
      ))}
    </div>
  );
}
