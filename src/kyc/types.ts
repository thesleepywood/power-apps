import type { Decision } from '../foundation/shared/types';
import type { User } from '../foundation/shared/users';

export type KycStatus = 'pending' | 'waiting' | 'approved' | 'rejected';
export type RiskLevel = 'low' | 'high';

type Person = Pick<User, 'id' | 'name' | 'role'>;

/** What clients receive. The SSN arrives already masked by the server. */
export interface KycCaseView {
  id: string;
  customerName: string;
  /** Masked by the server, e.g. "•••-••-4401". */
  ssn: string;
  risk: RiskLevel;
  status: KycStatus;
  reviewReason: string;
  summary: string;
  openedAt: string;
  openedBy: Person;
  escalatedBy: Person | null;
  escalatedAt: string | null;
  escalationNote: string | null;
  decidedBy: Person | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** True when, for this viewer, approving sends the case to an Approver instead of approving it. */
  approveEscalates: boolean;
  /** The server's decision for the current viewer on each action. */
  actions: { approve: Decision; reject: Decision };
}
