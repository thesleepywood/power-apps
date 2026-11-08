import { describe, expect, it } from 'vitest';
import { SEED_REFUNDS } from '../src/refunds/seed';
import { refundsApp } from '../src/refunds/server';
import { AUTO_APPROVE_LIMIT_CENTS } from '../src/refunds/view';
import {
  APPROVER,
  APPROVER_2,
  OBSERVER,
  OPERATOR,
  OPERATOR_2,
  REFUND_APPROVED,
  REFUND_AT_LIMIT,
  REFUND_AUTO_APPROVED,
  REFUND_PENDING_BY_APPROVER,
  REFUND_PENDING_BY_OPERATOR,
  REFUND_PENDING_BY_OPERATOR_2,
  REFUND_REJECTED,
  setup,
} from './helpers';

const PEOPLE = [OPERATOR, OPERATOR_2, APPROVER, APPROVER_2, OBSERVER];
const LIST = '/apps/refunds/refunds';
const refundPath = (id: string, action?: string) => `${LIST}/${id}${action ? `/${action}` : ''}`;
const bodyFor = (action: string) => (action === 'reject' ? { note: 'Not eligible' } : {});

type Row = { id: string; status: string; actions: Record<string, { allowed: boolean; code?: string; reason?: string }> };

const newRefund = (amountCents: number, extra: object = {}) => ({
  customer: 'Test Customer',
  amountCents,
  reason: 'Duplicate charge',
  summary: 'Charged twice',
  ...extra,
});

describe('Refunds seed data', () => {
  it('has 10 fictional refunds of $5–$2,000 with every required field and status', async () => {
    expect(SEED_REFUNDS).toHaveLength(10);
    const { as } = setup();
    const rows = (await as(OPERATOR).get(LIST)).body.rows;
    expect(rows).toHaveLength(10);
    for (const r of rows) {
      for (const k of ['customer', 'amountCents', 'status', 'requestedBy', 'reason', 'summary', 'requestedAt']) expect(r[k], `${r.id} ${k}`).toBeTruthy();
      expect(r.amountCents).toBeGreaterThanOrEqual(500);
      expect(r.amountCents).toBeLessThanOrEqual(200_000);
      expect(r.requestedBy).toEqual({ id: expect.any(String), name: expect.any(String), role: expect.any(String) });
    }
    expect(new Set(rows.map((r: Row) => r.status))).toEqual(new Set(['pending', 'approved', 'rejected']));
    expect(rows.some((r: Row & { amountCents: number; autoApproved: boolean }) => r.autoApproved)).toBe(true);
    expect(rows.some((r: Row & { decidedBy: unknown }) => r.status === 'approved' && r.decidedBy)).toBe(true);
  });

  it('includes at least one refund over $1,000 requested by an Approver', () => {
    expect(SEED_REFUNDS.some((s) => s.amountCents > AUTO_APPROVE_LIMIT_CENTS && ['u-priya', 'u-samuel'].includes(s.requestedBy))).toBe(true);
  });

  it('is consistent with the rules: $1,000 or less is auto-approved, only larger refunds have an Approver decision', async () => {
    const { as } = setup();
    for (const s of SEED_REFUNDS) {
      const r = (await as(OBSERVER).get(refundPath(s.id))).body;
      if (s.amountCents <= AUTO_APPROVE_LIMIT_CENTS) {
        expect(s.outcome, s.id).toBeUndefined();
        expect(r, s.id).toMatchObject({ status: 'approved', autoApproved: true, decidedBy: null, needsApprover: false });
      } else {
        expect(r, s.id).toMatchObject({ status: s.outcome?.status ?? 'pending', autoApproved: false, needsApprover: true });
        if (s.outcome) expect(r.decidedBy.id).not.toBe(s.requestedBy);
      }
    }
    expect((await as(OBSERVER).get(refundPath(REFUND_AT_LIMIT))).body).toMatchObject({ amountCents: 100_000, status: 'approved', autoApproved: true });
  });

  it('lists newest first and filters by ?status=', async () => {
    const { as } = setup();
    const rows = (await as(OPERATOR).get(LIST)).body.rows as Array<{ requestedAt: string }>;
    expect([...rows].sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))).toEqual(rows);
    const pending = (await as(OPERATOR).get(`${LIST}?status=pending`)).body.rows as Row[];
    expect(pending.map((r) => r.id).sort()).toEqual([REFUND_PENDING_BY_APPROVER, REFUND_PENDING_BY_OPERATOR, REFUND_PENDING_BY_OPERATOR_2]);
  });
});

describe('requesting a refund', () => {
  it.each([
    ['Operator', OPERATOR],
    ['Approver', APPROVER],
  ])('1,000 dollars or less is approved right away (%s), with exactly one log entry and no person as decider', async (_n, user) => {
    const { as, foundation } = setup();
    const before = foundation.changeLog.size;
    const res = await as(user).post(LIST, newRefund(AUTO_APPROVE_LIMIT_CENTS));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'approved', autoApproved: true, decidedBy: null, requestedBy: { id: user }, amountCents: 100_000 });
    expect(res.body.decidedAt).toBe(res.body.requestedAt);
    expect(res.body.actions.approve).toMatchObject({ allowed: false });
    expect((await as(APPROVER_2).get(refundPath(res.body.id))).body.actions.approve).toEqual({ allowed: false, code: 'not_pending', reason: 'This request is already approved' });
    expect(foundation.changeLog.size).toBe(before + 1);
    const [latest] = (await as(OBSERVER).get('/changes?limit=1')).body;
    expect(latest).toMatchObject({ app: 'refunds', recordId: res.body.id, action: 'created', actor: { id: user }, after: { status: 'approved', autoApproved: true } });
  });

  it('over $1,000 stays pending; an Operator cannot approve it, an Approver can', async () => {
    const { as, foundation } = setup();
    const before = foundation.changeLog.size;
    const created = await as(OPERATOR).post(LIST, newRefund(AUTO_APPROVE_LIMIT_CENTS + 1));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ id: 'RF-2011', status: 'pending', needsApprover: true, autoApproved: false, decidedBy: null });
    expect(foundation.changeLog.size).toBe(before + 1);

    const op = await as(OPERATOR_2).post(refundPath('RF-2011', 'approve'));
    expect(op.status).toBe(403);
    expect(op.body.error).toEqual({ code: 'role', message: 'Approvers only' });
    expect(foundation.changeLog.size).toBe(before + 1);

    const ok = await as(APPROVER).post(refundPath('RF-2011', 'approve'), { note: 'Checked the processor report' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'approved', decidedBy: { id: APPROVER }, decisionNote: 'Checked the processor report', autoApproved: false });
    expect(foundation.changeLog.size).toBe(before + 2);
    const history = (await as(OBSERVER).get('/changes?app=refunds&recordId=RF-2011')).body;
    expect(history.map((e: { action: string }) => e.action)).toEqual(['approved', 'created']);
  });

  it.each([
    ['zero amount', newRefund(0), 'Enter an amount greater than $0.00.'],
    ['negative amount', newRefund(-500), 'Enter an amount greater than $0.00.'],
    ['fractional cents', newRefund(12.5), 'Enter an amount greater than $0.00.'],
    ['amount as text', newRefund(0, { amountCents: '5000' }), 'Enter an amount greater than $0.00.'],
    ['missing amount', newRefund(0, { amountCents: undefined }), 'Enter an amount greater than $0.00.'],
    ['missing customer', newRefund(5000, { customer: '  ' }), 'Add the customer this refund is for.'],
    ['missing reason', newRefund(5000, { reason: '' }), 'Add a reason for the refund.'],
  ])('rejects invalid input (%s) with 400 and no log entry', async (_n, body, message) => {
    const { as, foundation } = setup();
    const before = foundation.changeLog.size;
    const res = await as(OPERATOR).post(LIST, body);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'invalid', message });
    expect(foundation.changeLog.size).toBe(before);
  });

  it('Observers cannot request refunds, and the list says so', async () => {
    const { as, foundation } = setup();
    const before = foundation.changeLog.size;
    expect((await as(OBSERVER).get(LIST)).body.actions.request).toEqual({ allowed: false, code: 'read_only', reason: 'Observers have read-only access' });
    for (const u of [OPERATOR, APPROVER]) expect((await as(u).get(LIST)).body.actions.request).toEqual({ allowed: true });
    // Permission comes before validation, so even an empty body gets the "who" answer.
    for (const body of [newRefund(5000), {}]) {
      const res = await as(OBSERVER).post(LIST, body);
      expect(res.status).toBe(403);
      expect(res.body.error).toEqual({ code: 'read_only', message: 'Observers have read-only access' });
    }
    expect(foundation.changeLog.size).toBe(before);
  });

  it('masks SSN-shaped numbers typed into free text, in the response and the change log', async () => {
    const { as } = setup();
    const res = await as(OPERATOR).post(LIST, newRefund(150_000, { reason: 'Customer gave SSN 912-34-5678', summary: 'Also 912345678' }));
    expect(res.status).toBe(201);
    const id = res.body.id;
    await as(APPROVER).post(refundPath(id, 'reject'), { note: 'Wrong SSN 912-34-5678' });
    for (const path of [refundPath(id), LIST, `/changes?app=refunds&recordId=${id}`, '/changes']) {
      const json = JSON.stringify((await as(APPROVER).get(path)).body);
      expect(json, path).not.toMatch(/912-?34-?5678/);
    }
  });
});

describe('no self-approval', () => {
  it('a requester can never approve or reject their own refund, including an Approver who requested it', async () => {
    const { as, foundation } = setup();
    const before = foundation.changeLog.size;
    const view = (await as(APPROVER).get(refundPath(REFUND_PENDING_BY_APPROVER))).body;
    expect(view.actions.approve).toEqual({ allowed: false, code: 'self_approval', reason: "You can't approve your own request" });
    expect(view.actions.reject).toEqual({ allowed: false, code: 'self_approval', reason: "You can't reject your own request" });
    const approve = await as(APPROVER).post(refundPath(REFUND_PENDING_BY_APPROVER, 'approve'));
    expect(approve.status).toBe(403);
    expect(approve.body.error).toEqual({ code: 'self_approval', message: "You can't approve your own request" });
    const reject = await as(APPROVER).post(refundPath(REFUND_PENDING_BY_APPROVER, 'reject'), { note: 'mine' });
    expect(reject.body.error).toEqual({ code: 'self_approval', message: "You can't reject your own request" });
    expect(foundation.changeLog.size).toBe(before);

    // The other Approver can decide it.
    const ok = await as(APPROVER_2).post(refundPath(REFUND_PENDING_BY_APPROVER, 'approve'));
    expect(ok.body).toMatchObject({ status: 'approved', decidedBy: { id: APPROVER_2 } });
  });

  it('holds for new requests by every person who can request', async () => {
    for (const requester of [OPERATOR, OPERATOR_2, APPROVER, APPROVER_2]) {
      const { as } = setup();
      const { id } = (await as(requester).post(LIST, newRefund(120_000))).body;
      const own = await as(requester).post(refundPath(id, 'approve'));
      expect(own.status, requester).toBe(403);
      // Operators are refused for their role first; Approvers for self-approval.
      expect(own.body.error.code, requester).toBe([APPROVER, APPROVER_2].includes(requester) ? 'self_approval' : 'role');
      expect((await as(requester).get(refundPath(id))).body.status).toBe('pending');
    }
  });
});

describe('rejecting', () => {
  it('needs a note, but checks who may reject first', async () => {
    const { as, foundation } = setup();
    const before = foundation.changeLog.size;
    const noNote = await as(APPROVER).post(refundPath(REFUND_PENDING_BY_OPERATOR, 'reject'), { note: '   ' });
    expect(noNote.status).toBe(400);
    expect(noNote.body.error).toEqual({ code: 'invalid', message: 'Add a short note explaining the rejection.' });
    const opNoNote = await as(OPERATOR_2).post(refundPath(REFUND_PENDING_BY_OPERATOR, 'reject'));
    expect(opNoNote.status).toBe(403);
    expect(opNoNote.body.error).toEqual({ code: 'role', message: 'Approvers only' });
    const selfNoNote = await as(APPROVER).post(refundPath(REFUND_PENDING_BY_APPROVER, 'reject'));
    expect(selfNoNote.body.error).toEqual({ code: 'self_approval', message: "You can't reject your own request" });
    expect(foundation.changeLog.size).toBe(before);

    const ok = await as(APPROVER).post(refundPath(REFUND_PENDING_BY_OPERATOR, 'reject'), { note: 'Return not received yet' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'rejected', decidedBy: { id: APPROVER }, decisionNote: 'Return not received yet' });
    expect(foundation.changeLog.size).toBe(before + 1);
  });
});

describe('refused transitions return the exact reason and write nothing', () => {
  it.each([
    ['Operator approves', OPERATOR_2, refundPath(REFUND_PENDING_BY_OPERATOR, 'approve'), {}, 403, 'role', 'Approvers only'],
    ['Operator rejects', OPERATOR, refundPath(REFUND_PENDING_BY_OPERATOR_2, 'reject'), { note: 'x' }, 403, 'role', 'Approvers only'],
    ['Observer approves', OBSERVER, refundPath(REFUND_PENDING_BY_OPERATOR, 'approve'), {}, 403, 'read_only', 'Observers have read-only access'],
    ['Observer rejects', OBSERVER, refundPath(REFUND_PENDING_BY_OPERATOR, 'reject'), { note: 'x' }, 403, 'read_only', 'Observers have read-only access'],
    ['Observer requests', OBSERVER, LIST, newRefund(5000), 403, 'read_only', 'Observers have read-only access'],
    ['self approve', APPROVER, refundPath(REFUND_PENDING_BY_APPROVER, 'approve'), {}, 403, 'self_approval', "You can't approve your own request"],
    ['self reject', APPROVER, refundPath(REFUND_PENDING_BY_APPROVER, 'reject'), { note: 'x' }, 403, 'self_approval', "You can't reject your own request"],
    ['approve an approved refund', APPROVER_2, refundPath(REFUND_APPROVED, 'approve'), {}, 403, 'not_pending', 'This request is already approved'],
    ['reject a rejected refund', APPROVER, refundPath(REFUND_REJECTED, 'reject'), { note: 'x' }, 403, 'not_pending', 'This request is already rejected'],
    ['reject an auto-approved refund', APPROVER, refundPath(REFUND_AUTO_APPROVED, 'reject'), { note: 'x' }, 403, 'not_pending', 'This request is already approved'],
    ['reject without a note', APPROVER_2, refundPath(REFUND_PENDING_BY_OPERATOR, 'reject'), {}, 400, 'invalid', 'Add a short note explaining the rejection.'],
    ['unknown refund', APPROVER, refundPath('RF-9999', 'approve'), {}, 404, 'not_found', "Refund RF-9999 doesn't exist."],
    ['invalid amount', OPERATOR, LIST, newRefund(0), 400, 'invalid', 'Enter an amount greater than $0.00.'],
  ])('%s', async (_n, user, path, body, status, code, message) => {
    const { as, foundation } = setup();
    const before = foundation.changeLog.size;
    const res = await as(user).post(path, body);
    expect(res.status).toBe(status);
    expect(res.body.error).toEqual({ code, message });
    expect(foundation.changeLog.size).toBe(before);
  });
});

describe('each allowed transition writes exactly one change-log entry', () => {
  it.each([
    ['request of 1,000 dollars or less (auto-approved)', OPERATOR, LIST, newRefund(8_000), 201, 'approved'],
    ['request over 1,000 dollars', APPROVER, LIST, newRefund(180_000), 201, 'pending'],
    ['approve', APPROVER, refundPath(REFUND_PENDING_BY_OPERATOR, 'approve'), {}, 200, 'approved'],
    ['reject', APPROVER_2, refundPath(REFUND_PENDING_BY_APPROVER, 'reject'), { note: 'Second capture was reversed' }, 200, 'rejected'],
  ])('%s', async (_n, user, path, body, status, after) => {
    const { as, foundation } = setup();
    const before = foundation.changeLog.size;
    const res = await as(user).post(path, body);
    expect(res.status).toBe(status);
    expect(res.body.status).toBe(after);
    expect(foundation.changeLog.size).toBe(before + 1);
    const [latest] = (await as(OBSERVER).get('/changes?limit=1')).body;
    expect(latest).toMatchObject({ app: 'refunds', recordType: 'Refund', recordId: res.body.id, actor: { id: user }, after: { status: after } });
  });

  it('seed history: one entry per request and per Approver decision', async () => {
    const { as } = setup();
    const entries = (await as(OBSERVER).get('/changes?app=refunds')).body as unknown[];
    expect(entries).toHaveLength(SEED_REFUNDS.length + SEED_REFUNDS.filter((s) => s.outcome).length);
    const approved = (await as(OBSERVER).get(`/changes?app=refunds&recordId=${REFUND_APPROVED}`)).body;
    expect(approved.map((e: { action: string; actor: { id: string } }) => [e.action, e.actor.id])).toEqual([
      ['approved', APPROVER],
      ['created', APPROVER_2],
    ]);
  });
});

describe('actions on GET match what POST does, for every role', () => {
  it('for every seed refund, person and action', async () => {
    for (const s of SEED_REFUNDS) {
      for (const user of PEOPLE) {
        for (const action of ['approve', 'reject'] as const) {
          const { as, foundation } = setup();
          const decision = (await as(user).get(refundPath(s.id))).body.actions[action];
          const before = foundation.changeLog.size;
          const res = await as(user).post(refundPath(s.id, action), bodyFor(action));
          const label = `${user} ${action} ${s.id}`;
          if (decision.allowed) {
            expect(res.status, label).toBe(200);
            expect(res.body.status, label).toBe(action === 'approve' ? 'approved' : 'rejected');
            expect(foundation.changeLog.size, label).toBe(before + 1);
          } else {
            expect(res.status, label).toBe(403);
            expect(res.body.error, label).toEqual({ code: decision.code, message: decision.reason });
            expect(foundation.changeLog.size, label).toBe(before);
          }
        }
      }
    }
  });

  it('list rows carry the same actions as the detail view', async () => {
    const { as } = setup();
    for (const user of PEOPLE) {
      const rows = (await as(user).get(LIST)).body.rows as Row[];
      for (const r of rows) expect(r.actions, `${user} ${r.id}`).toEqual((await as(user).get(refundPath(r.id))).body.actions);
    }
  });
});

describe('no stuck refunds', () => {
  it('every open refund, seeded or new from any requester, can still be approved and rejected by someone', async () => {
    const { as } = setup();
    const ids = ((await as(OBSERVER).get(`${LIST}?status=pending`)).body.rows as Row[]).map((r) => r.id);
    for (const requester of [OPERATOR, OPERATOR_2, APPROVER, APPROVER_2]) ids.push((await as(requester).post(LIST, newRefund(150_000))).body.id);
    for (const id of ids) {
      const views = await Promise.all(PEOPLE.map(async (p) => (await as(p).get(refundPath(id))).body.actions));
      expect(views.some((a) => a.approve.allowed), `${id} approve`).toBe(true);
      expect(views.some((a) => a.reject.allowed), `${id} reject`).toBe(true);
    }
  });
});

describe('home', () => {
  const actionable = async (as: ReturnType<typeof setup>['as'], user: string, list: string) =>
    ((await as(user).get(list)).body.rows as Row[]).filter((r) => r.actions.approve.allowed).length;

  it("waitingOnYou matches each person's actionable rows across every app", async () => {
    const { as } = setup();
    for (const user of PEOPLE) {
      const expected = (await actionable(as, user, LIST)) + (await actionable(as, user, '/apps/kyc/cases'));
      expect((await as(user).get('/home')).body.waitingOnYou, user).toBe(expected);
    }
  });

  it('with only Refunds mounted, counts and spotlight come from Refunds', async () => {
    const { as } = setup([refundsApp]);
    const counts = await Promise.all(PEOPLE.map((u) => actionable(as, u, LIST)));
    // Open: RF-2001 (Priya's), RF-2002 (Maya's), RF-2003 (Diego's). Only Approvers decide, never their own.
    expect(counts).toEqual([0, 0, 2, 3, 0]);
    const homes = await Promise.all(PEOPLE.map(async (u) => (await as(u).get('/home')).body));
    expect(homes.map((h) => h.waitingOnYou)).toEqual(counts);
    expect(homes.map((h) => h.yourOpenRequests)).toEqual([1, 1, 1, 0, 0]);
    expect(homes.map((h) => h.spotlight)).toEqual([
      { app: 'refunds', recordId: REFUND_PENDING_BY_OPERATOR, reason: 'yours' },
      { app: 'refunds', recordId: REFUND_PENDING_BY_OPERATOR_2, reason: 'yours' },
      { app: 'refunds', recordId: REFUND_PENDING_BY_OPERATOR_2, reason: 'waiting_on_you' },
      { app: 'refunds', recordId: REFUND_PENDING_BY_OPERATOR_2, reason: 'waiting_on_you' },
      { app: 'refunds', recordId: REFUND_PENDING_BY_OPERATOR_2, reason: 'oldest' },
    ]);
  });

  it('the app list shows the open count', async () => {
    const { as } = setup();
    const app = ((await as(OBSERVER).get('/apps')).body as Array<{ id: string }>).find((a) => a.id === 'refunds');
    expect(app).toMatchObject({ name: 'Refunds Dashboard', route: '/refunds', icon: 'wallet', openCount: 3, openLabel: 'open refunds' });
  });
});
