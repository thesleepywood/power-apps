import express from 'express';
import { SEED_CASES } from './seed';
import type { KycStatus, RiskLevel } from './types';
import { approveEscalates, canApproveCase, KYC_APPROVAL, kycCaseOf } from './view';
import type { ServerAppFactory } from '../foundation/server/apps';
import { canDecide, decide, escalate, isOpen, type Approvable } from '../foundation/server/approvals';
import { invalid } from '../foundation/server/errors';
import type { Foundation } from '../foundation/server/foundation';
import { currentUser } from '../foundation/server/http';
import { maskSsn } from '../foundation/server/masking';
import { enforce } from '../foundation/server/permissions';
import { findUser } from '../foundation/shared/users';

export interface KycCase extends Approvable {
  status: KycStatus;
  customerName: string;
  /** Stored in full on the server only. */
  ssn: string;
  risk: RiskLevel;
  reviewReason: string;
  summary: string;
}

const HOUR = 3_600_000;

function createCollection(foundation: Foundation) {
  return foundation.collection<KycCase>({
    app: 'kyc',
    recordType: 'KYC case',
    label: (c) => `${c.id} · ${c.customerName}`,
    // The change log never keeps a usable SSN.
    redact: ({ ssn, ...rest }) => ({ ...rest, ssn: maskSsn(ssn, 'full') }),
  });
}

type Cases = ReturnType<typeof createCollection>;

function seed(foundation: Foundation, cases: Cases) {
  const now = foundation.now().getTime();
  const events: Array<{ at: number; run: () => void }> = [];
  const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR);
  for (const s of SEED_CASES) {
    const openedAt = at(s.openedHoursAgo);
    events.push({
      at: openedAt.getTime(),
      run: () =>
        foundation.change(findUser(s.openedBy)!, cases, {
          action: 'created',
          summary: 'Opened case',
          at: openedAt,
          apply: () => ({
            id: s.id,
            customerName: s.customerName,
            ssn: s.ssn,
            risk: s.risk,
            reviewReason: s.reviewReason,
            summary: s.summary,
            status: 'pending' as const,
            requestedBy: s.openedBy,
            requestedAt: openedAt.toISOString(),
          }),
        }),
    });
    const e = s.escalated;
    if (e) {
      events.push({ at: at(e.hoursAgo).getTime(), run: () => escalate(foundation, findUser(e.by)!, cases, s.id, { note: e.note, at: at(e.hoursAgo) }, KYC_APPROVAL) });
    }
    const o = s.outcome;
    if (o) {
      events.push({
        at: at(o.hoursAgo).getTime(),
        run: () => decide(foundation, findUser(o.by)!, cases, s.id, { decision: o.status, note: o.note, at: at(o.hoursAgo) }, KYC_APPROVAL),
      });
    }
  }
  events.sort((a, b) => a.at - b.at).forEach((e) => e.run());
}

export const kycApp: ServerAppFactory = (foundation) => {
  const cases = createCollection(foundation);
  seed(foundation, cases);

  const open = () => cases.all().filter(isOpen);
  const router = express.Router();

  router.get('/cases', (req, res) => {
    const user = currentUser(res);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = cases
      .all()
      .filter((c) => !status || c.status === status)
      .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))
      .map((c) => kycCaseOf(c, user));
    res.json({ rows });
  });

  router.get('/cases/:id', (req, res) => {
    res.json(kycCaseOf(cases.require(req.params.id), currentUser(res)));
  });

  router.post('/cases/:id/approve', (req, res) => {
    const user = currentUser(res);
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
    const current = cases.require(req.params.id);
    const updated = approveEscalates(current)
      ? escalate(foundation, user, cases, current.id, { note, summary: 'Approved — sent to an Approver' }, KYC_APPROVAL)
      : decide(foundation, user, cases, current.id, { decision: 'approved', note }, KYC_APPROVAL);
    res.json(kycCaseOf(updated, user));
  });

  router.post('/cases/:id/reject', (req, res) => {
    const user = currentUser(res);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!note) {
      // Check permission first so the "why not" is about who, not about the missing note.
      enforce(canDecide(user, cases.require(req.params.id), 'rejected', KYC_APPROVAL));
      throw invalid('Add a short note explaining the rejection.');
    }
    res.json(kycCaseOf(decide(foundation, user, cases, req.params.id, { decision: 'rejected', note }, KYC_APPROVAL), user));
  });

  return {
    id: 'kyc',
    router,
    openLabel: 'open cases',
    openCount: () => open().length,
    waitingOn: (user) => open().filter((c) => canApproveCase(user, c).allowed).length,
    openedBy: (user) => open().filter((c) => c.requestedBy === user.id).length,
    spotlight: (user) => {
      const sorted = open().sort((a, b) => (a.requestedAt < b.requestedAt ? -1 : 1));
      const actionable = sorted.find((c) => canApproveCase(user, c).allowed);
      if (actionable) return { recordId: actionable.id, reason: 'waiting_on_you' };
      const yours = sorted.find((c) => c.requestedBy === user.id);
      if (yours) return { recordId: yours.id, reason: 'yours' };
      return sorted[0] ? { recordId: sorted[0].id, reason: 'oldest' } : null;
    },
  };
};
