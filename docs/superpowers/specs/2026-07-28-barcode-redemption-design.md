# Barcode-based reward redemption

**Date:** 2026-07-28
**Status:** Approved (design)

## Problem

The store is **unmanned** with a **closed self-checkout POS** that auto-charges
whatever is removed, can't apply coupons/refunds, and takes only external
payment (PromptPay/card). None of the usual redemption methods fit: there's no
staff to hand over items, no way to zero an item at checkout, and no wallet to
credit. The earlier plans (prepare-and-basket, cashback, photo + manual
reconciliation) were all either high-labor or didn't close the money loop.

## Key insight that unlocks the design

The store owner runs their **own inventory app** (the one used to restock the
store) which is the **source of truth for stock**, and it exposes an API where
quantities can be manipulated. Because the smart store reconciles physical vs.
system stock, **decrementing an item's quantity by barcode _is_ the money
reconciliation**: the unit is now booked as a comped reward, so its removal is
expected — not shrinkage/theft — and nothing needs to be charged.

So redemption becomes: the customer scans the **barcode** of the item they're
taking; we validate it and tell the inventory API to decrement it.

## Goal

Let a customer redeem a reward by scanning (or typing) the product barcode of
the item they take. On submit, a trusted server validates the product against
the reward and decrements it in the store's inventory API, then deducts the
customer's points — automatically, with the admin only handling exceptions.

## Architecture

```
Customer app ──(barcode + rewardId)──▶ Cloud Function ──▶ Inventory API (POST /reward-redemptions)
                                             │                     │ validate price ≤ maxValue
                                             │                     │ decrement qty (atomic, idempotent)
                                             │◀── product/result ──┘
                                             ▼
                                       Firestore: deduct points, write redemption record
```

- The **Cloud Function is the trusted authority.** It holds the inventory API
  key (never exposed to the phone) and it is the only actor allowed to change a
  customer's `points` (Firestore rules forbid customers from touching their own
  balance). This also removes the earlier "when do points deduct" gap — points
  come out exactly when validation + inventory-deduct succeed.
- Points live in our Firestore; product prices/stock live in the store's
  inventory system. Each side owns its own data; the Cloud Function orchestrates.

## Inventory API contract (owner implements this endpoint)

`POST /api/reward-redemptions` (path confirmed by the API team), auth
`Authorization: Bearer <REWARDS_API_KEY>` (server-to-server key, held only in
the Cloud Function).

Request:
```jsonc
{
  "idempotencyKey": "aB3xK9mP2qR7sT1uV5wY",   // = the Firestore redemption doc id; retries reuse it
  "barcode": "8850999320005",           // scanned or typed EAN/UPC
  "maxValue": 20,                       // ฿ ceiling from the redeemed reward
  "reward":   { "id": "rwd_softdrink", "name": "Soft Drink" },
  "customer": { "id": "usr_abc", "name": "Somchai P." },
  "requestedAt": "2026-07-28T09:15:00Z" // ISO 8601, for the audit log
}
```

**Idempotency key format & mapping (confirmed with the API team):**
- The key is the **Firestore redemption document id** — 20 chars matching
  `^[A-Za-z0-9]{20}$`, well within the API's `[A-Za-z0-9_-]`, ≤128-char rule.
- The API does **not** fingerprint the request body, so a key is treated as
  immutable per redemption. We guarantee **key ⇄ redemption ⇄ barcode is 1:1
  and immutable**: the key IS the redemption id; `barcode` is written once at
  creation and never mutated; a different barcode means a **new** redemption
  (new id → new key). Retries reuse the same key AND re-read the same barcode.
- **Operational rule for Phase 2:** retry the same call; never re-issue a call
  for an existing redemption with a swapped barcode.

Success:
```jsonc
{
  "ok": true,
  "replayed": false,                    // true if this idempotencyKey was already processed
  "product": { "barcode": "...", "name": "Coca-Cola 325ml", "price": 15, "category": "beverage", "remainingQty": 41 }
}
```

Errors (nothing deducted):
```jsonc
404 { "ok": false, "code": "PRODUCT_NOT_FOUND" }
409 { "ok": false, "code": "OUT_OF_STOCK",     "product": { ... } }
422 { "ok": false, "code": "EXCEEDS_MAX_VALUE", "product": { "price": 35, ... } }
401 { "ok": false, "code": "UNAUTHORIZED" }
```

Two invariants the endpoint must uphold:
1. **Validate + decrement atomically** — reject with `EXCEEDS_MAX_VALUE` when
   `product.price > maxValue`, and do the price check and the qty−1 in one
   transaction so two simultaneous redemptions can't both take the last unit.
2. **Idempotency** — the first call for a given `idempotencyKey` deducts once
   and stores the outcome; any repeat returns that outcome with `replayed:true`
   and does **not** deduct again (makes our retries safe).

## Data model changes

**Reward** (`rewards` collection, `rewards-catalog.js`, admin form): add
`maxValue` (integer ฿). Today the "up to ฿X" ceiling only lives in the
description text; we need a real number to send and validate against.

**Redemption** (`redemptions` collection) gains:
- `barcode` (string) — what the customer scanned/typed.
- `product` (object) — name/price/category/remainingQty returned by the
  inventory API (Phase 2), for the record and admin display.
- `maxValue` (number) — snapshot of the reward's ceiling at redemption time.
- `failureCode` (string, optional) — set when the inventory call rejects.

**Status model:** `pending` → `completed` (auto, Phase 2) or `rejected`.
Phase 1 keeps the existing `pending → approved → collected` admin path as the
manual stand-in (see Phasing).

## Barcode capture

Customers are a **mix of iOS and Android**, so scanning uses a cross-platform
approach:
- Primary: a JS scanner (e.g. `@zxing/browser`) over `getUserMedia`, which works
  in iOS Safari and Android Chrome. Use the native `BarcodeDetector` API when
  present (Android) as a fast path.
- Fallback: **manual entry** of the barcode number, always available.

New dependency: one barcode-scanning library. New `BarcodeScanner` component
encapsulating camera + decode + manual-entry fallback.

## Phasing

**Phase 1 — app-side, no external dependency (buildable now, shippable):**
- Add `maxValue` to the reward model + admin Rewards form + catalog.
- Add the `BarcodeScanner` component and wire it into the customer redemption
  flow (`Rewards.jsx`): confirm reward → scan/enter barcode → submit. Redemption
  is created with `barcode` + `maxValue`, status `pending`. No points deducted
  yet.
- Admin `Redemptions.jsx` shows the scanned barcode (and maxValue) on pending
  cards; the admin reads it, decrements it in the inventory app by hand, and
  approves (which deducts points via the existing, tested `approveRedemption`)
  or rejects. This is the manual stand-in for the automated flow.
- `RewardsTab.jsx` (customer) shows the barcode/status.

**Phase 2 — automation (needs the owner's endpoint live):**
- A callable **Cloud Function** that: checks affordability → `POST`s to the
  inventory endpoint (idempotencyKey = redemption id) → on `ok`, deducts points
  in a Firestore transaction keyed by the same id and marks the redemption
  `completed` with the returned `product` → on any error code, marks it
  `rejected`/failed with `failureCode` and touches no points.
- The customer submit path calls the function instead of writing the redemption
  directly; the admin page becomes exception-handling only.
- `maxValue` enforcement moves server-side (Phase 1 only stores it; the price
  check requires the inventory API).

Most of Phase 1 (scanner component, `maxValue`, redemption `barcode` field,
admin visibility) is reused by Phase 2; only the "admin manually approves"
wiring is replaced.

## Security / rules

- Firestore: allow customers to create a redemption with `barcode` + `maxValue`
  but not to set privileged fields (status beyond `pending`, product, points).
  Customers still cannot write their own `points` (unchanged).
- The inventory API key is a Cloud Function secret, never in the client
  (Phase 2).

## Points deduction

- **Phase 1:** admin-side at approval (reuse `approveRedemption`, already tested
  — balance-checked, atomic, logged).
- **Phase 2:** Cloud Function, atomically with the inventory deduction, keyed by
  redemption id.

## Out of scope (v1)

- Multi-item / bundle rewards in one scan (Triple Snack Pack, Snack & Drink
  Combo). v1 is single-item per redemption; bundles need an `items` array or
  one call per scanned item — a later extension.
- Category validation (only `maxValue` price validation for now).
- Auto-refund of an inventory deduction if the Firestore points write fails
  permanently — handled by idempotent retry + admin exception review.

## Open items to resolve before Phase 2

- Inventory API **base URL/host** and the **auth token** value (path
  `/api/reward-redemptions` and idempotency-key format are confirmed).
- Confirm the product-price unit (baht integer vs. satang) for the `maxValue`
  comparison.
