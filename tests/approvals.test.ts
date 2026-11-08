import { describe, expect, it } from 'vitest';
import { canDecide, canEscalate, canWithdraw, decide, escalate, mustEscalate, withdraw, type ApprovalOptions, type Approvable } from '../src/foundation/server/approvals';
import type { Role } from '../src/foundation/shared/roles';
import { Foundation } from '../src/foundation/server/foundation';
import { findUser, USERS } from '../src/foundation/shared/users';
import { APPROVER, APPROVER_2, NOW, OBSERVER, OPERATOR, OPERATOR_2 } from './helpers';

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

  it('withdraw() writes one entry for the requester and nothing for anyone else', () => {
    const f = new Foundation(() => NOW);
    const col = f.collection<Approvable>({ app: 't', recordType: 'R', label: (r) => r.id, redact: (r) => ({ ...r }) });
    f.change(u(OPERATOR), col, { action: 'created', summary: 'Opened', apply: () => req(OPERATOR) });
    expect(() => withdraw(f, u(APPROVER), col, 'r1')).toThrow('Only the person who opened it can withdraw');
    expect(f.changeLog.size).toBe(1);
    expect(withdraw(f, u(OPERATOR), col, 'r1').status).toBe('withdrawn');
    expect(f.changeLog.size).toBe(2);
    expect(canDecide(u(APPROVER), col.get('r1')!, 'approved')).toMatchObject({ code: 'not_pending' });
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

describe('no stuck records', () => {
  const opts: ApprovalOptions = { approverRoles: ['operator', 'approver'], escalatedRoles: ['approver'] };

  it('Approvers give the final sign-off directly instead of escalating', () => {
    expect(mustEscalate(u(OPERATOR), opts)).toBe(true);
    expect(mustEscalate(u(APPROVER), opts)).toBe(false);
    expect(canEscalate(u(APPROVER), req(OPERATOR), opts)).toMatchObject({ allowed: false, code: 'decide_directly' });
  });

  it('two Approvers: an Approver-opened record approved by the other Approver is finished, not stranded', () => {
    const f = new Foundation(() => NOW);
    const col = f.collection<Approvable>({ app: 't', recordType: 'R', label: (r) => r.id, redact: (r) => ({ ...r }) });
    f.change(u(APPROVER), col, { action: 'created', summary: 'Opened', apply: () => req(APPROVER) });
    expect(() => escalate(f, u(APPROVER_2), col, 'r1', {}, opts)).toThrow('approve it directly');
    expect(decide(f, u(APPROVER_2), col, 'r1', { decision: 'approved' }, opts).status).toBe('approved');
  });

  // Every requester × every first approver × both option sets: after the first approval
  // (escalate or decide, whichever the actor may do), an open record always has someone
  // who can approve it and someone who can reject it.
  for (const [label, options] of [['widened (KYC)', opts], ['default', {}]] as const) {
    it(`a waiting record always has an eligible decider (${label} options)`, () => {
      let waitingSeen = 0;
      for (const requester of USERS.filter((x) => x.role !== 'observer')) {
        for (const actor of USERS) {
          const f = new Foundation(() => NOW);
          const col = f.collection<Approvable>({ app: 't', recordType: 'R', label: (r) => r.id, redact: (r) => ({ ...r }) });
          f.change(requester, col, { action: 'created', summary: 'Opened', apply: () => req(requester.id) });
          const record = col.get('r1')!;
          if (mustEscalate(actor, options)) {
            if (!canEscalate(actor, record, options).allowed) continue;
            escalate(f, actor, col, 'r1', {}, options);
          } else {
            if (!canDecide(actor, record, 'approved', options).allowed) continue;
            decide(f, actor, col, 'r1', { decision: 'approved' }, options);
          }
          const after = col.get('r1')!;
          if (after.status !== 'waiting') continue;
          waitingSeen++;
          for (const decision of ['approved', 'rejected'] as const) {
            expect(USERS.some((x) => canDecide(x, after, decision, options).allowed), `${requester.id} → ${actor.id} → ${decision}`).toBe(true);
          }
        }
      }
      if (label !== 'default') expect(waitingSeen).toBeGreaterThan(0);
    });
  }
});
