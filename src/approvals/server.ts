import express from 'express';
import { approvalOf } from './view';
import { SEED_REQUESTS } from './seed';
import { REQUEST_KINDS, type NewSignOffRequest, type RequestKind } from './types';
import type { ServerAppFactory } from '../foundation/server/apps';
import { canDecide, decide, withdraw, type Approvable } from '../foundation/server/approvals';
import { invalid } from '../foundation/server/errors';
import type { Foundation } from '../foundation/server/foundation';
import { currentUser } from '../foundation/server/http';
import { maskSsn, scrubSsns } from '../foundation/server/masking';
import { canChange, enforce } from '../foundation/server/permissions';
import { findUser, type User } from '../foundation/shared/users';

export interface SignOffRequest extends Approvable {
  kind: RequestKind;
  title: string;
  customerName: string;
  /** Stored in full on the server only. */
  customerSsn: string;
  amount: number | null;
  reason: string;
  summary: string;
}

const HOUR = 3_600_000;

function parseNew(body: unknown): NewSignOffRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const text = (k: string, label: string, max = 500) => {
    const v = typeof b[k] === 'string' ? (b[k] as string).trim() : '';
    if (!v) throw invalid(`${label} is required.`);
    if (v.length > max) throw invalid(`${label} must be ${max} characters or fewer.`);
    return v;
  };
  // SSNs belong only in the masked SSN field, never in free text.
  const freeText = (k: string, label: string, max?: number) => scrubSsns(text(k, label, max));
  const kind = b.kind as RequestKind;
  if (!REQUEST_KINDS.includes(kind)) throw invalid(`Type must be one of: ${REQUEST_KINDS.join(', ')}.`);
  const ssn = text('customerSsn', 'Customer SSN', 20);
  if (!/^\d{3}-?\d{2}-?\d{4}$/.test(ssn)) throw invalid('Customer SSN must look like 123-45-6789.');
  let amount: number | null = null;
  if (b.amount !== null && b.amount !== undefined && b.amount !== '') {
    amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw invalid('Amount must be a positive number.');
    amount = Math.round(amount * 100) / 100;
    if (amount <= 0) throw invalid('Amount must be at least $0.01.');
  }
  return {
    kind,
    title: freeText('title', 'Title', 120),
    customerName: freeText('customerName', 'Customer name', 120),
    customerSsn: ssn.replace(/^(\d{3})-?(\d{2})-?(\d{4})$/, '$1-$2-$3'),
    amount,
    reason: freeText('reason', 'Reason', 200),
    summary: typeof b.summary === 'string' ? scrubSsns(b.summary.trim().slice(0, 1000)) : '',
  };
}

function seed(foundation: Foundation, requests: ReturnType<typeof createCollection>) {
  const now = foundation.now().getTime();
  type Event = { at: number; run: () => void };
  const events: Event[] = [];
  for (const s of SEED_REQUESTS) {
    const requester = findUser(s.requestedBy)!;
    const openedAt = new Date(now - s.openedHoursAgo * HOUR);
    events.push({
      at: openedAt.getTime(),
      run: () =>
        foundation.change(requester, requests, {
          action: 'created',
          summary: 'Opened request',
          at: openedAt,
          apply: () => ({
            id: s.id,
            kind: s.kind,
            title: s.title,
            customerName: s.customerName,
            customerSsn: s.customerSsn,
            amount: s.amount,
            reason: s.reason,
            summary: s.summary,
            status: 'pending' as const,
            requestedBy: s.requestedBy,
            requestedAt: openedAt.toISOString(),
          }),
        }),
    });
    const o = s.outcome;
    if (o) {
      const at = new Date(now - o.hoursAgo * HOUR);
      const actor = findUser(o.by)!;
      events.push({
        at: at.getTime(),
        run: () =>
          o.status === 'withdrawn'
            ? withdraw(foundation, actor, requests, s.id, at)
            : decide(foundation, actor, requests, s.id, { decision: o.status, note: o.note, at }),
      });
    }
  }
  events.sort((a, b) => a.at - b.at).forEach((e) => e.run());
}

function createCollection(foundation: Foundation) {
  return foundation.collection<SignOffRequest>({
    app: 'approvals',
    recordType: 'Request',
    label: (r) => `${r.id} · ${r.title}`,
    // The change log never keeps a usable SSN.
    redact: ({ customerSsn, ...rest }) => ({ ...rest, customerSsn: maskSsn(customerSsn, 'full') }),
  });
}

export const approvalsApp: ServerAppFactory = (foundation) => {
  const requests = createCollection(foundation);
  seed(foundation, requests);

  const pending = () => requests.all().filter((r) => r.status === 'pending');
  const view = (r: SignOffRequest, viewer: User) => approvalOf(r, viewer);

  const router = express.Router();

  router.get('/requests', (req, res) => {
    const user = currentUser(res);
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = requests
      .all()
      .filter((r) => !status || r.status === status)
      .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1))
      .map((r) => view(r, user));
    res.json({ rows, canCreate: canChange(user) });
  });

  router.get('/requests/:id', (req, res) => {
    res.json(view(requests.require(req.params.id), currentUser(res)));
  });

  router.post('/requests', (req, res) => {
    const user = currentUser(res);
    enforce(canChange(user));
    const input = parseNew(req.body);
    const nextId = `APR-${1001 + requests.all().length}`;
    const created = foundation.change(user, requests, {
      action: 'created',
      summary: 'Opened request',
      apply: () => ({ ...input, id: nextId, status: 'pending' as const, requestedBy: user.id, requestedAt: foundation.now().toISOString() }),
    });
    res.status(201).json(view(created, user));
  });

  router.post('/requests/:id/approve', (req, res) => {
    const user = currentUser(res);
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
    res.json(view(decide(foundation, user, requests, req.params.id, { decision: 'approved', note }), user));
  });

  router.post('/requests/:id/reject', (req, res) => {
    const user = currentUser(res);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!note) {
      // Check permission first so the "why not" is about who, not about the missing note.
      enforce(canDecide(user, requests.require(req.params.id), 'rejected'));
      throw invalid('Add a short note explaining the rejection.');
    }
    res.json(view(decide(foundation, user, requests, req.params.id, { decision: 'rejected', note }), user));
  });

  router.post('/requests/:id/withdraw', (req, res) => {
    const user = currentUser(res);
    res.json(view(withdraw(foundation, user, requests, req.params.id), user));
  });

  return {
    id: 'approvals',
    router,
    openLabel: 'waiting for sign-off',
    openCount: () => pending().length,
    waitingOn: (user) => pending().filter((r) => canDecide(user, r, 'approved').allowed).length,
    openedBy: (user) => pending().filter((r) => r.requestedBy === user.id).length,
    spotlight: (user) => {
      const open = pending().sort((a, b) => (a.requestedAt < b.requestedAt ? -1 : 1));
      const actionable = open.find((r) => canDecide(user, r, 'approved').allowed);
      if (actionable) return { recordId: actionable.id, reason: 'waiting_on_you' };
      const yours = open.find((r) => r.requestedBy === user.id);
      if (yours) return { recordId: yours.id, reason: 'yours' };
      return open[0] ? { recordId: open[0].id, reason: 'oldest' } : null;
    },
  };
};
