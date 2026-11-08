import { describe, expect, it } from 'vitest';
import { canChange, requireRole } from '../src/foundation/server/permissions';
import { findUser } from '../src/foundation/shared/users';
import { APPROVER, APPROVER_2, NEW_REQUEST, OBSERVER, OPERATOR, PENDING_BY_OPERATOR, setup } from './helpers';

const u = (id: string) => findUser(id)!;

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
    const create = await as(OBSERVER).post('/apps/approvals/requests', NEW_REQUEST);
    expect(create.status).toBe(403);
    expect(create.body.error.message).toBe('Observers have read-only access');

    for (const action of ['approve', 'reject', 'withdraw']) {
      const res = await as(OBSERVER).post(`/apps/approvals/requests/${PENDING_BY_OPERATOR}/${action}`, { note: 'x' });
      expect(res.status, action).toBe(403);
      expect(res.body.error.message, action).toBe('Observers have read-only access');
    }
  });

  it('blocks Operators from signing off: "Approvers only"', async () => {
    const { as } = setup();
    const res = await as(OPERATOR).post('/apps/approvals/requests/APR-1005/approve');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: 'role', message: 'Approvers only' } });
    const after = await as(OPERATOR).get('/apps/approvals/requests/APR-1005');
    expect(after.body.status).toBe('pending');
  });

  it('lets an Approver sign off on someone else’s request', async () => {
    const { as } = setup();
    const res = await as(APPROVER_2).post(`/apps/approvals/requests/${PENDING_BY_OPERATOR}/approve`, { note: 'ok' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
    expect(res.body.decidedBy.id).toBe(APPROVER_2);
  });

  it('sends the server’s decision for each action so the UI can explain it', async () => {
    const { as } = setup();
    const op = (await as(OPERATOR).get(`/apps/approvals/requests/${PENDING_BY_OPERATOR}`)).body;
    expect(op.actions.approve).toEqual({ allowed: false, code: 'role', reason: 'Approvers only' });
    expect(op.actions.withdraw).toEqual({ allowed: true });

    const obs = (await as(OBSERVER).get('/apps/approvals/requests')).body;
    expect(obs.canCreate).toMatchObject({ allowed: false, reason: 'Observers have read-only access' });

    const appr = (await as(APPROVER).get(`/apps/approvals/requests/${PENDING_BY_OPERATOR}`)).body;
    expect(appr.actions.approve).toEqual({ allowed: true });
    expect(appr.actions.withdraw).toMatchObject({ allowed: false, reason: 'Only the person who opened it can withdraw' });
  });

  it('validates input on the server', async () => {
    const { as } = setup();
    const res = await as(OPERATOR).post('/apps/approvals/requests', { ...NEW_REQUEST, customerSsn: '12' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/SSN/);
  });
});
