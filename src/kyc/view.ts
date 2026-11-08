import type { KycCaseView } from './types';
import type { KycCase } from './server';
import { canDecide, canEscalate, mustEscalate, type ApprovalOptions } from '../foundation/server/approvals';
import { ssnForViewer } from '../foundation/server/masking';
import { findUser, type User } from '../foundation/shared/users';

/** Operators and Approvers work pending cases; only Approvers decide cases waiting for an Approver. */
export const KYC_APPROVAL: ApprovalOptions = { approverRoles: ['operator', 'approver'], escalatedRoles: ['approver'] };

/** High-risk cases need an Approver: when anyone else approves one, it's sent to an Approver instead. */
export const approveEscalates = (c: KycCase, viewer: User) => c.risk === 'high' && c.status === 'pending' && mustEscalate(viewer, KYC_APPROVAL);

export const canApproveCase = (viewer: User, c: KycCase) =>
  approveEscalates(c, viewer) ? canEscalate(viewer, c, KYC_APPROVAL) : canDecide(viewer, c, 'approved', KYC_APPROVAL);

const who = (id?: string) => {
  const u = findUser(id);
  return u ? { id: u.id, name: u.name, role: u.role } : null;
};

/** Shapes a stored case for one viewer: masks the SSN and attaches the server's permission decisions. */
export function kycCaseOf(c: KycCase, viewer: User): KycCaseView {
  return {
    id: c.id,
    customerName: c.customerName,
    ssn: ssnForViewer(c.ssn, viewer),
    risk: c.risk,
    status: c.status,
    reviewReason: c.reviewReason,
    summary: c.summary,
    openedAt: c.requestedAt,
    openedBy: who(c.requestedBy)!,
    escalatedBy: who(c.escalatedBy),
    escalatedAt: c.escalatedAt ?? null,
    escalationNote: c.escalationNote ?? null,
    decidedBy: who(c.decidedBy),
    decidedAt: c.decidedAt ?? null,
    decisionNote: c.decisionNote ?? null,
    approveEscalates: approveEscalates(c, viewer),
    actions: {
      approve: canApproveCase(viewer, c),
      reject: canDecide(viewer, c, 'rejected', KYC_APPROVAL),
    },
  };
}
