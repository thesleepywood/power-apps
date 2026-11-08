import request from 'supertest';
import { createApiApp } from '../src/foundation/server/createApi';
import { SERVER_APPS } from '../src/server/apps';
import { SEED_CASES } from '../src/kyc/seed';
import type { ServerAppFactory } from '../src/foundation/server/apps';

export const NOW = new Date('2026-11-07T18:00:00.000Z');

/** A fresh in-memory API. Pass `apps` to mount only some apps (e.g. to test one app's Home spotlight). */
export function setup(apps: ServerAppFactory[] = SERVER_APPS) {
  const { app, foundation } = createApiApp({ apps, now: () => NOW });
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

export const ALL_SEED_SSNS = SEED_CASES.map((c) => c.ssn);

/** KYC: high-risk, pending, opened by Operator 2 (Diego). */
export const KYC_HIGH_PENDING = 'KYC-1001';
/** KYC: high-risk, waiting for approver, opened by Approver 1 (Priya), sent on by Operator 2 (Diego). */
export const KYC_HIGH_WAITING = 'KYC-1005';
/** KYC: low-risk, pending, opened by Operator 2 (Diego). */
export const KYC_LOW_BY_OPERATOR_2 = 'KYC-1002';
/** KYC: low-risk, pending, opened by Approver 1 (Priya). */
export const KYC_LOW_BY_APPROVER = 'KYC-1003';
export const KYC_APPROVED = 'KYC-1006';

/** Refunds: $1,850 pending, requested by Approver 1 (Priya). */
export const REFUND_PENDING_BY_APPROVER = 'RF-2001';
/** Refunds: $1,240 pending, requested by Operator 1 (Maya). */
export const REFUND_PENDING_BY_OPERATOR = 'RF-2002';
/** Refunds: $1,499.99 pending, requested by Operator 2 (Diego). */
export const REFUND_PENDING_BY_OPERATOR_2 = 'RF-2003';
/** Refunds: $1,100 requested by Approver 2 (Samuel), approved by Approver 1 (Priya). */
export const REFUND_APPROVED = 'RF-2004';
/** Refunds: $2,000 requested by Operator 2 (Diego), rejected by Approver 2 (Samuel). */
export const REFUND_REJECTED = 'RF-2005';
/** Refunds: $5 requested by Operator 1 (Maya), approved automatically. */
export const REFUND_AUTO_APPROVED = 'RF-2006';
/** Refunds: exactly $1,000 requested by Approver 1 (Priya), approved automatically. */
export const REFUND_AT_LIMIT = 'RF-2008';
