import { describe, expect, it } from 'vitest';
import { maskSsn, maskTail, scrubSsns, ssnForViewer } from '../src/foundation/server/masking';
import { findUser } from '../src/foundation/shared/users';
import { SEED_CASES } from '../src/kyc/seed';
import { ALL_SEED_SSNS, APPROVER, APPROVER_2, KYC_HIGH_PENDING, OBSERVER, OPERATOR, setup } from './helpers';

const casePath = (id: string, action?: string) => `/apps/kyc/cases/${id}${action ? `/${action}` : ''}`;

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
      for (const path of ['/apps/kyc/cases', casePath(KYC_HIGH_PENDING), '/changes', '/home', '/apps']) {
        const res = await as(user).get(path);
        expect(res.status).toBe(200);
        expect(containsRawSsn(JSON.stringify(res.body), ALL_SEED_SSNS), `${user} ${path}`).toBe(false);
      }
    }
  });

  it('a changed record is masked in its response and in the change log', async () => {
    const { as } = setup();
    const raw = SEED_CASES.find((c) => c.id === KYC_HIGH_PENDING)!.ssn;
    const changed = await as(OPERATOR).post(casePath(KYC_HIGH_PENDING, 'approve'));
    expect(changed.status).toBe(200);
    expect(changed.body.ssn).toBe(`•••-••-${raw.slice(-4)}`);
    const log = await as(APPROVER).get(`/changes?recordId=${KYC_HIGH_PENDING}`);
    expect(JSON.stringify(log.body)).not.toContain(raw);
    expect(log.body[0].after.ssn).toBe('•••-••-••••');
  });

  it('Observers get the fully masked value', async () => {
    const { as } = setup();
    const res = await as(OBSERVER).get(casePath(KYC_HIGH_PENDING));
    expect(res.body.ssn).toBe('•••-••-••••');
  });
});

describe('SSNs typed into free text', () => {
  it('scrubSsns hides SSN-shaped numbers and leaves other text alone', () => {
    expect(scrubSsns('Caller 921-55-4401 confirmed, ref 921554401')).toBe('Caller •••-••-•••• confirmed, ref •••-••-••••');
    expect(scrubSsns('Amount $1,840.50 on 2026-11-07, card 4111111111111111')).toBe('Amount $1,840.50 on 2026-11-07, card 4111111111111111');
  });

  it('are never stored or returned from decision notes', async () => {
    const { as } = setup();
    const raw = '987-65-4329';
    const sent = await as(OPERATOR).post(casePath(KYC_HIGH_PENDING, 'approve'), { note: `Caller gave ${raw.replace(/-/g, '')}` });
    expect(sent.status).toBe(200);
    const rejected = await as(APPROVER_2).post(casePath(KYC_HIGH_PENDING, 'reject'), { note: `Mismatch on ${raw}` });
    expect(rejected.status).toBe(200);
    for (const user of [OPERATOR, APPROVER, OBSERVER]) {
      for (const path of [casePath(KYC_HIGH_PENDING), '/apps/kyc/cases', '/changes', '/home']) {
        const body = JSON.stringify((await as(user).get(path)).body);
        expect(body.includes(raw) || body.includes(raw.replace(/-/g, '')), `${user} ${path}`).toBe(false);
      }
    }
  });
});
