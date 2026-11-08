import type { Role } from '../shared/roles';
import type { Decision } from '../shared/types';
import type { User } from '../shared/users';
import type { Collection, Foundation } from './foundation';
import { scrubSsns } from './masking';
import { enforce, deny, allow, firstDenial, requireRole } from './permissions';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn';
export type ApprovalDecision = 'approved' | 'rejected';

/** Fields any record needs to go through sign-off. */
export interface Approvable {
  id: string;
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

export interface ApprovalOptions {
  /** Which roles may sign off. Defaults to Approvers only. */
  approverRoles?: Role[];
}

/**
 * May `user` approve/reject `record`? Invariant: a person can never decide on
 * a request they opened themselves, regardless of role.
 */
export function canDecide(
  user: User,
  record: Approvable,
  decision: ApprovalDecision,
  options: ApprovalOptions = {},
): Decision {
  return firstDenial(
    () => requireRole(user, options.approverRoles ?? ['approver']),
    () => (record.status === 'pending' ? allow() : deny('not_pending', `This request is already ${record.status}`)),
    () =>
      record.requestedBy === user.id
        ? deny(
            'self_approval',
            decision === 'approved'
              ? "You can't approve your own request"
              : "You can't reject your own request — withdraw it instead",
          )
        : allow(),
  );
}

/** Only the person who opened a pending request may withdraw it. */
export function canWithdraw(user: User, record: Approvable): Decision {
  return firstDenial(
    () => requireRole(user, ['operator', 'approver']),
    () => (record.status === 'pending' ? allow() : deny('not_pending', `This request is already ${record.status}`)),
    () => (record.requestedBy === user.id ? allow() : deny('not_requester', 'Only the person who opened it can withdraw')),
  );
}

export interface DecideInput {
  decision: ApprovalDecision;
  note?: string;
  summary?: string;
  at?: Date;
}

/** Records a sign-off decision. Enforced here, so no caller can skip the checks. */
export function decide<T extends Approvable>(
  foundation: Foundation,
  actor: User,
  collection: Collection<T>,
  id: string,
  input: DecideInput,
  options: ApprovalOptions = {},
): T {
  return foundation.change(actor, collection, {
    id,
    action: input.decision,
    summary: input.summary ?? (input.decision === 'approved' ? 'Approved' : 'Rejected'),
    at: input.at,
    apply: (current) => {
      const record = current!;
      enforce(canDecide(actor, record, input.decision, options));
      const at = (input.at ?? foundation.now()).toISOString();
      return { ...record, status: input.decision, decidedBy: actor.id, decidedAt: at, decisionNote: scrubSsns(input.note?.trim() ?? '') || undefined };
    },
  });
}

export function withdraw<T extends Approvable>(
  foundation: Foundation,
  actor: User,
  collection: Collection<T>,
  id: string,
  at?: Date,
): T {
  return foundation.change(actor, collection, {
    id,
    action: 'withdrawn',
    summary: 'Withdrew request',
    at,
    apply: (current) => {
      enforce(canWithdraw(actor, current!));
      return { ...current!, status: 'withdrawn' };
    },
  });
}
