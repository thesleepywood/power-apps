import { describe, expect, it } from 'vitest';
import { maskSsn, maskTail, ssnForViewer } from '../src/foundation/server/masking';
import { findUser } from '../src/foundation/shared/users';
import { ALL_SEED_SSNS, APPROVER, NEW_REQUEST, OBSERVER, OPERATOR, PENDING_BY_OPERATOR, setup } from './helpers';

describe('maskSsn', () => {
  it('keeps only the last four digits', () => {
    expect(maskSsn('921-55-4401')).toBe('•••-••-4401');
    expect(maskSsn('921554401')).toBe('•••-••-4401');
  });
  it('can hide everything', () => {
    expect(maskSsn('921-55-4401', 'full')).toBe('•••-••-••••');
  });
  it('never leaks digits from short or malformed input', () => {
    expect(maskSsn('12')).toBe('•••-••-••••');
    expect(maskSsn('')).toBe('•••-••-••••');
  });
  it('masks by viewer role: Observers see nothing', () => {
    expect(ssnForViewer('921-55-4401', findUser(OPERATOR)!)).toBe('•••-••-4401');
    expect(ssnForViewer('921-55-4401', findUser(APPROVER)!)).toBe('•••-••-4401');
    expect(ssnForViewer('921-55-4401', findUser(OBSERVER)!)).toBe('•••-••-••••');
  });
  it('maskTail keeps a visible suffix', () => {
    expect(maskTail('123456789', 4)).toBe('•••••6789');
    expect(maskTail('123', 4)).toBe('•••');
  });
});

describe('sensitive data never leaves the server unmasked', () => {
  const containsRawSsn = (json: string, ssns: string[]) =>
    ssns.some((s) => json.includes(s) || json.includes(s.replace(/-/g, '')) || json.includes(s.slice(0, 6)));

  it('list, detail, change log and home responses contain no full SSN for any role', async () => {
    const { as } = setup();
    for (const user of [OPERATOR, APPROVER, OBSERVER]) {
      for (const path of ['/apps/approvals/requests', `/apps/approvals/requests/${PENDING_BY_OPERATOR}`, '/changes', '/home', '/apps']) {
        const res = await as(user).get(path);
        expect(res.status).toBe(200);
        expect(containsRawSsn(JSON.stringify(res.body), ALL_SEED_SSNS), `${user} ${path}`).toBe(false);
      }
    }
  });

  it('a newly created record is masked in its response and in the change log', async () => {
    const { as } = setup();
    const created = await as(OPERATOR).post('/apps/approvals/requests', NEW_REQUEST);
    expect(created.status).toBe(201);
    expect(created.body.customerSsn).toBe('•••-••-2222');
    const log = await as(APPROVER).get(`/changes?recordId=${created.body.id}`);
    expect(JSON.stringify(log.body)).not.toContain('900-11-2222');
    expect(log.body[0].after.customerSsn).toBe('•••-••-••••');
  });

  it('Observers get the fully masked value', async () => {
    const { as } = setup();
    const res = await as(OBSERVER).get(`/apps/approvals/requests/${PENDING_BY_OPERATOR}`);
    expect(res.body.customerSsn).toBe('•••-••-••••');
  });
});
