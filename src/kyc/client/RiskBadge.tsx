import { Badge } from '../../foundation/client/ui';
import type { RiskLevel } from '../types';

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <Badge tone={risk === 'high' ? 'danger' : 'neutral'}>{risk === 'high' ? 'High risk' : 'Low risk'}</Badge>;
}
