---
name: build-keel-app
description: Build a new app in thesleepywood/power-apps (Keel) on the shared foundation, following the KYC Review Queue (src/kyc) as the reference implementation.
---

# Build a Keel app (modelled on the KYC Review Queue)

Use this when asked to add an app (e.g. the Refunds Dashboard) to `thesleepywood/power-apps`. `src/kyc/` is the reference implementation: copy its shape, not its domain logic. Read `docs/spec.md` (the app's requirements) and `README.md` (foundation pieces) first.

## Setup and commands
- `source ~/.nvm/nvm.sh` first (Node 20 is not on PATH). If `node_modules` is missing, run `npm install` (otherwise `npx tsc` resolves to the wrong package).
- `npm run check` = `tsc --noEmit` + Vitest. It must pass before you open a PR.
- `npm run demo` serves the API and UI on http://localhost:5173 with in-memory data that resets on restart. To restart it, kill it by PID (`ps aux | grep [t]sx`). Don't use `pkill -f "tsx src/server/main.ts"`: it also kills the shell running the command.
- Deliver each app as its own PR, with screenshots and a test report. Don't start the next app in the same PR.

## Hard rules (the foundation's guarantees, so don't work around them)
1. **Every mutation goes through `foundation.change()`** (or the approvals primitives `decide()`, `escalate()` and `withdraw()`, which call it). Each successful change writes exactly 1 change-log entry; a refused change writes none. Never write to a collection any other way.
2. **The server decides permissions.** Build every check as a `Decision` with `requireRole`, `firstDenial`, `allow` and `deny` from `src/foundation/server/permissions.ts`, and `enforce()` it inside `apply` so callers can't skip it. Record responses include an `actions` object (`{ allowed, code?, reason? }` per action). The client only renders those decisions and never re-derives them.
3. **Mask sensitive data before it leaves the server.** Use `ssnForViewer(ssn, viewer)` in the view function. Make the collection's `redact` fully mask the SSN (`maskSsn(ssn, 'full')`) so the change log never holds a usable value. Free-text notes are scrubbed by the approvals primitives (`scrubSsns`); scrub any other free text yourself.
4. **No self-approval at any step.** `canDecide` blocks the requester. Don't add rules that could leave a record with nobody able to decide it. Only users outside `escalatedRoles` may escalate (`mustEscalate`), and an approval by someone in `escalatedRoles` is final.
5. **Only foundation UI pieces** from `src/foundation/client/ui`: `DataTable`, `StatusBadge`, `Badge`, `RecordPage`, `FieldList`, `ActionBar`, `ConfirmDialog`, `ChangeHistory`, `EmptyState`, `ErrorState`, `LoadingState`, `PageHeader`, `Tabs` and `Card`. No new design system.
6. **Don't edit `permissions.ts`, `masking.ts`, `changeLog.ts`, `foundation.ts` or `AppShell.tsx`** unless the user asks. Keep changes to the foundation generic (as with `escalatedRoles`), and confirm the change is needed before making it. Run the **foundation diff check** below before every PR.
7. In-memory and fictional only: no database, no real sign-in, no external services. Seed SSNs use the never-issued 9xx range.

## Files to create (mirror `src/kyc/`)
| File | Purpose (KYC example) |
| --- | --- |
| `src/<app>/types.ts` | Status/enum types and the client-facing `<Record>View`: masked fields, `Person` objects instead of user ids, `actions: { approve: Decision; reject: Decision; ... }`, and flags like `approveEscalates` |
| `src/<app>/seed.ts` | `SEED_*` array of fictional records. Optional `escalated` and `outcome` describe history, so the demo starts with every status represented |
| `src/<app>/server.ts` | `interface <Record> extends Approvable`, `createCollection(foundation)` with `app`, `recordType`, `label` and `redact`, `seed()` (replays history in time order through `foundation.change`, `escalate` and `decide` with `at:`), routes, and the exported `ServerAppFactory` |
| `src/<app>/view.ts` | The app's `ApprovalOptions` (e.g. `KYC_APPROVAL`), permission helpers (`canApproveCase`), and `<record>Of(record, viewer)`, which masks fields and attaches `actions`. Every response goes through it |
| `src/<app>/client/<App>QueuePage.tsx` | `PageHeader`, then status `Tabs` (with counts), then a `DataTable` with `onRowClick` to the record route. Loading, error and empty states come from the foundation. Also export a `<App>Route` that reads `:id` |
| `src/<app>/client/<Record>Record.tsx` | Takes `{ id, compact? }` (Home reuses it with `compact`). Uses `RecordPage` with `ActionBar` actions straight from `c.actions`, a `notice` (decided, waiting, "you opened this" or escalation hint), `FieldList`, `ChangeHistory app="<app>"` in `aside`, and a `ConfirmDialog` per action (rejection needs a note). Calls `api(...)`, then `invalidate()` and `toast()` |

## Wiring (4 places)
1. `src/registry.ts`: add `{ id, name, route: '/<app>', icon, description }` to `APPS`. If no icon fits, add one to `APP_ICONS` in `src/foundation/client/icons.ts` (e.g. `wallet` already exists for Refunds).
2. `src/server/apps.ts`: add the factory to `SERVER_APPS`. It's mounted at `/api/apps/<id>`.
3. `src/client/App.tsx`: add `<Route path="<app>" …/>` and `<Route path="<app>/:id" …/>`.
4. `src/client/recordViews.ts`: add `<app>: <Record>Record`, so Home's spotlight and Full record can render it.

`ServerApp` also feeds Home. Implement `openCount` and `openLabel`, plus `waitingOn(user)` (records this person can act on now; use the same helper as `actions.approve`), `openedBy(user)` and `spotlight(user)` (actionable first, then theirs, then the oldest).

## Server route pattern (from `src/kyc/server.ts`)
```ts
router.get('/cases', (req, res) => res.json({ rows: cases.all().sort(newestFirst).map((c) => kycCaseOf(c, currentUser(res))) }));
router.get('/cases/:id', (req, res) => res.json(kycCaseOf(cases.require(req.params.id), currentUser(res))));
router.post('/cases/:id/approve', (req, res) => {
  const user = currentUser(res); const current = cases.require(req.params.id);
  const updated = approveEscalates(current, user)          // needs sign-off && mustEscalate(user, OPTS)
    ? escalate(foundation, user, cases, current.id, { note }, OPTS)
    : decide(foundation, user, cases, current.id, { decision: 'approved', note }, OPTS);
  res.json(kycCaseOf(updated, user));
});
router.post('/cases/:id/reject', ...) // enforce(canDecide(...)) BEFORE checking that a note is present, so the "why not" is about who can act
```
Errors: `invalid(msg)` (400), `notFound` via `collection.require` (404), and `enforce` (403 with `{ error: { code, message } }`).

## Approvals primitive cheat sheet (`src/foundation/server/approvals.ts`)
- Statuses: `pending | waiting | approved | rejected | withdrawn`. `StatusBadge` already labels them; `waiting` shows as "Waiting for approver".
- `ApprovalOptions = { approverRoles?, escalatedRoles? }`. Both default to `['approver']`. `approverRoles` decides pending records; `escalatedRoles` decides waiting ones.
- `canDecide`, `canEscalate`, `canWithdraw` and `mustEscalate` return `Decision`s for `actions`. `decide`, `escalate` and `withdraw` perform the change (enforced, 1 log entry).

## Tests (in `tests/`, using `setup()` and `as(userId)` from `tests/helpers.ts`)
Add the seed SSNs to `ALL_SEED_SSNS` and named record-id constants to `helpers.ts`. Users: `OPERATOR` (u-maya), `OPERATOR_2` (u-diego), `APPROVER` (u-priya), `APPROVER_2` (u-samuel), `OBSERVER` (u-grace). Cover at least the following (see `tests/kyc.test.ts`):
- Seed shape: the required count and fields, and every status represented.
- Each allowed transition: the response status and fields, plus `foundation.changeLog.size` goes up by exactly 1.
- Each refused transition (wrong role, Observer, self-approval, closed record, missing note, unknown id): a 4xx with the exact `{ code, message }`, and the log size is unchanged.
- The `actions` on GET match what POST does, for every role.
- No stuck records: for every open seed record × every user allowed to act, someone can still finish the record afterwards.
- No raw SSN (with or without dashes) in any list, detail, `/changes`, `/home` or `/apps` response, for any role, before and after changes, including SSNs typed into notes. Change-log snapshots hold only `•••-••-••••`.
- Home: `waitingOnYou` matches the count of rows with `actions.approve.allowed`, and the spotlight points at the app.
If the global change log now holds more seed history, update existing tests that count it (filter with `?app=`).

## Foundation diff check (run before every PR)
An app PR should touch `src/foundation/` as little as possible. From the repo root, run this to see exactly what changed relative to `main`, including uncommitted and untracked files:
```bash
git fetch -q origin
BASE=$(git merge-base origin/main HEAD)
PROTECTED='src/foundation/server/(permissions|masking|changeLog|foundation)\.ts|src/foundation/client/AppShell\.tsx'
echo "== Foundation changes vs main =="; git diff --stat "$BASE" -- src/foundation; git status --short --untracked-files=all -- src/foundation
{ git diff --name-only "$BASE" -- src/foundation; git ls-files --others --exclude-standard -- src/foundation; } \
  | grep -E "^($PROTECTED)$" && echo "STOP: protected foundation file changed" || echo "OK: no protected foundation files changed"
{ git diff "$BASE" -- src/foundation | grep -E '^\+[^+]'; git ls-files --others --exclude-standard -z -- src/foundation | xargs -0 -r cat; } \
  | grep -inwE '<app-id>|kyc|refunds?' && echo "STOP: app-specific names in foundation code" || echo "OK: no app-specific names added"
```
Replace `<app-id>` with the new app's id and add any domain words (e.g. `refund`, `amount`).

Rules for reading the result:
- **Any `STOP` line:** revert the change, or get the user's explicit OK before keeping it. Protected files need the user's sign-off. App-specific names mean the logic belongs in `src/<app>/`, not the foundation.
- **Every other changed foundation file** has to meet all of these:
  1. **Necessary:** the app can't be built with the existing pieces.
  2. **Generic:** new behaviour is an opt-in option with a default that keeps old behaviour (like `escalatedRoles`). No app ids or domain fields.
  3. **Backwards compatible:** existing apps and tests pass unchanged. If you had to edit an existing test, say why in the PR.
  4. **Tested on its own:** the primitive has a unit test in `tests/` (e.g. `tests/approvals.test.ts`), not just coverage through the app.
  5. **Documented:** a **Foundation** section in the PR body lists each changed file with a one-line pseudo-diff and the reason. Update the README's foundation table if the API changed.
- Small UI fixes (copy, CSS) are fine, but still list them in the PR body.
- Paste the `--stat` output and the two `OK` lines into the test report.

## Before opening the PR
1. Run `npm run check` and `npm run build`, then the **foundation diff check** above.
2. Run `npm run demo` and screenshot the main flow for each role (queue, record, confirm dialog, denied action with its reason, Observer view, Home). Playwright over CDP at `http://localhost:29229` works; set `localStorage['keel.userId']` to switch person.
3. Update `README.md`: the app list, the "What you can do" walkthrough, API endpoints and the tests list.
4. The PR body follows the repo template. Include screenshots, a test report mapping each requirement to its tests, and any decision the spec left open (state your default).
