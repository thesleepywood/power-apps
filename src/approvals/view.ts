import type { SignOffRequestView } from './types';
import type { SignOffRequest } from './server';
import { canDecide, canWithdraw } from '../foundation/server/approvals';
import { ssnForViewer } from '../foundation/server/masking';
import { findUser, type User } from '../foundation/shared/users';

const who = (id?: string) => {
  const u = findUser(id);
  return u ? { id: u.id, name: u.name, role: u.role } : null;
};

/** Shapes a stored request for one viewer: masks sensitive fields and attaches the server's permission decisions. */
export function approvalOf(r: SignOffRequest, viewer: User): SignOffRequestView {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    customerName: r.customerName,
    customerSsn: ssnForViewer(r.customerSsn, viewer),
    amount: r.amount,
    reason: r.reason,
    summary: r.summary,
    status: r.status,
    requestedAt: r.requestedAt,
    requestedBy: who(r.requestedBy)!,
    decidedBy: who(r.decidedBy),
    decidedAt: r.decidedAt ?? null,
    decisionNote: r.decisionNote ?? null,
    actions: {
      approve: canDecide(viewer, r, 'approved'),
      reject: canDecide(viewer, r, 'rejected'),
      withdraw: canWithdraw(viewer, r),
    },
  };
}
