# Admin Redemptions page reorg (post automatic-redemption)

**Date:** 2026-08-04
**Status:** Approved (design)

## Problem

Barcode redemption is now fully automatic (`redeemReward` cloud function:
reserve points → validate + dispense via the POS API → finalize or refund). But
the admin **Redemptions** page (`src/pages/admin/Redemptions.jsx`, titled
"Redemption Requests") is still shaped like the retired manual-approval
workflow. Its 5 status tabs and their actions no longer match reality:

| Tab (today) | What it means now | Verdict |
|---|---|---|
| **Pending** | Transient — a fresh doc the customer's app hands to the function within milliseconds. Only appears if the app died mid-call. Points **not** yet deducted. | Anomaly, not a queue |
| **Approved** | Auto-fulfilled: points deducted, item dispensed, customer already told "grab your item". | This *is* "Completed" |
| **Collected** | "Mark collected" / "Undo" — a manual physical-handover step. | **Dead** — unmanned self-checkout, no handover |
| **Rejected** | Terminal (auto or admin). | Keep |
| **Stuck** (`reserving`) | Points held, POS call unresolved → admin refunds. | The real exception |

The admin's job has shifted from **approving a queue** to **auditing a log +
handling exceptions**. This reorg makes the page reflect that.

## Goals

- Reframe the page around two real needs: **things needing action** and **a
  browsable audit log** (user weighted these equally).
- Remove the dead "collection" workflow.
- Give admins a way to **re-drive a stuck redemption** (Retry), not only refund
  it.
- Fix now-stale redemption copy on the admin Dashboard.

## Non-goals (YAGNI)

- No date-range reporting, per-reward totals, charts, or CSV export. Scale is
  <100 customers / <500 bills; a searchable, filterable list is enough.
- No change to the customer redemption flow or its self-retry ("Almost there")
  behavior.
- No migration of legacy `collected` docs — they remain valid history, shown as
  "Completed".

## Status model (after this change)

Live flow: `pending → reserving → approved` (or `rejected` at any point).
- `collected` is **frozen** — never written again, displayed as "Completed".
- **Needs attention** = every `pending` **or** `reserving` doc. Because a
  healthy `pending` clears in milliseconds, any `pending` that is actually
  visible to an admin is already anomalous — no arbitrary age threshold needed.
- Severity differs and the UI must show it: `reserving` = points **held**
  (money at risk, refundable); `pending` = **dangling** request, no points
  moved (low stakes).

## Design

### 1. Page shell & naming
- Title "Redemption Requests" → **"Redemptions"**.
- Replace 5 status tabs with **2 tabs**: **⚠️ Needs attention** (live badge =
  count of `pending` + `reserving`) and **📜 History**.
- `Layout.jsx` nav label already reads "Redemptions" — no change.

### 2. ⚠️ Needs attention tab
- Lists `reserving` + `pending`, newest first.
- Row: reward emoji/name, customer name/email, points cost, barcode + `maxValue`,
  age (`requestedAt`), and any `failureCode`/`failureMessage`. A clear severity
  marker: **Stuck — points held** vs **Pending — no points moved**.
- Actions:
  - **Refund** — existing `refund()`; shown for `reserving` with
    `reservedPoints > 0`. Credits `reservedPoints` back, marks `rejected` /
    `REFUNDED`.
  - **Reject** — existing `confirmReject()` modal (optional reason).
  - **Retry** — new; re-invokes the redemption server-side (see §6). Shown for
    `reserving` (retry-safe) and `pending`.

### 3. 📜 History tab
- All redemptions, newest first.
- Status filter chips: **All / Completed / Rejected / Stuck**. "Completed"
  matches `approved` **or** `collected`; "Stuck" matches `reserving` (+
  `pending`).
- Search box: matches customer name/email **or** reward name (client-side
  filter over the loaded page; fine at current scale).
- Compact summary header for the current view: **count** + **total points
  redeemed** (sum of `pointsCost` over Completed rows in view).
- Row content mirrors today's card (reward, customer, points, barcode, product,
  timestamp, outcome). `approved`/`collected` → "✅ Completed".
- Read-only, except a **Reject** stays available on any non-terminal row.

### 4. Remove dead code
- Delete the **Collected** tab and the `markCollected()` and `undoCollected()`
  handlers + their buttons.
- Leave legacy `collected` docs untouched; they surface under Completed.

### 5. Dashboard fixes (`src/pages/admin/Dashboard.jsx`)
- Banner "N redemption requests waiting for approval" → **"N redemptions need
  attention"** (count = `pending` + `reserving`); hidden when zero. Links to the
  Needs attention tab.
- "Pending Requests" stat card → **"Needs attention"** with the same count.
- "Recent Redemptions" list: keep, with relabeled statuses (Completed/…).

### 6. Backend — Retry via shared core (chosen approach)

**Constraint discovered:** `redeemReward.js` is bound to the **caller's own
account**. It rejects `redemption.userId !== uid` (line 33) and reserves/refunds
points from `users/{uid}` (the caller), so an admin cannot drive another
customer's redemption with it today.

**Refactor:**
1. Extract the reserve → dispense → finalize/refund logic from `redeemReward`
   into a **core function** parameterized by `userId` (the redemption owner),
   `redemptionId`, and the API key — with **no dependency on who called it**.
   Behavior for the existing customer path is unchanged.
2. **Customer callable** `redeemReward`: unchanged surface. Verifies
   `request.auth`, then `redemption.userId === uid`, then calls the core with
   `userId = uid`.
3. **New admin callable** `retryRedemption` (same region/secret): verifies
   `request.auth`, verifies the **caller is an admin** by reading
   `users/{uid}.role === 'admin'` (the app's existing admin signal — no custom
   claims in use), loads the redemption, then calls the **same core** with
   `userId = redemption.userId`. Idempotent short-circuits (`approved`/`rejected`
   return stored outcome) come for free from the shared core.
4. Client wrapper: add `callRetryRedemption(redemptionId)` in
   `src/lib/redeemReward.js` (alongside `callRedeemReward`); the admin page uses
   it for the Retry action, then reloads the row.

**Security:** admin-only mutation already holds (`firestore.rules` allows
`redemptions` update by admin only; the callable runs with the admin SDK). The
new callable adds its own in-function admin check; refunds/credits always target
`redemption.userId`, never the caller.

## Testing plan (TDD)

Framework: **Vitest**; rules run under the Firebase emulator
(`npm run test:rules`). Existing suites live in `test/`.

- **Unit** — the extracted **core function**: reserve deducts once from the
  owner's balance; insufficient-points path rejects without dispensing;
  `complete` finalizes as `approved` with `product`; `reject` refunds the owner;
  idempotent re-entry on `approved`/`rejected` returns the stored outcome and
  does **not** re-dispense or double-move points. Retry uses the same
  `redemptionId` (no duplicate ledger entries). Extend `test/rewardApi.test.js`
  patterns / add `test/redeemReward.core.test.js`.
- **Integration** — the two callables against the emulator: customer callable
  still rejects `userId !== uid`; `retryRedemption` rejects a **non-admin**
  caller (`permission-denied`), accepts an admin, and moves points on
  `redemption.userId`'s account. Rules test confirms only admins update
  `redemptions`.
- **End-to-end** — a stuck (`reserving`) redemption driven through the admin
  Needs-attention tab: **Retry → Completed** (points already held, no new
  deduction) and **Refund → Rejected/REFUNDED** (points restored); a `pending`
  anomaly can be **Rejected**; History filter + search return the expected rows
  and the summary total sums Completed `pointsCost`.

## Files touched (anticipated)

- `src/pages/admin/Redemptions.jsx` — 2-tab restructure, remove collected,
  add Retry, add History search/filter/summary.
- `src/pages/admin/Dashboard.jsx` — retarget banner + stat card.
- `functions/redeemReward.js` — extract core; keep customer callable thin.
- `functions/retryRedemption.js` (new) + export in `functions/index.js`.
- `src/lib/redeemReward.js` — add `callRetryRedemption`.
- `test/` — new/extended suites per the plan above.

## Risks

- Refactoring `redeemReward`'s core touches the live customer money path.
  Mitigation: extract behavior-preserving core first, cover with unit tests
  before wiring the admin callable; the customer callable's external behavior
  must be identical.
- Admin check reads Firestore per Retry call (one extra read) — negligible at
  this scale.
