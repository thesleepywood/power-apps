import type { Decision } from '../foundation/shared/types';
import type { User } from '../foundation/shared/users';

/** Refunds are never escalated or withdrawn, so they only use these approval statuses. */
export type RefundStatus = 'pending' | 'approved' | 'rejected';

export type Person = Pick<User, 'id' | 'name' | 'role'>;

/** What clients receive for one refund, shaped for the current viewer. */
export interface RefundView {
  id: string;
  customer: string;
  /** Whole cents, e.g. 124000 = $1,240.00. */
  amountCents: number;
  reason: string;
  summary: string;
  status: RefundStatus;
  requestedAt: string;
  requestedBy: Person;
  decidedBy: Person | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** Over the auto-approval limit, so an Approver has to decide it. */
  needsApprover: boolean;
  /** Approved on request because it was at or under the limit (no person decided it). */
  autoApproved: boolean;
  /** The server's decision for the current viewer on each action. */
  actions: { approve: Decision; reject: Decision };
}

export interface RefundList {
  rows: RefundView[];
  /** May the current viewer request a new refund? */
  actions: { request: Decision };
  /** Refunds at or under this amount are approved on request. */
  autoApproveLimitCents: number;
}
