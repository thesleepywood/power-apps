import { describe, expect, it } from 'vitest';
import { canChange, requireRole } from '../src/foundation/server/permissions';
import { findUser } from '../src/foundation/shared/users';
import { APPROVER, APPROVER_2, KYC_HIGH_WAITING, KYC_LOW_BY_APPROVER, KYC_LOW_BY_OPERATOR_2, OBSERVER, OPERATOR, setup } from './helpers';

const u = (id: string) => findUser(id)!;
const casePath = (id: string, action?: string) => `/apps/kyc/cases/${id}${action ? `/${action}` : ''}`;

describe('requireRole', () => {
  it('allows listed roles and explains denials in plain words', () => {
    expect(requireRole(u(APPROVER), ['approver'])).toEqual({ allowed: true });
    expect(requireRole(u(OPERATOR), ['approver'])).toEqual({ allowed: false, code: 'role', reason: 'Approvers only' });
    expect(requireRole(u(OBSERVER), ['approver'])).toMatchObject({ allowed: false, reason: 'Observers have read-only access' });
  });

  it('lets every role except Observer make changes', () => {
    expect(canChange(u(OPERATOR)).allowed).toBe(true);
    expect(canChange(u(APPROVER)).allowed).toBe(true);
    expect(canChange(u(OBSERVER)).allowed).toBe(false);
  });
});

describe('server-side enforcement over HTTP', () => {
  it('rejects requests with no person or an unknown person', async () => {
    const { as } = setup();
    const none = await as(null).get('/apps');
    expect(none.status).toBe(401);
    expect(none.body.error.code).toBe('not_signed_in');
    expect((await as('u-nobody').get('/apps')).status).toBe(401);
  });

  it('blocks Observers from every mutation with a reason', async () => {
    const { as } = setup();
    for (const action of ['approve', 'reject']) {
      const res = await as(OBSERVER).post(casePath(KYC_LOW_BY_OPERATOR_2, action), { note: 'x' });
      expect(res.status, action).toBe(403);
      expect(res.body.error.message, action).toBe('Observers have read-only access');
    }
  });

  it('blocks Operators from signing off: "Approvers only"', async () => {
    const { as } = setup();
    const res = await as(OPERATOR).post(casePath(KYC_HIGH_WAITING, 'approve'));
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: 'role', message: 'Approvers only' } });
    const after = await as(OPERATOR).get(casePath(KYC_HIGH_WAITING));
    expect(after.body.status).toBe('waiting');
  });

  it('lets an Approver sign off on someone else’s record', async () => {
    const { as } = setup();
    const res = await as(APPROVER_2).post(casePath(KYC_HIGH_WAITING, 'approve'), { note: 'ok' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(res.body.decidedBy.id).toBe(APPROVER_2);
  });

  it('sends the server’s decision for each action so the UI can explain it', async () => {
    const { as } = setup();
    const op = (await as(OPERATOR).get(casePath(KYC_HIGH_WAITING))).body;
    expect(op.actions.approve).toEqual({ allowed: false, code: 'role', reason: 'Approvers only' });

    const obs = (await as(OBSERVER).get('/apps/kyc/cases')).body.rows as Array<{ actions: { approve: object; reject: object } }>;
    for (const row of obs) {
      expect(row.actions.approve).toMatchObject({ allowed: false, reason: 'Observers have read-only access' });
      expect(row.actions.reject).toMatchObject({ allowed: false, reason: 'Observers have read-only access' });
    }

    const own = (await as(APPROVER).get(casePath(KYC_LOW_BY_APPROVER))).body;
    expect(own.actions.approve).toEqual({ allowed: false, code: 'self_approval', reason: "You can't approve your own request" });
    expect((await as(APPROVER).get(casePath(KYC_HIGH_WAITING))).body.actions.approve).toMatchObject({ allowed: false, code: 'self_approval' });
    expect((await as(APPROVER_2).get(casePath(KYC_HIGH_WAITING))).body.actions.approve).toEqual({ allowed: true });
  });

  it('validates input on the server', async () => {
    const { as } = setup();
    const res = await as(OPERATOR).post(casePath(KYC_LOW_BY_OPERATOR_2, 'reject'), { note: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/note/);
  });

  it('returns 404 for an unknown record', async () => {
    const { as } = setup();
    expect((await as(APPROVER).get(casePath('KYC-9999'))).status).toBe(404);
  });
});
