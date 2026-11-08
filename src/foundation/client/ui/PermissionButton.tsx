import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import type { Decision } from '../../shared/types';
import { Button } from './primitives';

/**
 * A button driven by the server's permission decision. When the action isn't
 * allowed it stays visible but disabled, with the server's reason next to it.
 */
export function PermissionButton({
  decision,
  variant = 'secondary',
  icon,
  onClick,
  children,
}: {
  decision: Decision;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  if (decision.allowed) {
    return (
      <Button variant={variant} icon={icon} onClick={onClick}>
        {children}
      </Button>
    );
  }
  return (
    <span className="perm-wrap">
      <Button variant={variant} icon={<Lock size={14} />} disabled aria-describedby={`why-${decision.code}`} title={decision.reason}>
        {children}
      </Button>
      <span className="perm-reason" id={`why-${decision.code}`}>
        {decision.reason}
      </span>
    </span>
  );
}
