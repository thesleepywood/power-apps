# Keel attack report

An attempt to break Keel: read `docs/spec.md` and the code, attack the running demo, and disable each control one at a time to check that the tests catch it.

Baseline on `main` @ 3a6d76b: `npm run check` → typecheck clean, **120/120 tests pass**. The tree was clean before and after every mutation (sha256 + `git status --porcelain` checked after each restore). Each control was disabled by a single string swap in the source, the full Vitest suite was run, and the file was restored. No code changes were left behind.

## 1. Mutation test: disable each control and confirm tests fail

44 controls were disabled one at a time (one swap per run, the full vitest suite each time, then restored). **42 were caught and 2 survived.**

| ID | Control disabled | File | Result | # failing tests | First failing test |
|---|---|---|---|---|---|
| M01 | No self-approval (canDecide) | `foundation/server/approvals.ts` | **CAUGHT** | 16 | approvals.test.ts: no self-approval (primitive) denies the requester even when they hold the approver role |
| M02 | Role gate on deciding (canDecide) | `foundation/server/approvals.ts` | **CAUGHT** | 21 | approvals.test.ts: escalation (primitive) once waiting, only the stricter role may decide |
| M03 | Waiting records need the stricter role | `foundation/server/approvals.ts` | **CAUGHT** | 8 | approvals.test.ts: escalation (primitive) once waiting, only the stricter role may decide |
| M04 | Closed records cannot be re-decided | `foundation/server/approvals.ts` | **CAUGHT** | 14 | approvals.test.ts: no self-approval (primitive) cannot decide twice, and only the requester can withdraw |
| M05 | decide() enforces canDecide server-side | `foundation/server/approvals.ts` | **CAUGHT** | 24 | approvals.test.ts: no self-approval (primitive) decide() enforces it, so callers cannot skip the check |
| M06 | escalate() enforces canEscalate server-side | `foundation/server/approvals.ts` | **CAUGHT** | 3 | approvals.test.ts: escalation (primitive) blocks self-approval at every step |
| M07 | Only pending records can be escalated | `foundation/server/approvals.ts` | **CAUGHT** | 1 | approvals.test.ts: escalation (primitive) cannot escalate twice, decide a closed record, or escalate as an Observer |
| M08 | Approvers decide directly (no escalate-to-self) | `foundation/server/approvals.ts` | **CAUGHT** | 2 | approvals.test.ts: no stuck records Approvers give the final sign-off directly instead of escalating |
| M09 | Only requester may withdraw | `foundation/server/approvals.ts` | **CAUGHT** | 2 | approvals.test.ts: no self-approval (primitive) cannot decide twice, and only the requester can withdraw |
| M10 | Approval notes are SSN-scrubbed | `foundation/server/approvals.ts` | **CAUGHT** | 3 | kyc.test.ts: SSNs never leave the server unmasked no raw SSN in any KYC response, the change log or home, for any role, before and after changes |
| M11 | Role check: Observers are read-only | `foundation/server/permissions.ts` | **CAUGHT** | 15 | approvals.test.ts: escalation (primitive) cannot escalate twice, decide a closed record, or escalate as an Observer |
| M12 | enforce() throws on denial | `foundation/server/permissions.ts` | **CAUGHT** | 35 | approvals.test.ts: no self-approval (primitive) decide() enforces it, so callers cannot skip the check |
| M13 | Unknown/missing person is rejected (401) | `foundation/server/http.ts` | **CAUGHT** | 1 | permissions.test.ts: server-side enforcement over HTTP rejects requests with no person or an unknown person |
| M14 | Every change writes a log entry | `foundation/server/foundation.ts` | **CAUGHT** | 32 | approvals.test.ts: no self-approval (primitive) decide() enforces it, so callers cannot skip the check |
| M15 | Exactly one log entry per change | `foundation/server/foundation.ts` | **CAUGHT** | 29 | approvals.test.ts: no self-approval (primitive) decide() enforces it, so callers cannot skip the check |
| M16 | Refused changes write nothing | `foundation/server/foundation.ts` | **CAUGHT** | 31 | approvals.test.ts: no self-approval (primitive) decide() enforces it, so callers cannot skip the check |
| M17 | Change log redacts via spec.redact | `foundation/server/foundation.ts` | **CAUGHT** | 4 | kyc.test.ts: SSNs never leave the server unmasked no raw SSN in any KYC response, the change log or home, for any role, before and after changes |
| M18 | Records are copies (no out-of-band writes) | `foundation/server/foundation.ts` | **CAUGHT** | 1 | changeLog.test.ts: Foundation.change records are read-only copies outside of change() |
| M19 | Change-log entries are immutable | `foundation/server/changeLog.ts` | **CAUGHT** | 1 | changeLog.test.ts: Foundation.change keeps entries immutable |
| M20 | maskSsn shows only last 4 | `foundation/server/masking.ts` | **CAUGHT** | 4 | kyc.test.ts: SSNs never leave the server unmasked shows the last 4 to Operators and Approvers, nothing to Observers, and stores only the fully masked value in the log |
| M21 | Observers see fully masked SSN | `foundation/server/masking.ts` | **CAUGHT** | 3 | kyc.test.ts: SSNs never leave the server unmasked shows the last 4 to Operators and Approvers, nothing to Observers, and stores only the fully masked value in the log |
| M22 | SSN scrubbing catches undashed numbers | `foundation/server/masking.ts` | **CAUGHT** | 4 | kyc.test.ts: SSNs never leave the server unmasked no raw SSN in any KYC response, the change log or home, for any role, before and after changes |
| M23 | KYC API masks SSN | `kyc/view.ts` | **CAUGHT** | 5 | kyc.test.ts: SSNs never leave the server unmasked no raw SSN in any KYC response, the change log or home, for any role, before and after changes |
| M24 | KYC change log keeps only fully masked SSN | `kyc/server.ts` | **CAUGHT** | 2 | kyc.test.ts: SSNs never leave the server unmasked shows the last 4 to Operators and Approvers, nothing to Observers, and stores only the fully masked value in the log |
| M25 | High-risk KYC approve escalates | `kyc/view.ts` | **CAUGHT** | 3 | kyc.test.ts: high-risk escalation approving a pending high-risk case sends it to waiting for approver; only an Approver can then approve |
| M26 | KYC waiting cases: Approvers only | `kyc/view.ts` | **CAUGHT** | 88 | changeLog.test.ts: one change-log entry per change, over HTTP seed history is in the log: one entry per opened record, escalation and decision |
| M27 | KYC rejection needs a note | `kyc/server.ts` | **CAUGHT** | 4 | changeLog.test.ts: one change-log entry per change, over HTTP refused change (reject without note) adds no entry |
| M28 | KYC GET actions match server rules | `kyc/view.ts` | **CAUGHT** | 3 | kyc.test.ts: high-risk escalation approving a pending high-risk case sends it to waiting for approver; only an Approver can then approve |
| M29 | Refunds over $1,000 need an Approver (boundary) | `refunds/view.ts` | **CAUGHT** | 6 | refunds.test.ts: Refunds seed data is consistent with the rules: $1,000 or less is auto-approved, only larger refunds have an Approver decision |
| M30 | Refund limit is $1,000 | `refunds/view.ts` | **CAUGHT** | 89 | changeLog.test.ts: one change-log entry per change, over HTTP seed history is in the log: one entry per opened record, escalation and decision |
| M31 | Refund sign-off: Approvers only | `refunds/view.ts` | **CAUGHT** | 6 | refunds.test.ts: requesting a refund over $1,000 stays pending; an Operator cannot approve it, an Approver can |
| M32 | Observers cannot request refunds (view) | `refunds/view.ts` | **CAUGHT** | 2 | refunds.test.ts: requesting a refund Observers cannot request refunds, and the list says so |
| M33 | Refund request enforced server-side | `refunds/server.ts` | **CAUGHT** | 2 | refunds.test.ts: requesting a refund Observers cannot request refunds, and the list says so |
| M34 | Over-limit refunds stay pending | `refunds/server.ts` | **CAUGHT** | 88 | changeLog.test.ts: one change-log entry per change, over HTTP seed history is in the log: one entry per opened record, escalation and decision |
| M35 | Auto-approval has no human decider | `refunds/server.ts` | **CAUGHT** | 3 | refunds.test.ts: Refunds seed data is consistent with the rules: $1,000 or less is auto-approved, only larger refunds have an Approver decision |
| M36 | Refund amount must be > 0 | `refunds/server.ts` | **CAUGHT** | 2 | refunds.test.ts: requesting a refund rejects invalid input (zero amount) with 400 and no log entry |
| M37 | Refund reject: permission before note | `refunds/server.ts` | **CAUGHT** | 1 | refunds.test.ts: rejecting needs a note, but checks who may reject first |
| M38 | Refund rejection needs a note | `refunds/server.ts` | **CAUGHT** | 2 | refunds.test.ts: rejecting needs a note, but checks who may reject first |
| M39 | Refund free text is SSN-scrubbed | `refunds/server.ts` | **CAUGHT** | 1 | refunds.test.ts: requesting a refund masks SSN-shaped numbers typed into free text, in the response and the change log |
| M40 | Refund change-log redact scrubs SSNs (defense in depth) | `refunds/server.ts` | **SURVIVED** | 0 | — |
| M41 | UI: PermissionButton disabled when denied | `foundation/client/ui/PermissionButton.tsx` | **CAUGHT** | 1 | ui.test.tsx: UI explains why an action is not allowed PermissionButton shows the server reason when denied |
| M42 | UI: PermissionButton shows the reason | `foundation/client/ui/PermissionButton.tsx` | **CAUGHT** | 1 | ui.test.tsx: UI explains why an action is not allowed PermissionButton shows the server reason when denied |
| M43 | UI: ActionBar disables denied actions | `foundation/client/ui/ActionBar.tsx` | **CAUGHT** | 1 | ui.test.tsx: UI explains why an action is not allowed ActionBar locks denied actions and lists each reason once |
| M44 | UI: no stale data after persona switch | `foundation/client/session.tsx` | **SURVIVED** | 0 | — |

### Survivors
- **M44 (UI: stale data after a persona switch)**, a real test gap. `useApi` returns `state.data` only when `state.userId === userId`. If you remove that guard, `tests/session.test.tsx` still passes, because `act()` flushes the reset effect before the assertion runs. A temporary probe test that recorded every render (since deleted) showed the gap:
  - original: `["u-maya:-","u-maya:-","u-maya:LAST4","u-grace:-","u-grace:-"]` (pass)
  - mutant: `[..., "u-grace:LAST4", "u-grace:-"]` (fail): for one render the Observer is shown Maya's last-4 SSN. The guard works, but no test protects it.
- **M40 (refunds change-log `redact` scrubs SSNs)**, an equivalent mutant. Every write path already scrubs free text (`text()` at request time, `cleanNote` on decisions), so this redact step can never be the line that matters. It's defense in depth that only a direct unit test of `spec.redact` could check.

### Caught, but only barely
- M06, M07, M13, M18, M19, M37, M39, M41, M42 and M43 each trip **exactly one** test. If that one test is edited, the control is unprotected.
- M26, M30 and M34 fail about 88 tests, mostly because the **seed throws** during `setup()` (for example, Diego's seeded escalation is refused). The failures are real, but they depend on the seed data.

## 2. Black-box attacks on the running demo (`npm run demo`, :5173)

Held up: no header or an unknown person → 401; `__proto__` as a user or record id → 401/404; header case-insensitivity is fine; an Observer approving → 403 with a reason; spoofing `status`/`decidedBy`/`risk` in a KYC approve body is ignored (the case was correctly escalated); an Operator final-approving a waiting case → 403 "Approvers only"; an Approver self-approving RF-2001 → 403; injecting `id` on refund create is ignored (a new id is assigned); the $1,000.00 / $1,000.01 boundary behaves correctly; malformed JSON → 400; a non-string note → 400.

**Findings**
1. **High: full SSNs are served by the demo's Vite dev server.** `GET http://localhost:5173/src/kyc/seed.ts` returns 200 with every raw SSN (e.g. `943-21-8870`). No sign-in is needed, and the server listens on `*:5173`, so other machines on the network can reach it. `/src/kyc/server.ts`, `/README.md` and `/@fs/<repo path>` are also served. `/@fs/etc/passwd` and `/.git/config` are blocked (403). This sidesteps "server masks sensitive data" for anyone who can reach the demo. Possible fixes: bind to `127.0.0.1`, keep server-only seed files out of the Vite root (or deny them with `server.fs.deny`), and/or serve `dist` for the demo.
2. **Medium: SSN scrubbing misses common formats.** `921.55.4401`, `921/55/4401`, `921–55–4401` (en dash), `921 - 55 - 4401` and full-width digits `９２１５５４４０１` are all stored and returned unmasked in refund reasons, and would be the same in decision notes. Only `-`, a single space, or no separator is caught.
3. **Low: no upper bound on refund amounts.** `amountCents: 1e21` and `1.7976931348623157e308` are accepted (they pass `Number.isInteger`) and create pending refunds. The spec range of $5–$2,000 applies to the seed data only, so this is a product decision, but a sanity cap and `Number.isSafeInteger` would be cheap.
4. **Low: an oversized body returns 500.** A note over 100 KB gives `500 "Something went wrong on our side"` because `errorHandler` doesn't handle `entity.too.large`. It should return 413 with a human message.

Not counted as a finding: `x-keel-user` spoofing is allowed by design (the spec excludes real sign-in).
