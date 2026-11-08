# Keel — internal tools foundation

## What it does

Keel is a small, owned TypeScript codebase that replaces low-code internal tools (e.g. Power Apps) for a fintech ops team. It is one web app with:

- **Foundation**: demo sign-in with three roles (Operator, Approver, Observer), server-side permissions that explain every "no", SSN masking, an approvals primitive that blocks self-approval, an append-only change log, and a shared design system and app shell.
- **Home page**: what your role can do, live counts per app, the record that most needs you, and the full change log across all apps.
- **KYC Review Queue**: identity-check cases; high-risk cases need an Approver's sign-off.
- **Refunds Dashboard**: refund requests from $5 to $2,000; up to $1,000 is approved automatically, anything above waits for an Approver.

Everything is in memory: no real sign-in, no database, no external services. Restart the server and all data goes back to the seed state. The full spec is in [`docs/spec.md`](docs/spec.md).

## How to run it

Requires Node 20.11+ and npm.

```bash
npm install       # or `npm ci` to install exactly what package-lock.json pins
npm run demo      # starts API + UI on one port: http://localhost:5173
```

Open http://localhost:5173, pick a person on the sign-in screen, and follow the "Try it" steps below. Stop the server with Ctrl+C; starting it again resets all data.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run check` | `tsc --noEmit`, then all Vitest tests (see [Tests](#tests)) |
| `npm run typecheck` | Type check only |
| `npm test` | Tests only |
| `npm run build` | Production bundle in `dist/` |
| `NODE_ENV=production npm run demo` | Serve the `dist/` bundle instead of the Vite dev server |
| `PORT=8080 npm run demo` | Use a different port |

## What you can do

1. **Sign in** — choose a person. No password. There are 2 Operators, 2 Approvers and 1 Observer:
   | Person | Role |
   | --- | --- |
   | Maya Chen, Diego Alvarez | Operator: does the daily work |
   | Priya Natarajan, Samuel Okafor | Approver: signs off on anything that needs it |
   | Grace Liu | Observer: read-only |
   Use the person picker at the bottom of the sidebar to switch at any time.
2. **Home** — greets you by first name and lists what your role can and can't do. Shows app cards with live open counts, the record that most needs you (with its masked SSN, change history and gated Approve/Reject actions), and the **Full record**: every change across all apps, newest first. Click a row to open that record.
3. **KYC Review Queue** — 10 fictional identity-check cases (2 high-risk). The queue shows name, masked SSN, risk, status and opened date; a case page shows the review reason, summary, change history and Approve/Reject.
   - Low-risk: an Operator or Approver approves or rejects it.
   - High-risk: an Operator approving it sends it to **Waiting for approver**; from there only an Approver can approve or reject it. An Approver's approval is the final sign-off, so a case can never be left waiting with nobody able to finish it. While it's still pending, an Operator or Approver can reject it.
   - Nobody can decide a case they opened.
   - Try it: as Maya (Operator), approve KYC-1001 → it waits for an Approver. Switch to Priya and approve it. KYC-1005 is already waiting; Priya opened it, so Samuel has to decide it.
4. **Refunds Dashboard** — 10 fictional refund requests ($5–$2,000). The queue has Pending / Approved / Rejected / All tabs with counts; a refund page shows the amount, customer, reason, summary, who requested and decided it, change history and Approve/Reject.
   - Operators and Approvers can request a refund. Observers can't.
   - $1,000.00 or less is approved automatically when it's requested (one change-log entry, no person as decider).
   - Over $1,000.00 stays **Pending** until an Approver approves or rejects it. Operators can't decide refunds. Rejecting needs a note.
   - Nobody can approve or reject a refund they requested — including an Approver.
   - Try it: as Maya (Operator), open RF-2003 → Approve and Reject are locked with "Approvers only". Request a $250 refund → approved right away. Switch to Priya: RF-2001 is hers, so it's locked ("You can't approve your own request"); approve RF-2003 instead. Switch to Samuel to decide RF-2001.

## Foundation pieces

| Piece | Where |
| --- | --- |
| Roles and demo users | `src/foundation/shared/roles.ts`, `users.ts` |
| Server-side permissions with "why not" reasons | `src/foundation/server/permissions.ts` |
| Sensitive-field masking (`maskSsn`, `ssnForViewer`) | `src/foundation/server/masking.ts` |
| Approvals primitive (no self-approval; `escalate()` to *Waiting for approver* for people who can't sign off themselves, see `mustEscalate`) | `src/foundation/server/approvals.ts` |
| Change log (one entry per change, before/after, append-only) | `src/foundation/server/changeLog.ts`, `foundation.ts` |
| App registry (drives the sidebar and Home cards) | `src/registry.ts` |
| Design system and app shell | `src/foundation/client/theme.css`, `src/foundation/client/ui/`, `AppShell.tsx` |

How it fits together:

- The client sends the chosen person in an `x-keel-user` header. That is the only "auth" (demo only).
- Every change goes through `Foundation.change()`. It applies the change and writes exactly one change-log entry. If the change is refused or throws, nothing is stored and nothing is logged.
- The server checks permissions on every request and returns `{ error: { code, message } }` when it says no. Record responses also include an `actions` object (`{ allowed, reason }` for each action), so the UI only displays the server's decision and never makes its own.
- SSNs are masked before any response leaves the server: Operators and Approvers see the last 4 digits, Observers see none. Change-log snapshots store only the fully masked value, and SSN-shaped numbers typed into notes are masked before they are saved.

## API

| Method | Path | |
| --- | --- | --- |
| GET | `/api/users` | Demo people (public) |
| GET | `/api/session` | Current person and role |
| GET | `/api/apps` | Registry apps with open counts |
| GET | `/api/home` | Home summary and spotlight record |
| GET | `/api/changes?app=&recordId=` | Change log, newest first |
| GET | `/api/apps/kyc/cases` | KYC queue (masked) |
| GET | `/api/apps/kyc/cases/:id` | One case (masked), with `actions` |
| POST | `/api/apps/kyc/cases/:id/{approve,reject}` | Approve (an Operator's approval sends high-risk to an Approver) / reject (note required) |
| GET | `/api/apps/refunds/refunds?status=` | Refunds, newest first, with per-row `actions` and the list's `request` action |
| GET | `/api/apps/refunds/refunds/:id` | One refund, with `actions` |
| POST | `/api/apps/refunds/refunds` | Request a refund (`customer`, `amountCents` > 0, `reason`, optional `summary`); ≤ 100000 cents is approved immediately |
| POST | `/api/apps/refunds/refunds/:id/{approve,reject}` | Approver only, not the requester; reject needs a `note` |

## Adding an app

1. Add an entry to `APPS` in `src/registry.ts` (id, name, route, icon, description).
2. Write a server module that implements `ServerApp` (`src/foundation/server/apps.ts`) and add it in `src/server/apps.ts`.
3. Add its routes in `src/client/App.tsx` and its record view in `src/client/recordViews.ts`.

## Known issues

Found in an attack pass. See [`docs/reports/attack.md`](docs/reports/attack.md) for details and repro steps.

- **The demo's Vite dev server serves source files, including full seed SSNs.** `GET /src/kyc/seed.ts` returns every raw SSN without sign-in, and the server listens on all network interfaces (`*:5173`). Possible fixes: bind to `127.0.0.1`, keep server-only files out of the Vite root, or serve `dist` for the demo.
- **SSN scrubbing in free text misses some formats.** `921.55.4401`, `921/55/4401`, en-dash separators, `921 - 55 - 4401` and full-width digits are stored and returned unmasked.
- **Refund amounts have no upper bound.** `amountCents` such as `1e21` is accepted.
- **Oversized request bodies (>100 KB) return 500** instead of 413 with a readable message.
- **Two controls no test protects:**
  - The persona-switch guard in `useApi` (`src/foundation/client/session.tsx`). If you remove it, `tests/session.test.tsx` still passes, but for one render the new person is shown the previous person's data.
  - The SSN scrubbing in the refunds change-log `redact`. Removing it changes nothing today, because refund text is already scrubbed when it comes in.

## Tests

`npm run check` runs `tsc --noEmit` and then Vitest:

- `tests/permissions.test.ts`: server-side role checks and the reasons returned
- `tests/masking.test.ts`: masking helpers; checks that no raw SSN appears in any API response or the change log, even when one is typed into free text
- `tests/changeLog.test.ts`: exactly one entry per change, none for refused changes, entries can't be modified, newest first
- `tests/approvals.test.ts`: the approvals primitive: no self-approval or self-rejection, withdraw rules, escalation, and an exhaustive check that no waiting record is left without an eligible decider
- `tests/kyc.test.ts`: high-risk escalation, Approver-only decisions once waiting, Operators decide low-risk, no case gets stuck, no self-approval at any step, no raw SSN in any response or the change log, one log entry per change
- `tests/refunds.test.ts`: seed shape, auto-approval at $1,000 or less, Approver-only decisions above it, no self-approval (including Approvers), reject needs a note, exact refusal reasons with no log entry, one log entry per change, GET `actions` match POST for every role, no stuck refunds, Home counts and spotlight
- `tests/ui.test.tsx`: denied actions show their reason, status badges
- `tests/session.test.tsx`: after switching person, the previous person's data is never shown
