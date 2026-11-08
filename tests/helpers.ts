import request from 'supertest';
import { createApiApp } from '../src/foundation/server/createApi';
import { SERVER_APPS } from '../src/server/apps';
import { SEED_REQUESTS } from '../src/approvals/seed';
import { SEED_CASES } from '../src/kyc/seed';

export const NOW = new Date('2026-11-07T18:00:00.000Z');

export function setup() {
  const { app, foundation } = createApiApp({ apps: SERVER_APPS, now: () => NOW });
  const as = (userId: string | null) => {
    const withUser = (t: request.Test) => (userId ? t.set('x-keel-user', userId) : t);
    return {
      get: (path: string) => withUser(request(app).get(`/api${path}`)),
      post: (path: string, body: object = {}) => withUser(request(app).post(`/api${path}`)).send(body),
    };
  };
  return { app, foundation, as };
}

export const OPERATOR = 'u-maya';
export const OPERATOR_2 = 'u-diego';
export const APPROVER = 'u-priya';
export const APPROVER_2 = 'u-samuel';
export const OBSERVER = 'u-grace';

/** A pending request opened by an Operator (Maya). */
export const PENDING_BY_OPERATOR = 'APR-1001';
/** A pending request opened by an Approver (Priya). */
export const PENDING_BY_APPROVER = 'APR-1003';
export const APPROVED = 'APR-1002';

export const ALL_SEED_SSNS = [...SEED_REQUESTS.map((r) => r.customerSsn), ...SEED_CASES.map((c) => c.ssn)];

/** KYC: high-risk, pending, opened by Operator 2 (Diego). */
export const KYC_HIGH_PENDING = 'KYC-1001';
/** KYC: high-risk, waiting for approver, opened by Approver 1 (Priya), sent on by Operator 2 (Diego). */
export const KYC_HIGH_WAITING = 'KYC-1005';
/** KYC: low-risk, pending, opened by Operator 2 (Diego). */
export const KYC_LOW_BY_OPERATOR_2 = 'KYC-1002';
/** KYC: low-risk, pending, opened by Approver 1 (Priya). */
export const KYC_LOW_BY_APPROVER = 'KYC-1003';
export const KYC_APPROVED = 'KYC-1006';

export const NEW_REQUEST = {
  kind: 'Fee waiver',
  title: 'Waive monthly maintenance fee',
  customerName: 'Test Customer',
  customerSsn: '900-11-2222',
  amount: 15,
  reason: 'Goodwill after outage',
  summary: '',
};
