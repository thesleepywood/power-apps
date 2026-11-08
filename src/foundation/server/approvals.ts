import type { Role } from '../shared/roles';
import type { Decision } from '../shared/types';
import type { User } from '../shared/users';
import type { Collection, Foundation } from './foundation';
import { scrubSsns } from './masking';
import { enforce, deny, allow, firstDenial, requireRole } from './permissions';

/** `waiting` = escalated: a first reviewer approved it and it now needs an Approver's final sign-off. */
export type ApprovalStatus = 'pending' | 'waiting' | 'approved' | 'rejected' | 'withdrawn';
export type ApprovalDecision = 'approved' | 'rejected';

/** Statuses that still need a decision. */
export const OPEN_STATUSES: ApprovalStatus[] = ['pending', 'waiting'];
export const isOpen = (record: Approvable) => OPEN_STATUSES.includes(record.status);

/** Fields any record needs to go through sign-off. */
export interface Approvable {
  id: string;
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  escalatedBy?: string;
  escalatedAt?: string;
  escalationNote?: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
}

export interface ApprovalOptions {
  /** Which roles may decide (or escalate) a pending record. Defaults to Approvers only. */
  approverRoles?: Role[];
  /** Which roles may decide a record that is waiting for an Approver. Defaults to Approvers only. */
  escalatedRoles?: Role[];
}

const already = (status: ApprovalStatus) =>
  deny('not_pending', status === 'waiting' ? 'This request is already waiting for an Approver' : `This request is already ${status}`);

/**
 * May `user` approve/reject `record`? Invariants: a person can never decide on
 * a request they opened themselves, regardless of role; and whoever escalated
 * a record can't also give its final sign-off.
 */
export function canDecide(
  user: User,
  record: Approvable,
  decision: ApprovalDecision,
  options: ApprovalOptions = {},
): Decision {
  const waiting = record.status === 'waiting';
  return firstDenial(
    () => requireRole(user, waiting ? (options.escalatedRoles ?? ['approver']) : (options.approverRoles ?? ['approver'])),
    () => (isOpen(record) ? allow() : already(record.status)),
    () =>
      record.requestedBy === user.id
        ? deny(
            'self_approval',
            decision === 'approved'
              ? "You can't approve your own request"
              : "You can't reject your own request",
          )
        : allow(),
    () =>
      waiting && record.escalatedBy === user.id
        ? deny('self_escalated', 'You escalated this, so another Approver has to sign off')
        : allow(),
  );
}

/** May `user` approve a pending record by escalating it for an Approver's final sign-off? */
export function canEscalate(user: User, record: Approvable, options: ApprovalOptions = {}): Decision {
  return firstDenial(
    () => canDecide(user, record, 'approved', options),
    () => (record.status === 'pending' ? allow() : already(record.status)),
  );
}

/** Only the person who opened a pending request may withdraw it. */
export function canWithdraw(user: User, record: Approvable): Decision {
  return firstDenial(
    () => requireRole(user, ['operator', 'approver']),
    () => (record.status === 'pending' ? allow() : already(record.status)),
    () => (record.requestedBy === user.id ? allow() : deny('not_requester', 'Only the person who opened it can withdraw')),
  );
}

export interface DecideInput {
  decision: ApprovalDecision;
  note?: string;
  summary?: string;
  at?: Date;
}

const cleanNote = (note?: string) => scrubSsns(note?.trim() ?? '') || undefined;

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
      return { ...record, status: input.decision, decidedBy: actor.id, decidedAt: at, decisionNote: cleanNote(input.note) };
    },
  });
}

export interface EscalateInput {
  note?: string;
  summary?: string;
  at?: Date;
}

/**
 * Approves a pending record as far as `actor` can take it: moves it to
 * `waiting` for an Approver's final sign-off instead of approving it.
 */
export function escalate<T extends Approvable>(
  foundation: Foundation,
  actor: User,
  collection: Collection<T>,
  id: string,
  input: EscalateInput = {},
  options: ApprovalOptions = {},
): T {
  return foundation.change(actor, collection, {
    id,
    action: 'waiting',
    summary: input.summary ?? 'Sent to an Approver',
    at: input.at,
    apply: (current) => {
      const record = current!;
      enforce(canEscalate(actor, record, options));
      const at = (input.at ?? foundation.now()).toISOString();
      return { ...record, status: 'waiting', escalatedBy: actor.id, escalatedAt: at, escalationNote: cleanNote(input.note) };
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
