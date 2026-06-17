# Spend & Points Tracking — Design Spec

ABOUTME: Design for spend-based points (50฿ = 1pt), receipt-total OCR pre-fill, and
ABOUTME: carry-the-remainder progress so small purchases still feel rewarding.

Date: 2026-06-14
Status: Approved (design) — pending spec review before implementation planning

## Goal

Turn the loyalty program from manually-awarded points into **spend-based points**:
every approved bill earns points proportional to the baht spent, the receipt total is
**auto-recognized from the photo** (customer can correct, admin gives final approval),
and **no spend is ever wasted** — leftover baht below the points threshold is banked and
shown to the customer as visible progress toward their next point.

## Key Decisions

- **Rate:** `50฿ = 1 point`. Stored as a single named constant `BAHT_PER_POINT = 50` in
  one place so it can be retuned with a one-line change (no settings system — declined for
  YAGNI). Reward point-costs will be set later to match this rate.
- **Carry the remainder:** leftover baht below 50 is banked per-customer (`spendCarry`) and
  rolls into the next purchase. Every baht eventually becomes a point; nothing is discarded.
- **Customer sees points only** — points balance + a "X฿ to your next point" progress bar.
  Customers do **not** see their total spend.
- **Total spend is an admin-only metric** — shown in the admin Customers list.
- **OCR is best-effort pre-fill**, never authoritative or blocking. Two human checkpoints
  (customer correction + admin approval) mean an imperfect guess is fine.
- **OCR engine:** Google **Gemini Flash** (vision) via a new callable Cloud Function. The
  image goes straight to the model with a prompt asking for the final total in THB; this
  robustly handles the real-world variety — POS printouts, KPlus/SCB bank slips, screenshots,
  Thai+English, right-aligned amounts, fee/reference lines — without per-format parsing code.
  (Superseded the original keyword-regex-over-Vision-OCR plan, which broke on bank slips: it
  missed `จำนวน`/`AMOUNT` totals and its largest-number fallback grabbed transaction/biller
  numbers.) Runs via **Vertex AI** (`vertexai:true`, no API key) so it bills to the project's
  Blaze account rather than a prepaid AI Studio key; cheap at this volume.
- **No backfill:** existing approved bills have no amount; `totalSpent`/`spendCarry` start at
  0 for all users. History rows for old bills show "—" for amount.
- **No orphan uploads:** OCR runs on image *bytes* sent to the function; the image is only
  written to Storage on final submit.
- **Promos stay informational** — they do not affect point math (unchanged from today).

## End-to-End Flow

1. Customer picks/snaps a receipt photo.
2. App compresses it (existing `compressImageToBlob`) and calls the callable
   `recognizeReceiptTotal({ imageBase64 })`.
3. Function runs Vision OCR + a pure `extractTotal()` parser, returns `{ amount: number|null }`.
4. ScanBill shows an **editable "Amount (฿)" field** pre-filled with the guess (empty if none),
   plus a live estimate computed against the customer's current `spendCarry`
   (e.g. *"+2 points — then 10฿ to the next!"*).
5. Customer corrects if needed and submits. The image uploads to Storage; the bill doc is
   created with `amount` (customer's number) and `ocrAmount` (the guess).
6. Admin opens Bill Review → sees the image and an **editable Amount field** pre-filled with the
   customer's number (OCR guess shown as a hint), with computed points shown. Admin confirms or
   corrects the amount, approves.
7. Approval runs the existing atomic, idempotent transaction (extended): credits points, banks
   carry, adds to total spend, logs the transaction.
8. Customer Dashboard shows the updated points balance and progress bar. Admin Customers list
   shows the customer's updated total spend.

## Data Model Changes

### `users` (new fields)
- `totalSpent: number` — lifetime ฿ spent (approved bills only). Admin-only metric. Default 0.
- `spendCarry: number` — leftover ฿ toward the next point, always in `[0, 49]`. Default 0.
  Used to render the customer's progress bar (`50 - spendCarry` = ฿ to next point).

Both are **owner-immutable** (only admins/transactions may change them) — see Security Rules.

### `billSubmissions` (new fields)
- `amount: number` — the ฿ total. Customer sets it on create; admin may correct it on approval
  (the value at approval is authoritative).
- `ocrAmount: number | null` — what Vision guessed, kept for reference/audit.
- `pointsAwarded: number` — already exists; set at approval to the points this bill actually
  generated (after carry math). May be 0.

### `pointTransactions` (bill-approval rows)
- Add `amount: number` — the ฿ that earned these points, so history can show "฿250 → 5 pts".

**Backward compatibility:** old bills have no `amount`/`ocrAmount` (treated as null; history shows
"—"). Existing users get `totalSpent`/`spendCarry` defaulted to 0 on first write (read code uses
`?? 0`). No data migration.

## Points / Spend Logic

Single source of truth in `src/lib/points.js`. New constant:

```js
export const BAHT_PER_POINT = 50
```

`approveBill` signature changes from `(db, bill, pointsAwarded, notes, adminUid)` to
`(db, bill, amount, notes, adminUid)`. Inside the existing transaction (reads before writes):

```
if (!(amount > 0)) throw new Error('INVALID_AMOUNT')
// idempotency guard (unchanged): re-read bill, require status === 'pending', else ALREADY_REVIEWED
const before  = user.spendCarry || 0
const pool    = before + amount
const earned  = Math.floor(pool / BAHT_PER_POINT)   // may be 0
const carry   = pool % BAHT_PER_POINT               // 0..49

bill.amount        = amount      // final, authoritative
bill.ocrAmount     = (unchanged) // already on the doc
bill.pointsAwarded = earned
bill.status        = 'approved'
user.points       += earned
user.spendCarry    = carry
user.totalSpent   += amount
log pointTransaction { userId, points: earned, amount, reason: 'Bill approved', addedBy, createdAt }
```

Notes:
- `earned` may be 0 (sub-threshold bill); the spend and carry are still recorded and the
  transaction is still logged — nothing is lost.
- Idempotency guard from the prior fix is preserved, so double-approval cannot double-count
  spend or points.
- `approveRedemption` is unchanged (redemptions don't touch spend/carry).

## OCR Backend (new)

First Cloud Function in the project. New `functions/` directory, `firebase-functions` v2,
deployed to `asia-southeast1` (close to users / the Storage bucket).

### Callable `recognizeReceiptTotal`
- **Auth required** (reject unauthenticated callers).
- **Input:** `{ imageBase64 }` — a compressed JPEG as base64 (no data-URI prefix).
- Sends the image to **Gemini Flash** (`@google/genai`, model `gemini-2.5-flash`) with a prompt
  that asks for ONLY the final total paid in THB — never a subtotal, fee, tax, change, account,
  or reference number — or the literal `none`.
- Passes the reply through `parseAmount()` and returns `{ amount: number | null }`.
- Via Vertex AI (no API key): requires the `aiplatform.googleapis.com` API enabled and the
  function's runtime service account granted `roles/aiplatform.user`. Also, the Gen-2 callable's
  Cloud Run service must allow unauthenticated invocation (`allUsers` → `roles/run.invoker`).
- **Never throws to block UX:** any model/parse failure returns `{ amount: null }` so the
  customer simply types the amount manually. (Auth failure is the only hard error.)

### Pure parser `parseAmount(text) -> number | null`
Dependency-free module (no firebase imports) so it is unit-testable from the existing vitest
setup. Trims the model's reply, returns `null` for empty/`none`, strips commas and any currency
words/symbols, extracts the first number, and returns it only if `> 0`.

This parser is the feature's testable core; the Gemini call itself is verified E2E by hand.

## UI Changes

- **ScanBill** (`src/pages/customer/ScanBill.jsx`):
  - On file select: compress → "Reading receipt…" → call `recognizeReceiptTotal` → pre-fill the
    Amount field (editable) or leave empty on null.
  - New required numeric **Amount (฿)** input (> 0).
  - Live estimate using the customer's current `spendCarry`:
    "+N points — then M฿ to your next point."
  - On submit: upload image to Storage (existing `uploadImageFile`), `addDoc` with `amount` and
    `ocrAmount`.
- **Customer Dashboard** (`src/pages/customer/Dashboard.jsx`):
  - Keep the points balance.
  - Add a **progress bar**: "X฿ to your next point" where `X = 50 - spendCarry`, fill =
    `spendCarry / 50`.
  - Do **not** show total spent.
- **Profile bill history** (`src/pages/customer/Profile.jsx`): show each bill's ฿ amount (and
  points if approved); "—" for legacy bills with no amount.
- **Bill Review** (`src/pages/admin/BillReview.jsx`): replace the "Points to Award" input with an
  **Amount (฿)** input pre-filled from the customer's value; show the OCR guess as a hint
  ("Scanned: ฿X") and the computed points (`floor(amount / 50)`, shown as approximate since the
  exact credit depends on the customer's carry at approval time). Approve calls
  `approveBill(db, bill, amount, notes, adminUid)`.
- **Admin Customers** (`src/pages/admin/Customers.jsx`): show `totalSpent` per customer.

## Security Rules

- `users` update: add `totalSpent` and `spendCarry` to the owner-immutable set, alongside the
  existing `points` and `role` protection — a customer self-update must leave all four unchanged;
  only admins (and the approval transaction running as an admin) may change them.
- `billSubmissions` create: customer may set `amount` (a number) and `ocrAmount`; `pointsAwarded`
  must be `0` on create. Update remains admin-only (unchanged).

## Error Handling & Edge Cases

- OCR returns null / fails / times out → Amount field empty, customer types it; submission never
  blocked.
- Amount must be a positive number — validated in the client, in `approveBill`, and shape-checked
  in rules.
- Vision API / function error → `{ amount: null }`, logged server-side; upload flow unaffected.
- Double-approval → `ALREADY_REVIEWED` (existing idempotency guard); spend/points/carry never
  double-counted.
- Legacy bills without `amount` → history shows "—".
- `spendCarry` is always normalized to `[0, 49]` by the modulo, so the progress bar can't show a
  full or negative bar.

## Testing (TDD)

- **`test/points.test.js`** (extend):
  - 120฿ from carry 0 → +2 pts, carry 20, totalSpent 120.
  - Carry accrual across two bills (e.g. 80฿ then 30฿) lands the right points and carry.
  - Sub-threshold (30฿ from carry 0) → +0 pts, carry 30, totalSpent 30, transaction logged.
  - `amount <= 0` → `INVALID_AMOUNT`, no state change.
  - Double-approval → `ALREADY_REVIEWED`, no double count of points/spend/carry.
- **`test/firestore.rules.test.js`** (extend):
  - Customer cannot change own `totalSpent` or `spendCarry`.
  - Customer can create a bill with `amount`.
- **`test/parseAmount.test.js`** (new): plain decimals/integers, comma stripping, currency
  words/symbols, number-in-a-sentence, `none` → null, empty → null, non-positive → null.
- Gemini call + Cloud Function wiring: verified E2E manually (no automated test for the external
  API call).

## Suggested Build Order

1. Data model + `approveBill` carry/spend logic + constant (TDD via points.test.js) — pure logic,
   no UI/backend deps.
2. Security rules for `totalSpent`/`spendCarry` + bill `amount` (TDD via rules test). Deploy rules.
3. `parseAmount` pure parser (TDD via parseAmount.test.js).
4. Cloud Function `recognizeReceiptTotal` calling Gemini Flash; set `GEMINI_API_KEY` secret; deploy.
5. ScanBill UI (amount field, OCR call, live estimate).
6. BillReview UI (amount input, computed points).
7. Customer Dashboard progress bar + Profile/admin Customers displays.

(Steps 1–3 are pure and fully unit-tested; 4–7 are wiring/UI verified by build + manual E2E.)
