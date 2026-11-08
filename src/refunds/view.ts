import type { Refund } from './server';
import type { RefundView } from './types';
import { canDecide, type ApprovalOptions } from '../foundation/server/approvals';
import { canChange } from '../foundation/server/permissions';
import { findUser, type User } from '../foundation/shared/users';

/** Only Approvers decide refunds over the limit, and never their own. */
export const REFUND_APPROVAL: ApprovalOptions = { approverRoles: ['approver'] };

/** $1,000.00. Refunds at or under this are approved as soon as they're requested. */
export const AUTO_APPROVE_LIMIT_CENTS = 100_000;

export const needsApprover = (amountCents: number) => amountCents > AUTO_APPROVE_LIMIT_CENTS;

/** Operators and Approvers request refunds; Observers can't. */
export const canRequestRefund = (viewer: User) => canChange(viewer);

export const canApproveRefund = (viewer: User, r: Refund) => canDecide(viewer, r, 'approved', REFUND_APPROVAL);
export const canRejectRefund = (viewer: User, r: Refund) => canDecide(viewer, r, 'rejected', REFUND_APPROVAL);

const who = (id?: string) => {
  const u = findUser(id);
  return u ? { id: u.id, name: u.name, role: u.role } : null;
};

/** Shapes a stored refund for one viewer and attaches the server's permission decisions. */
export function refundOf(r: Refund, viewer: User): RefundView {
  return {
    id: r.id,
    customer: r.customer,
    amountCents: r.amountCents,
    reason: r.reason,
    summary: r.summary,
    status: r.status,
    requestedAt: r.requestedAt,
    requestedBy: who(r.requestedBy)!,
    decidedBy: who(r.decidedBy),
    decidedAt: r.decidedAt ?? null,
    decisionNote: r.decisionNote ?? null,
    needsApprover: needsApprover(r.amountCents),
    autoApproved: !!r.autoApproved,
    actions: {
      approve: canApproveRefund(viewer, r),
      reject: canRejectRefund(viewer, r),
    },
  };
}
