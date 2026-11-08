import { describe, expect, it } from 'vitest';
import { Foundation } from '../src/foundation/server/foundation';
import { ApiError } from '../src/foundation/server/errors';
import { findUser } from '../src/foundation/shared/users';
import { SEED_REQUESTS } from '../src/approvals/seed';
import { APPROVER, APPROVER_2, NEW_REQUEST, NOW, OBSERVER, OPERATOR, OPERATOR_2, PENDING_BY_APPROVER, PENDING_BY_OPERATOR, setup } from './helpers';

describe('Foundation.change', () => {
  const make = () => {
    const f = new Foundation(() => NOW);
    const things = f.collection<{ id: string; n: number }>({ app: 'test', recordType: 'Thing', label: (t) => t.id, redact: (t) => ({ ...t }) });
    return { f, things, actor: findUser(OPERATOR)! };
  };

  it('writes exactly one entry per change, with who, what, when, before and after', () => {
    const { f, things, actor } = make();
    f.change(actor, things, { action: 'created', summary: 'Created', apply: () => ({ id: 't1', n: 1 }) });
    f.change(actor, things, { id: 't1', action: 'edited', summary: 'Bumped', apply: (t) => ({ ...t!, n: 2 }) });
    expect(f.changeLog.size).toBe(2);
    const [latest, first] = f.changeLog.list();
    expect(first).toMatchObject({ action: 'created', before: null, after: { id: 't1', n: 1 } });
    expect(latest).toMatchObject({
      at: NOW.toISOString(),
      actor: { id: actor.id, name: actor.name, role: 'operator' },
      app: 'test',
      recordId: 't1',
      action: 'edited',
      summary: 'Bumped',
      before: { n: 1 },
      after: { n: 2 },
    });
  });

  it('writes nothing and stores nothing when the change is refused', () => {
    const { f, things, actor } = make();
    f.change(actor, things, { action: 'created', summary: 'Created', apply: () => ({ id: 't1', n: 1 }) });
    expect(() =>
      f.change(actor, things, {
        id: 't1',
        action: 'edited',
        summary: 'Nope',
        apply: () => {
          throw new ApiError(403, 'no', 'No');
        },
      }),
    ).toThrow('No');
    expect(f.changeLog.size).toBe(1);
    expect(things.get('t1')!.n).toBe(1);
  });

  it('keeps entries immutable', () => {
    const { f, things, actor } = make();
    f.change(actor, things, { action: 'created', summary: 'Created', apply: () => ({ id: 't1', n: 1 }) });
    const entry = f.changeLog.list()[0];
    expect(() => {
      (entry as { summary: string }).summary = 'tampered';
    }).toThrow();
    expect(Object.isFrozen(entry.after)).toBe(true);
  });

  it('records are read-only copies outside of change()', () => {
    const { f, things, actor } = make();
    f.change(actor, things, { action: 'created', summary: 'Created', apply: () => ({ id: 't1', n: 1 }) });
    things.get('t1')!.n = 99;
    expect(things.get('t1')!.n).toBe(1);
  });
});

describe('one change-log entry per change, over HTTP', () => {
  const count = async (as: ReturnType<typeof setup>['as']) => (await as(OBSERVER).get('/changes')).body.length as number;

  it('seed history is in the log: one entry per opened request and per decision', async () => {
    const { as } = setup();
    const expected = SEED_REQUESTS.length + SEED_REQUESTS.filter((s) => s.outcome).length;
    expect((await as(OBSERVER).get('/changes?app=approvals')).body).toHaveLength(expected);
  });

  it.each([
    ['create', OPERATOR, '/apps/approvals/requests', NEW_REQUEST],
    ['approve', APPROVER_2, `/apps/approvals/requests/${PENDING_BY_OPERATOR}/approve`, {}],
    ['reject', APPROVER, `/apps/approvals/requests/${PENDING_BY_OPERATOR}/reject`, { note: 'Not enough history' }],
    ['withdraw', OPERATOR, `/apps/approvals/requests/${PENDING_BY_OPERATOR}/withdraw`, {}],
  ])('%s adds exactly one entry', async (_name, user, path, body) => {
    const { as } = setup();
    const before = await count(as);
    const res = await as(user).post(path, body);
    expect(res.status).toBeLessThan(300);
    expect(await count(as)).toBe(before + 1);
    const [latest] = (await as(OBSERVER).get('/changes?limit=1')).body;
    expect(latest.actor.id).toBe(user);
    expect(latest.recordId).toBe(res.body.id);
  });

  it.each([
    ['observer create', OBSERVER, '/apps/approvals/requests', NEW_REQUEST],
    ['operator approve', OPERATOR_2, `/apps/approvals/requests/${PENDING_BY_OPERATOR}/approve`, {}],
    ['self approve', APPROVER, `/apps/approvals/requests/${PENDING_BY_APPROVER}/approve`, {}],
    ['reject without note', APPROVER, `/apps/approvals/requests/${PENDING_BY_OPERATOR}/reject`, {}],
    ['invalid create', OPERATOR, '/apps/approvals/requests', { title: '' }],
    ['unknown record', APPROVER, '/apps/approvals/requests/APR-9999/approve', {}],
  ])('refused change (%s) adds no entry', async (_name, user, path, body) => {
    const { as } = setup();
    const before = await count(as);
    const res = await as(user).post(path, body);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await count(as)).toBe(before);
  });

  it('is newest first and filterable by record', async () => {
    const { as } = setup();
    const all = (await as(OPERATOR).get('/changes')).body as Array<{ at: string }>;
    expect([...all].sort((a, b) => (a.at < b.at ? 1 : -1)).map((e) => e.at)).toEqual(all.map((e) => e.at));
    const one = (await as(OPERATOR).get('/changes?app=approvals&recordId=APR-1002')).body as Array<{ action: string; recordId: string }>;
    expect(one.map((e) => e.action)).toEqual(['approved', 'created']);
    expect(one.every((e) => e.recordId === 'APR-1002')).toBe(true);
  });
});
