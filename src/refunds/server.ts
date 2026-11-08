import express from 'express';
import { SEED_REFUNDS } from './seed';
import type { RefundList, RefundStatus } from './types';
import { AUTO_APPROVE_LIMIT_CENTS, canApproveRefund, canRejectRefund, canRequestRefund, needsApprover, REFUND_APPROVAL, refundOf } from './view';
import type { ServerAppFactory } from '../foundation/server/apps';
import { decide, isOpen, type Approvable } from '../foundation/server/approvals';
import { invalid } from '../foundation/server/errors';
import type { Foundation } from '../foundation/server/foundation';
import { currentUser } from '../foundation/server/http';
import { scrubSsns } from '../foundation/server/masking';
import { enforce } from '../foundation/server/permissions';
import { findUser, type User } from '../foundation/shared/users';

export interface Refund extends Approvable {
  status: RefundStatus;
  customer: string;
  amountCents: number;
  reason: string;
  summary: string;
  /** Approved on request because it was at or under the limit. */
  autoApproved?: boolean;
}

const HOUR = 3_600_000;
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dollars = (cents: number) => money.format(cents / 100);

function createCollection(foundation: Foundation) {
  return foundation.collection<Refund>({
    app: 'refunds',
    recordType: 'Refund',
    label: (r) => `${r.id} · ${r.customer} · ${dollars(r.amountCents)}`,
    // Refunds hold no SSNs, but free text could: the change log never keeps an SSN-shaped number.
    redact: (r) => ({
      ...r,
      customer: scrubSsns(r.customer),
      reason: scrubSsns(r.reason),
      summary: scrubSsns(r.summary),
      ...(r.decisionNote ? { decisionNote: scrubSsns(r.decisionNote) } : {}),
    }),
  });
}

type Refunds = ReturnType<typeof createCollection>;

export interface RefundRequest {
  id?: string;
  customer?: unknown;
  amountCents?: unknown;
  reason?: unknown;
  summary?: unknown;
}

const text = (v: unknown) => (typeof v === 'string' ? scrubSsns(v.trim()) : '');

function nextId(refunds: Refunds) {
  const max = Math.max(2000, ...refunds.all().map((r) => Number(r.id.replace(/\D/g, '')) || 0));
  return `RF-${max + 1}`;
}

/**
 * Requests a refund. At or under the limit it's approved in the same change (one log entry):
 * the limit approves it, not the requester, so `decidedBy` stays empty.
 */
function requestRefund(foundation: Foundation, actor: User, refunds: Refunds, input: RefundRequest, at?: Date) {
  const auto = typeof input.amountCents === 'number' && !needsApprover(input.amountCents);
  return foundation.change(actor, refunds, {
    action: 'created',
    summary: auto ? 'Requested refund — approved automatically ($1,000 or less)' : 'Requested refund — needs an Approver',
    at,
    apply: () => {
      enforce(canRequestRefund(actor));
      const customer = text(input.customer);
      const reason = text(input.reason);
      const amountCents = input.amountCents;
      if (!customer) throw invalid('Add the customer this refund is for.');
      if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents <= 0) {
        throw invalid('Enter an amount greater than $0.00.');
      }
      if (!reason) throw invalid('Add a reason for the refund.');
      const when = (at ?? foundation.now()).toISOString();
      const base = {
        id: input.id ?? nextId(refunds),
        customer,
        amountCents,
        reason,
        summary: text(input.summary),
        requestedBy: actor.id,
        requestedAt: when,
      };
      return needsApprover(amountCents)
        ? { ...base, status: 'pending' as const }
        : { ...base, status: 'approved' as const, autoApproved: true, decidedAt: when };
    },
  });
}

function seed(foundation: Foundation, refunds: Refunds) {
  const now = foundation.now().getTime();
  const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR);
  const events: Array<{ at: number; run: () => void }> = [];
  for (const s of SEED_REFUNDS) {
    const requestedAt = at(s.requestedHoursAgo);
    events.push({ at: requestedAt.getTime(), run: () => requestRefund(foundation, findUser(s.requestedBy)!, refunds, s, requestedAt) });
    const o = s.outcome;
    if (o) {
      events.push({
        at: at(o.hoursAgo).getTime(),
        run: () => decide(foundation, findUser(o.by)!, refunds, s.id, { decision: o.status, note: o.note, at: at(o.hoursAgo) }, REFUND_APPROVAL),
      });
    }
  }
  events.sort((a, b) => a.at - b.at).forEach((e) => e.run());
}

export const refundsApp: ServerAppFactory = (foundation) => {
  const refunds = createCollection(foundation);
  seed(foundation, refunds);

  const open = () => refunds.all().filter(isOpen);
  const router = express.Router();

  router.get('/refunds', (req, res) => {
    const user = currentUser(res);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = refunds
      .all()
      .filter((r) => !status || r.status === status)
      .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))
      .map((r) => refundOf(r, user));
    const body: RefundList = { rows, actions: { request: canRequestRefund(user) }, autoApproveLimitCents: AUTO_APPROVE_LIMIT_CENTS };
    res.json(body);
  });

  router.get('/refunds/:id', (req, res) => {
    res.json(refundOf(refunds.require(req.params.id), currentUser(res)));
  });

  router.post('/refunds', (req, res) => {
    const user = currentUser(res);
    const { customer, amountCents, reason, summary } = req.body ?? {};
    const created = requestRefund(foundation, user, refunds, { customer, amountCents, reason, summary });
    res.status(201).json(refundOf(created, user));
  });

  router.post('/refunds/:id/approve', (req, res) => {
    const user = currentUser(res);
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
    res.json(refundOf(decide(foundation, user, refunds, req.params.id, { decision: 'approved', note }, REFUND_APPROVAL), user));
  });

  router.post('/refunds/:id/reject', (req, res) => {
    const user = currentUser(res);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    // Check permission first so the "why not" is about who, not about the missing note.
    enforce(canRejectRefund(user, refunds.require(req.params.id)));
    if (!note) throw invalid('Add a short note explaining the rejection.');
    res.json(refundOf(decide(foundation, user, refunds, req.params.id, { decision: 'rejected', note }, REFUND_APPROVAL), user));
  });

  return {
    id: 'refunds',
    router,
    openLabel: 'open refunds',
    openCount: () => open().length,
    waitingOn: (user) => open().filter((r) => canApproveRefund(user, r).allowed).length,
    openedBy: (user) => open().filter((r) => r.requestedBy === user.id).length,
    spotlight: (user) => {
      const sorted = open().sort((a, b) => (a.requestedAt < b.requestedAt ? -1 : 1));
      const actionable = sorted.find((r) => canApproveRefund(user, r).allowed);
      if (actionable) return { recordId: actionable.id, reason: 'waiting_on_you' };
      const yours = sorted.find((r) => r.requestedBy === user.id);
      if (yours) return { recordId: yours.id, reason: 'yours' };
      return sorted[0] ? { recordId: sorted[0].id, reason: 'oldest' } : null;
    },
  };
};
