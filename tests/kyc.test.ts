import { describe, expect, it } from 'vitest';
import { SEED_CASES } from '../src/kyc/seed';
import {
  ALL_SEED_SSNS,
  APPROVER,
  APPROVER_2,
  KYC_APPROVED,
  KYC_HIGH_PENDING,
  KYC_HIGH_WAITING,
  KYC_LOW_BY_APPROVER,
  KYC_LOW_BY_OPERATOR_2,
  OBSERVER,
  OPERATOR,
  OPERATOR_2,
  setup,
} from './helpers';

const casePath = (id: string, action?: string) => `/apps/kyc/cases/${id}${action ? `/${action}` : ''}`;

describe('KYC seed data', () => {
  it('has 10 fictional cases, exactly 2 high-risk, with every required field', async () => {
    expect(SEED_CASES).toHaveLength(10);
    expect(SEED_CASES.filter((c) => c.risk === 'high')).toHaveLength(2);
    const { as } = setup();
    const rows = (await as(OPERATOR).get('/apps/kyc/cases')).body.rows;
    expect(rows).toHaveLength(10);
    for (const r of rows) {
      for (const k of ['customerName', 'ssn', 'risk', 'status', 'reviewReason', 'summary', 'openedAt']) expect(r[k], `${r.id} ${k}`).toBeTruthy();
    }
    expect(new Set(rows.map((r: { status: string }) => r.status))).toEqual(new Set(['pending', 'waiting', 'approved', 'rejected']));
  });
});

describe('high-risk escalation', () => {
  it('approving a pending high-risk case sends it to waiting for approver; only an Approver can then approve', async () => {
    const { as, foundation } = setup();
    const before = foundation.changeLog.size;

    const view = (await as(OPERATOR).get(casePath(KYC_HIGH_PENDING))).body;
    expect(view.approveEscalates).toBe(true);
    expect(view.actions.approve).toEqual({ allowed: true });

    const first = await as(OPERATOR).post(casePath(KYC_HIGH_PENDING, 'approve'), { note: 'Different DOB, not the listed person' });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ status: 'waiting', escalatedBy: { id: OPERATOR }, decidedBy: null, approveEscalates: false });
    expect(foundation.changeLog.size).toBe(before + 1);

    // Operators can no longer approve or reject it — and the view says why.
    const opView = (await as(OPERATOR_2).get(casePath(KYC_HIGH_PENDING))).body;
    expect(opView.actions.approve).toEqual({ allowed: false, code: 'role', reason: 'Approvers only' });
    expect(opView.actions.reject).toEqual({ allowed: false, code: 'role', reason: 'Approvers only' });
    for (const [action, body] of [['approve', {}], ['reject', { note: 'no' }]] as const) {
      const res = await as(OPERATOR_2).post(casePath(KYC_HIGH_PENDING, action), body);
      expect(res.status, action).toBe(403);
      expect(res.body.error, action).toEqual({ code: 'role', message: 'Approvers only' });
    }
    expect(foundation.changeLog.size).toBe(before + 1);

    const final = await as(APPROVER).post(casePath(KYC_HIGH_PENDING, 'approve'));
    expect(final.status).toBe(200);
    expect(final.body).toMatchObject({ status: 'approved', decidedBy: { id: APPROVER }, escalatedBy: { id: OPERATOR } });
    expect(foundation.changeLog.size).toBe(before + 2);

    const history = (await as(OBSERVER).get(`/changes?app=kyc&recordId=${KYC_HIGH_PENDING}`)).body;
    expect(history.map((e: { action: string }) => e.action)).toEqual(['approved', 'waiting', 'created']);
  });

  it('an Approver approving a pending high-risk case also escalates it, and must leave final sign-off to another Approver', async () => {
    const { as } = setup();
    const first = await as(APPROVER).post(casePath(KYC_HIGH_PENDING, 'approve'));
    expect(first.body.status).toBe('waiting');
    expect(first.body.actions.approve).toMatchObject({ allowed: false, code: 'self_escalated' });
    const again = await as(APPROVER).post(casePath(KYC_HIGH_PENDING, 'approve'));
    expect(again.status).toBe(403);
    expect(again.body.error.code).toBe('self_escalated');
    expect((await as(APPROVER_2).post(casePath(KYC_HIGH_PENDING, 'approve'))).body.status).toBe('approved');
  });

  it('a waiting case can be approved or rejected only by an Approver who did not open it', async () => {
    const { as } = setup();
    const own = await as(APPROVER).post(casePath(KYC_HIGH_WAITING, 'approve'));
    expect(own.status).toBe(403);
    expect(own.body.error).toEqual({ code: 'self_approval', message: "You can't approve your own request" });
    expect((await as(OPERATOR).post(casePath(KYC_HIGH_WAITING, 'approve'))).body.error.message).toBe('Approvers only');
    expect((await as(OBSERVER).post(casePath(KYC_HIGH_WAITING, 'approve'))).body.error.message).toBe('Observers have read-only access');
    const ok = await as(APPROVER_2).post(casePath(KYC_HIGH_WAITING, 'reject'), { note: 'Source of funds not proven' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'rejected', decidedBy: { id: APPROVER_2 } });
  });

  it('a pending high-risk case can be rejected by an Operator', async () => {
    const { as } = setup();
    const res = await as(OPERATOR).post(casePath(KYC_HIGH_PENDING, 'reject'), { note: 'Confirmed watchlist match' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
  });
});

describe('low-risk cases', () => {
  it('Operators and Approvers can approve or reject them directly', async () => {
    const { as } = setup();
    const view = (await as(OPERATOR).get(casePath(KYC_LOW_BY_OPERATOR_2))).body;
    expect(view).toMatchObject({ approveEscalates: false, actions: { approve: { allowed: true }, reject: { allowed: true } } });
    const approved = await as(OPERATOR).post(casePath(KYC_LOW_BY_OPERATOR_2, 'approve'));
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ status: 'approved', decidedBy: { id: OPERATOR }, escalatedBy: null });
    const rejected = await as(APPROVER_2).post(casePath(KYC_LOW_BY_APPROVER, 'reject'), { note: 'Selfie mismatch' });
    expect(rejected.body).toMatchObject({ status: 'rejected', decidedBy: { id: APPROVER_2 } });
  });

  it('rejection needs a note, and decided cases are closed', async () => {
    const { as } = setup();
    const noNote = await as(OPERATOR).post(casePath(KYC_LOW_BY_OPERATOR_2, 'reject'));
    expect(noNote.status).toBe(400);
    const closed = await as(APPROVER).post(casePath(KYC_APPROVED, 'reject'), { note: 'x' });
    expect(closed.status).toBe(403);
    expect(closed.body.error.message).toBe('This request is already approved');
  });

  it('Observers are read-only', async () => {
    const { as } = setup();
    const view = (await as(OBSERVER).get(casePath(KYC_LOW_BY_OPERATOR_2))).body;
    expect(view.actions.approve).toMatchObject({ allowed: false, reason: 'Observers have read-only access' });
    expect((await as(OBSERVER).post(casePath(KYC_LOW_BY_OPERATOR_2, 'approve'))).status).toBe(403);
  });
});

describe('no self-approval', () => {
  it('nobody can approve or reject a case they opened, whatever their role or the risk', async () => {
    const { as, foundation } = setup();
    const before = foundation.changeLog.size;
    for (const [user, id] of [
      [OPERATOR_2, KYC_LOW_BY_OPERATOR_2],
      [OPERATOR_2, KYC_HIGH_PENDING],
      [APPROVER, KYC_LOW_BY_APPROVER],
      [APPROVER, KYC_HIGH_WAITING],
    ]) {
      const view = (await as(user).get(casePath(id))).body;
      expect(view.actions.approve, `${user} ${id}`).toMatchObject({ allowed: false, code: 'self_approval' });
      expect(view.actions.reject, `${user} ${id}`).toMatchObject({ allowed: false, code: 'self_approval' });
      expect((await as(user).post(casePath(id, 'approve'))).body.error.code).toBe('self_approval');
      expect((await as(user).post(casePath(id, 'reject'), { note: 'mine' })).body.error.code).toBe('self_approval');
    }
    expect(foundation.changeLog.size).toBe(before);
  });
});

describe('change log', () => {
  const kycCount = async (as: ReturnType<typeof setup>['as']) => ((await as(OBSERVER).get('/changes?app=kyc')).body as unknown[]).length;

  it('seed history: one entry per opened case, escalation and decision', async () => {
    const { as } = setup();
    expect(await kycCount(as)).toBe(SEED_CASES.length + SEED_CASES.filter((c) => c.escalated).length + SEED_CASES.filter((c) => c.outcome).length);
  });

  it.each([
    ['escalate', OPERATOR, casePath(KYC_HIGH_PENDING, 'approve'), {}],
    ['final approve', APPROVER_2, casePath(KYC_HIGH_WAITING, 'approve'), {}],
    ['approve low', OPERATOR, casePath(KYC_LOW_BY_OPERATOR_2, 'approve'), {}],
    ['reject', APPROVER, casePath(KYC_LOW_BY_OPERATOR_2, 'reject'), { note: 'No' }],
  ])('%s adds exactly one entry', async (_n, user, path, body) => {
    const { as } = setup();
    const before = await kycCount(as);
    const res = await as(user).post(path, body);
    expect(res.status).toBe(200);
    expect(await kycCount(as)).toBe(before + 1);
    const [latest] = (await as(OBSERVER).get('/changes?limit=1')).body;
    expect(latest).toMatchObject({ app: 'kyc', recordId: res.body.id, actor: { id: user } });
  });

  it.each([
    ['operator final approve', OPERATOR, casePath(KYC_HIGH_WAITING, 'approve'), {}],
    ['self approve', OPERATOR_2, casePath(KYC_LOW_BY_OPERATOR_2, 'approve'), {}],
    ['observer reject', OBSERVER, casePath(KYC_LOW_BY_OPERATOR_2, 'reject'), { note: 'x' }],
    ['reject without note', APPROVER, casePath(KYC_LOW_BY_OPERATOR_2, 'reject'), {}],
    ['closed case', APPROVER, casePath(KYC_APPROVED, 'approve'), {}],
    ['unknown case', APPROVER, casePath('KYC-9999', 'approve'), {}],
  ])('refused change (%s) adds no entry', async (_n, user, path, body) => {
    const { as } = setup();
    const before = await kycCount(as);
    expect((await as(user).post(path, body)).status).toBeGreaterThanOrEqual(400);
    expect(await kycCount(as)).toBe(before);
  });
});

describe('SSNs never leave the server unmasked', () => {
  const leaks = (json: string) => ALL_SEED_SSNS.some((s) => json.includes(s) || json.includes(s.replace(/-/g, '')) || json.includes(s.slice(0, 6)));

  it('no raw SSN in any KYC response, the change log or home, for any role, before and after changes', async () => {
    const { as } = setup();
    const paths = ['/apps/kyc/cases', ...SEED_CASES.map((c) => casePath(c.id)), '/changes', '/changes?app=kyc', '/home', '/apps'];
    const check = async () => {
      for (const user of [OPERATOR, APPROVER, OBSERVER]) {
        for (const path of paths) {
          const res = await as(user).get(path);
          expect(res.status, `${user} ${path}`).toBe(200);
          expect(leaks(JSON.stringify(res.body)), `${user} ${path}`).toBe(false);
        }
      }
    };
    await check();
    const raw = SEED_CASES[0].ssn;
    for (const res of [
      await as(OPERATOR).post(casePath(KYC_HIGH_PENDING, 'approve'), { note: `Checked ${raw}` }),
      await as(APPROVER).post(casePath(KYC_HIGH_PENDING, 'approve'), { note: `SSN ${raw.replace(/-/g, '')}` }),
      await as(OPERATOR).post(casePath(KYC_LOW_BY_OPERATOR_2, 'approve')),
      await as(APPROVER_2).post(casePath(KYC_LOW_BY_APPROVER, 'reject'), { note: `Mismatch ${raw}` }),
    ]) {
      expect(res.status).toBe(200);
      expect(leaks(JSON.stringify(res.body))).toBe(false);
    }
    await check();
  });

  it('shows the last 4 to Operators and Approvers, nothing to Observers, and stores only the fully masked value in the log', async () => {
    const { as } = setup();
    const last4 = SEED_CASES[0].ssn.slice(-4);
    expect((await as(OPERATOR).get(casePath(KYC_HIGH_PENDING))).body.ssn).toBe(`•••-••-${last4}`);
    expect((await as(APPROVER).get(casePath(KYC_HIGH_PENDING))).body.ssn).toBe(`•••-••-${last4}`);
    expect((await as(OBSERVER).get(casePath(KYC_HIGH_PENDING))).body.ssn).toBe('•••-••-••••');
    const log = (await as(APPROVER).get(`/changes?recordId=${KYC_HIGH_PENDING}`)).body;
    expect(log[0].after.ssn).toBe('•••-••-••••');
  });
});

describe('home', () => {
  it('counts what each person can act on and spotlights it', async () => {
    const { as } = setup();
    const actionable = async (user: string) =>
      ((await as(user).get('/apps/kyc/cases')).body.rows as Array<{ actions: { approve: { allowed: boolean } } }>).filter((r) => r.actions.approve.allowed).length;
    const people = [APPROVER, APPROVER_2, OPERATOR, OBSERVER];
    const counts = await Promise.all(people.map(actionable));
    // Open: 1001 (high), 1002, 1003 (Priya's), 1004 (Maya's), 1009 (Samuel's), 1005 (waiting, Priya's).
    expect(counts).toEqual([4, 5, 4, 0]);
    const homes = await Promise.all(people.map(async (p) => (await as(p).get('/home')).body));
    expect(homes.map((h) => h.waitingOnYou)).toEqual(counts);
    expect(homes[0].spotlight).toMatchObject({ app: 'kyc', reason: 'waiting_on_you' });
  });
});
