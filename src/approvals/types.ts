import type { Decision } from '../foundation/shared/types';
import type { User } from '../foundation/shared/users';

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';

export const REQUEST_KINDS = [
  'Limit increase',
  'Fee waiver',
  'Manual payout',
  'Account reopen',
  'Profile override',
  'Write-off',
] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

/** What clients receive. Sensitive fields arrive already masked by the server. */
export interface SignOffRequestView {
  id: string;
  kind: RequestKind;
  title: string;
  customerName: string;
  /** Masked by the server, e.g. "•••-••-4401". */
  customerSsn: string;
  amount: number | null;
  reason: string;
  summary: string;
  status: RequestStatus;
  requestedAt: string;
  requestedBy: Pick<User, 'id' | 'name' | 'role'>;
  decidedBy: Pick<User, 'id' | 'name' | 'role'> | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** The server's decision for the current viewer on each action. */
  actions: { approve: Decision; reject: Decision; withdraw: Decision };
}

export interface NewSignOffRequest {
  kind: RequestKind;
  title: string;
  customerName: string;
  customerSsn: string;
  amount: number | null;
  reason: string;
  summary: string;
}
