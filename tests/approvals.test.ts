import { describe, expect, it } from 'vitest';
import { canDecide, canWithdraw, decide, type Approvable } from '../src/foundation/server/approvals';
import { Foundation } from '../src/foundation/server/foundation';
import { findUser } from '../src/foundation/shared/users';
import { APPROVED, APPROVER, APPROVER_2, NEW_REQUEST, NOW, OPERATOR, PENDING_BY_APPROVER, setup } from './helpers';

const u = (id: string) => findUser(id)!;
const req = (requestedBy: string, status: Approvable['status'] = 'pending'): Approvable => ({ id: 'r1', status, requestedBy, requestedAt: NOW.toISOString() });

describe('no self-approval (primitive)', () => {
  it('denies the requester even when they hold the approver role', () => {
    expect(canDecide(u(APPROVER), req(APPROVER), 'approved')).toEqual({
      allowed: false,
      code: 'self_approval',
      reason: "You can't approve your own request",
    });
    expect(canDecide(u(APPROVER), req(APPROVER), 'rejected')).toMatchObject({ allowed: false, code: 'self_approval' });
  });

  it('holds even when an app widens who may sign off', () => {
    const opts = { approverRoles: ['operator', 'approver'] as const };
    expect(canDecide(u(OPERATOR), req(OPERATOR), 'approved', { approverRoles: [...opts.approverRoles] })).toMatchObject({ code: 'self_approval' });
    expect(canDecide(u(OPERATOR), req(APPROVER), 'approved', { approverRoles: [...opts.approverRoles] })).toEqual({ allowed: true });
  });

  it('decide() enforces it, so callers cannot skip the check', () => {
    const f = new Foundation(() => NOW);
    const col = f.collection<Approvable>({ app: 't', recordType: 'R', label: (r) => r.id, redact: (r) => ({ ...r }) });
    f.change(u(APPROVER), col, { action: 'created', summary: 'Opened', apply: () => req(APPROVER) });
    expect(() => decide(f, u(APPROVER), col, 'r1', { decision: 'approved' })).toThrow("You can't approve your own request");
    expect(col.get('r1')!.status).toBe('pending');
    expect(f.changeLog.size).toBe(1);
    decide(f, u(APPROVER_2), col, 'r1', { decision: 'approved' });
    expect(col.get('r1')!).toMatchObject({ status: 'approved', decidedBy: APPROVER_2 });
  });

  it('cannot decide twice, and only the requester can withdraw', () => {
    expect(canDecide(u(APPROVER_2), req(OPERATOR, 'approved'), 'approved')).toMatchObject({ code: 'not_pending' });
    expect(canWithdraw(u(OPERATOR), req(OPERATOR))).toEqual({ allowed: true });
    expect(canWithdraw(u(APPROVER), req(OPERATOR))).toMatchObject({ code: 'not_requester' });
  });
});

describe('no self-approval (HTTP)', () => {
  it('an Approver cannot approve or reject a request they opened', async () => {
    const { as } = setup();
    const approve = await as(APPROVER).post(`/apps/approvals/requests/${PENDING_BY_APPROVER}/approve`);
    expect(approve.status).toBe(403);
    expect(approve.body.error).toEqual({ code: 'self_approval', message: "You can't approve your own request" });
    const reject = await as(APPROVER).post(`/apps/approvals/requests/${PENDING_BY_APPROVER}/reject`, { note: 'hmm' });
    expect(reject.status).toBe(403);
    expect(reject.body.error.code).toBe('self_approval');
  });

  it('the detail view tells the requester why', async () => {
    const { as } = setup();
    const res = await as(APPROVER).get(`/apps/approvals/requests/${PENDING_BY_APPROVER}`);
    expect(res.body.actions.approve).toMatchObject({ allowed: false, reason: "You can't approve your own request" });
  });

  it('a request an Approver just opened cannot be approved by them, but can by another Approver', async () => {
    const { as } = setup();
    const created = await as(APPROVER_2).post('/apps/approvals/requests', NEW_REQUEST);
    expect((await as(APPROVER_2).post(`/apps/approvals/requests/${created.body.id}/approve`)).status).toBe(403);
    const ok = await as(APPROVER).post(`/apps/approvals/requests/${created.body.id}/approve`);
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('approved');
  });

  it('a decided request cannot be decided again', async () => {
    const { as } = setup();
    const res = await as(APPROVER_2).post(`/apps/approvals/requests/${APPROVED}/reject`, { note: 'changed my mind' });
    expect(res.status).toBe(403);
    expect(res.body.error.message).toBe('This request is already approved');
  });

  it('home counts what each person can act on', async () => {
    const { as } = setup();
    const priya = (await as(APPROVER).get('/home')).body;
    const samuel = (await as(APPROVER_2).get('/home')).body;
    expect(samuel.waitingOnYou).toBe(priya.waitingOnYou + 1); // Priya can't sign her own APR-1003
    expect((await as(OPERATOR).get('/home')).body.waitingOnYou).toBe(0);
    expect(priya.spotlight).toMatchObject({ app: 'approvals', reason: 'waiting_on_you' });
  });
});
