import { describe, expect, it } from 'vitest';
import { canDecide, canEscalate, canWithdraw, decide, escalate, type Approvable } from '../src/foundation/server/approvals';
import type { Role } from '../src/foundation/shared/roles';
import { Foundation } from '../src/foundation/server/foundation';
import { findUser } from '../src/foundation/shared/users';
import { APPROVED, APPROVER, APPROVER_2, NEW_REQUEST, NOW, OBSERVER, OPERATOR, OPERATOR_2, PENDING_BY_APPROVER, setup } from './helpers';

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
    const actionable = async (user: string) => {
      const apr = (await as(user).get('/apps/approvals/requests')).body.rows as Array<{ status: string; actions: { approve: { allowed: boolean } } }>;
      const kyc = (await as(user).get('/apps/kyc/cases')).body.rows as Array<{ actions: { approve: { allowed: boolean } } }>;
      const n = (rows: Array<{ actions: { approve: { allowed: boolean } } }>) => rows.filter((r) => r.actions.approve.allowed).length;
      return { apr: n(apr), total: n(apr) + n(kyc) };
    };
    const [p, s, o] = [await actionable(APPROVER), await actionable(APPROVER_2), await actionable(OPERATOR)];
    expect(s.apr).toBe(p.apr + 1); // Priya can't sign her own APR-1003
    expect(o.apr).toBe(0);
    expect([priya.waitingOnYou, samuel.waitingOnYou, (await as(OPERATOR).get('/home')).body.waitingOnYou]).toEqual([p.total, s.total, o.total]);
    expect(priya.spotlight).toMatchObject({ app: 'approvals', reason: 'waiting_on_you' });
  });
});

describe('escalation (primitive)', () => {
  const opts = { approverRoles: ['operator', 'approver'] as Role[], escalatedRoles: ['approver'] as Role[] };
  const make = () => {
    const f = new Foundation(() => NOW);
    const col = f.collection<Approvable>({ app: 't', recordType: 'R', label: (r) => r.id, redact: (r) => ({ ...r }) });
    f.change(u(OPERATOR), col, { action: 'created', summary: 'Opened', apply: () => req(OPERATOR) });
    return { f, col };
  };

  it('moves a pending record to waiting instead of approving it, with one log entry', () => {
    const { f, col } = make();
    const out = escalate(f, u(OPERATOR_2), col, 'r1', { note: 'Looks fine' }, opts);
    expect(out).toMatchObject({ status: 'waiting', escalatedBy: OPERATOR_2, escalationNote: 'Looks fine' });
    expect(out.decidedBy).toBeUndefined();
    expect(f.changeLog.size).toBe(2);
    expect(f.changeLog.list()[0]).toMatchObject({ action: 'waiting', before: { status: 'pending' }, after: { status: 'waiting' } });
  });

  it('once waiting, only the stricter role may decide', () => {
    const waiting = { ...req(OPERATOR, 'waiting'), escalatedBy: OPERATOR_2 };
    expect(canDecide(u(OPERATOR_2), waiting, 'approved', opts)).toEqual({ allowed: false, code: 'role', reason: 'Approvers only' });
    expect(canDecide(u(OPERATOR_2), waiting, 'rejected', opts)).toMatchObject({ code: 'role' });
    expect(canDecide(u(APPROVER), waiting, 'approved', opts)).toEqual({ allowed: true });
    expect(canDecide(u(APPROVER), waiting, 'approved')).toEqual({ allowed: true });
  });

  it('blocks self-approval at every step', () => {
    expect(canEscalate(u(OPERATOR), req(OPERATOR), opts)).toMatchObject({ code: 'self_approval' });
    expect(canDecide(u(APPROVER), { ...req(APPROVER, 'waiting'), escalatedBy: OPERATOR }, 'approved', opts)).toMatchObject({ code: 'self_approval' });
    expect(canDecide(u(APPROVER), { ...req(OPERATOR, 'waiting'), escalatedBy: APPROVER }, 'approved', opts)).toMatchObject({ code: 'self_escalated' });
    const { f, col } = make();
    expect(() => escalate(f, u(OPERATOR), col, 'r1', {}, opts)).toThrow("You can't approve your own request");
    expect(f.changeLog.size).toBe(1);
  });

  it('cannot escalate twice, decide a closed record, or escalate as an Observer', () => {
    expect(canEscalate(u(APPROVER), { ...req(OPERATOR, 'waiting'), escalatedBy: OPERATOR_2 }, opts)).toMatchObject({
      code: 'not_pending',
      reason: 'This request is already waiting for an Approver',
    });
    expect(canDecide(u(APPROVER), req(OPERATOR, 'rejected'), 'approved', opts)).toMatchObject({ code: 'not_pending' });
    expect(canEscalate(u(OBSERVER), req(OPERATOR), opts)).toMatchObject({ code: 'read_only' });
  });
});
