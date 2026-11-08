# Keel — internal tools foundation

A small, owned TypeScript codebase to replace low-code internal tools (e.g. Power Apps) for a fintech ops team. This PR is the **Foundation + Home page**. The KYC Review Queue and Refunds Dashboard come later as their own apps on top of the same foundation (see `docs/spec.md`).

Everything is in memory: no real sign-in, no database, no external services. Restart the server and all data goes back to the seed state.

## Run it

Requires Node 20.11+.

```bash
npm install
npm run demo    # http://localhost:5173 (API + UI on one port)
npm run check   # typecheck + all tests
```

Set `PORT` to use a different port. `npm run build` makes a production bundle in `dist/`; `NODE_ENV=production npm run demo` serves it.

## What you can do

1. **Sign in** — choose a person. No password. There are 2 Operators, 2 Approvers and 1 Observer:
   | Person | Role |
   | --- | --- |
   | Maya Chen, Diego Alvarez | Operator: does the daily work, opens requests |
   | Priya Natarajan, Samuel Okafor | Approver: signs off on requests |
   | Grace Liu | Observer: read-only |
   Use the person picker at the bottom of the sidebar to switch at any time.
2. **Home** — greets you by first name and lists what your role can and can't do. Shows app cards with live open counts, the record that most needs you (with its masked SSN, change history and gated Approve/Reject actions), and the **Full record**: every change across all apps, newest first. Click a row to open that record.
3. **Approvals** — the sample app that uses the foundation: open a sign-off request, then approve, reject or withdraw it. Denied actions stay visible with the server's reason, e.g. *Approvers only*, *Observers have read-only access*, *You can't approve your own request*.

## Foundation pieces

| Piece | Where |
| --- | --- |
| Roles and demo users | `src/foundation/shared/roles.ts`, `users.ts` |
| Server-side permissions with "why not" reasons | `src/foundation/server/permissions.ts` |
| Sensitive-field masking (`maskSsn`, `ssnForViewer`) | `src/foundation/server/masking.ts` |
| Approvals primitive (no self-approval) | `src/foundation/server/approvals.ts` |
| Change log (one entry per change, before/after, append-only) | `src/foundation/server/changeLog.ts`, `foundation.ts` |
| App registry (drives the sidebar and Home cards) | `src/registry.ts` |
| Design system and app shell | `src/foundation/client/theme.css`, `src/foundation/client/ui/`, `AppShell.tsx` |

How it fits together:

- The client sends the chosen person in an `x-keel-user` header. That is the only "auth" (demo only).
- Every change goes through `Foundation.change()`. It applies the change and writes exactly one change-log entry. If the change is refused or throws, nothing is stored and nothing is logged.
- The server checks permissions on every request and returns `{ error: { code, message } }` when it says no. Record responses also include an `actions` object (`{ allowed, reason }` for each action), so the UI only displays the server's decision and never makes its own.
- SSNs are masked before any response leaves the server: Operators and Approvers see the last 4 digits, Observers see none. Change-log snapshots store only the fully masked value.

## API

| Method | Path | |
| --- | --- | --- |
| GET | `/api/users` | Demo people (public) |
| GET | `/api/session` | Current person and role |
| GET | `/api/apps` | Registry apps with open counts |
| GET | `/api/home` | Home summary and spotlight record |
| GET | `/api/changes?app=&recordId=` | Change log, newest first |
| GET/POST | `/api/apps/approvals/requests` | List / open a request |
| GET | `/api/apps/approvals/requests/:id` | One request (masked) |
| POST | `/api/apps/approvals/requests/:id/{approve,reject,withdraw}` | Decide / withdraw |

## Adding an app

1. Add an entry to `APPS` in `src/registry.ts` (id, name, route, icon, description).
2. Write a server module that implements `ServerApp` (`src/foundation/server/apps.ts`) and add it in `src/server/apps.ts`.
3. Add its routes in `src/client/App.tsx` and its record view in `src/client/recordViews.ts`.

## Tests

`npm run check` runs `tsc --noEmit` and then Vitest:

- `tests/permissions.test.ts`: server-side role checks and the reasons returned
- `tests/masking.test.ts`: masking helpers; checks that no raw SSN appears in any API response or the change log
- `tests/changeLog.test.ts`: exactly one entry per change, none for refused changes, entries can't be modified, newest first
- `tests/approvals.test.ts`: no self-approval or self-rejection (in the primitive and over HTTP), withdraw rules
- `tests/ui.test.tsx`: denied actions show their reason, status badges
