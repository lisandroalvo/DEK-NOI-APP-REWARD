<!-- ABOUTME: Design spec for three pre-launch safety features: duplicate-receipt detection, an admin pending-bill signal, and a PDPA privacy policy + consent. -->
<!-- ABOUTME: Source of truth for the implementation plan; grounded in the existing bill/approval/auth code. -->

# Pre-Launch Safety Features — Design Spec

Date: 2026-07-05
Status: Approved (pending user review of this spec)

Three features that close real gaps before letting real customers into the DEK NOI
rewards PWA:

1. **Duplicate-receipt detection** — stop the same receipt from being turned into
   points more than once (the primary fraud vector).
2. **Admin "bill awaiting review" signal** — make sure pending bills don't sit
   unseen, which today means points silently never get awarded.
3. **Privacy policy + consent (Thai + English)** — a PDPA-oriented notice and a
   consent gate at registration.

Each feature is independent and can be built and shipped on its own.

---

## Context / existing code this builds on

- **Bill submission:** `src/pages/customer/ScanBill.jsx` writes a `billSubmissions`
  doc with `{ userId, userName, userEmail, imageUrl, fileName, fileSize, amount,
  ocrAmount, status: 'pending', submittedAt, reviewedAt, reviewedBy, pointsAwarded,
  notes }`. Receipt images already upload to Firebase Storage; Firestore keeps the URL.
- **Bill approval:** `src/lib/points.js` `approveBill(db, bill, amount, notes, adminUid)`
  runs a Firestore `runTransaction` that re-reads the bill, refuses a non-`pending`
  bill (`ALREADY_REVIEWED`), converts baht → points (`BAHT_PER_POINT = 50`, with
  `spendCarry` remainder), and writes a `pointTransactions` log entry. This is the
  single atomic gate for awarding points and is where the hard dedup lock belongs.
- **Admin bill review UI:** `src/pages/admin/BillReview.jsx` subscribes to *all*
  bills via `onSnapshot` (ordered by `submittedAt`) and filters client-side. It
  already catches `ALREADY_REVIEWED`; it will also catch `DUPLICATE_RECEIPT`.
- **Nav:** `src/components/Layout.jsx` builds `adminLinks` (Dashboard, **Bill Review**,
  Customers, Rewards, Redemptions, Activity Log). Bill Review renders in both the
  desktop sidebar and the mobile bottom tab bar. `useBillNotifications` is
  customer-only today.
- **Auth / registration:** `src/pages/Register.jsx`, `src/context/AuthContext.jsx`,
  `src/lib/userProfile.js` (`ensureUserProfile`). Public routes live in `src/App.jsx`.
- **Rules constraint (important):** per `firestore.rules`, a customer can list only
  their *own* `billSubmissions`. Therefore a *cross-customer* dedup check cannot run
  on the client — it must happen inside the admin-run approval transaction.
- **Testing:** emulator suite via `npm run test:rules` (currently 67 tests);
  `test/points.test.js` and `test/firestore.rules.test.js` are the relevant files.

---

## Feature 1 — Duplicate-receipt detection

**Goal:** a given receipt image can be converted into points exactly once, and the
admin is warned about likely duplicates that a pure hash can't catch.

Three layers, cheapest to strongest.

### (a) Client submit-time guard — same account

- In `ScanBill.jsx`, after a file is selected (or just before upload), compute a
  **SHA-256 of the raw image bytes** using Web Crypto:
  `crypto.subtle.digest('SHA-256', await file.arrayBuffer())` → hex string.
- Store it on the bill doc as `imageHash` (hex).
- Before uploading, query the customer's **own** bills for that hash:
  `where('userId','==',uid) && where('imageHash','==',hash)`. If any match is
  **pending or approved**, block the submit with: **"You've already submitted this
  receipt."** (English + Thai copy — see bilingual note). A previously **rejected**
  bill with the same hash does *not* block, so a customer can fix and re-submit a
  receipt an admin rejected by mistake (the approval-time lock is the real guard).
- This is allowed by rules (own-bill list) and stops accidental/lazy re-submits early.
- **New composite index** required: `billSubmissions (userId ASC, imageHash ASC)` in
  `firestore.indexes.json`.

### (b) Approval-time hard block — cross account, atomic

The real guarantee. A new collection `receiptHashes/{imageHash}` acts as a global
uniqueness lock, written inside the existing `approveBill` transaction:

- At the top of the `approveBill` transaction, if `bill.imageHash` is present:
  - `const lockRef = doc(db, 'receiptHashes', bill.imageHash)`
  - `const lockSnap = await tx.get(lockRef)`
  - If `lockSnap.exists()` **and** its `billId` !== `bill.id` → `throw new Error('DUPLICATE_RECEIPT')`.
  - Otherwise `tx.set(lockRef, { billId: bill.id, userId: bill.userId, createdAt: serverTimestamp() })`.
- Because this is in the same transaction that awards points, a receipt image can be
  **approved** exactly once globally — even across different accounts (the
  shared-LINE-screenshot case). Pending/rejected bills hold no lock, so a receipt is
  only "consumed" when points are actually granted.
- **Backward compatible:** bills without `imageHash` (legacy submissions) skip the
  lock entirely — no migration needed.
- `BillReview.jsx` `handleApprove` maps `DUPLICATE_RECEIPT` to a clear admin message
  (e.g. "This receipt image was already approved on another bill.").

Note on transaction ordering: Firestore requires all reads before writes in a
transaction. The lock `tx.get` joins the existing `tx.get(billRef)` / `tx.get(userRef)`
reads, before any `tx.update` / `tx.set`.

### (c) Admin soft-flag — heuristic, non-blocking

`BillReview` already holds all bills in memory. With no extra query, compute a
per-pending-bill ⚠️ flag when **either**:

- another bill (any status) has the **same `imageHash`** — a strong flag
  ("Exact image already submitted"), or
- another bill shares the **same `amount`** and the **same calendar day**
  (`submittedAt` date) — a weaker flag ("Same amount and day as another bill").

Purely advisory — displayed as a badge/note in the pending list and/or the review
modal. Never auto-rejects. Occasional false positives (two genuine ฿50 buys) are
acceptable because a human makes the final call.

### Rules changes (Feature 1)

```
match /receiptHashes/{hash} {
  allow read, write: if isAdmin();
}
```

(The approval transaction runs as the signed-in admin, so admin write is correct;
no customer ever touches this collection.)

### Data model additions (Feature 1)

- `billSubmissions.imageHash: string` (hex SHA-256; absent on legacy bills).
- `receiptHashes/{hash}: { billId, userId, createdAt }` (new collection).

---

## Feature 2 — Admin "bill awaiting review" signal

**Goal:** the admin always sees how many bills are waiting, so points get awarded
promptly.

- New hook `src/hooks/usePendingBillCount.js`: `usePendingBillCount(enabled)` — when
  `enabled`, an `onSnapshot` on `query(collection(db,'billSubmissions'), where('status','==','pending'))`
  returning the live count. Single-field equality filter → **no new index**. Includes
  an `onSnapshot` error handler (consistent with the other listeners) that logs and
  falls back to a `0`/no-badge state.
- `Layout.jsx`: call the hook only for admins (`usePendingBillCount(isAdmin)`), and
  extend the `links` array so the **Bill Review** item carries an optional `badge`
  count. Render a small red count badge on that nav item in both the desktop sidebar
  and the mobile bottom tab bar. Hidden when the count is 0. No effect for customers.

### Data model additions (Feature 2)

None.

---

## Feature 3 — Privacy policy (Thai + English) + consent

**Goal:** a PDPA-oriented privacy notice, publicly viewable, with a consent gate at
registration that we record.

### Privacy page

- New component `src/pages/Privacy.jsx` rendered at a **public** route `/privacy`
  (added to the unauthenticated routes in `App.jsx`, reachable without login).
- A simple **TH / EN language toggle**, defaulting to **Thai** (the customer base is
  Thai). Both language bodies live in the component.
- A visible **"Draft — review with legal counsel before launch"** banner until the
  policy is lawyer-approved.

### Policy content (I draft; PDPA-oriented template)

Covers, in both languages:

- **Data controller:** Dek Noi (เด็กน้อย).
- **Data collected:** name, email, phone number, receipt/bill images, and
  points/spend history.
- **Purposes:** operating the loyalty program — awarding points, processing
  redemptions, and contacting customers about rewards.
- **Legal basis:** consent (given at registration).
- **Retention:** ⚠️ bills are currently kept **permanently** so customers always see
  their history — the policy must disclose this, and it is explicitly flagged for
  legal review (PDPA data-minimization/retention expectations).
- **Processors / sharing:** Firebase / Google Cloud (hosting, auth, storage,
  database, and the OCR function) as data processors.
- **Data-subject rights under PDPA:** access, correction, deletion, and withdrawal of
  consent.
- **Contact:** LINE @167fnbxs.

The copy is a template, not legal advice; the banner and a code comment say so.

### Consent gate at registration

- `Register.jsx`: a **required** checkbox — *"I agree to the Privacy Policy"* / Thai
  equivalent — with the linked words opening `/privacy` in a new tab. Submit is
  blocked (button disabled + inline error) until it is checked.
- On successful registration, record consent on the user profile:
  - `privacyConsentAt: serverTimestamp()`
  - `privacyConsentVersion: PRIVACY_POLICY_VERSION`
- `PRIVACY_POLICY_VERSION` is a constant in a shared module (e.g.
  `src/lib/privacy.js`) so a future policy change can bump the version and re-prompt
  existing users (re-prompt flow itself is out of scope for this spec — only the
  stored version enables it later).

### Rules changes (Feature 3)

The `users` doc already allows the owner to write their own profile; confirm the
owner may set `privacyConsentAt` / `privacyConsentVersion`. If the current rules
restrict `users` writes to a field allow-list, extend it to include these two fields.
(Verify against `firestore.rules` during implementation; add a rules test either way.)

### Data model additions (Feature 3)

- `users.privacyConsentAt: timestamp`
- `users.privacyConsentVersion: number`

---

## Bilingual UI note

The app UI is currently all-English. This spec adds Thai only where it is
customer-legal-facing: the privacy policy body, the registration consent line, and
the customer-facing duplicate-submit message. Admin-facing strings (soft-flag,
approval errors) stay English. Broader app localization is out of scope.

---

## Testing (TDD, emulator suite)

Follow the existing pattern — write failing tests first, against the emulator.

**Feature 1**
- `test/points.test.js`: approving two different bills that share an `imageHash` →
  the second throws `DUPLICATE_RECEIPT` and awards no points / writes no
  `pointTransactions`; two bills with different hashes → both approve; a bill with no
  `imageHash` → approves with no lock written.
- `test/firestore.rules.test.js`: `receiptHashes` readable/writable by admin only;
  denied for customers.
- The soft-flag heuristic and the client submit-time hash check should be extracted
  into pure helpers where practical (e.g. a `findDuplicateFlags(bills)` /
  `hashImageFile(file)`), and those pure helpers unit-tested. Thin UI wiring verified
  manually.

**Feature 2**
- `usePendingBillCount` is a thin listener; verify manually. Any pure count/derivation
  helper that is extracted gets a unit test.

**Feature 3**
- `test/firestore.rules.test.js`: an owner may write `privacyConsentAt` /
  `privacyConsentVersion` on their own user doc; a non-owner may not.
- Consent-gate blocking in `Register.jsx` verified manually.

**Whole suite**
- `npm run test:rules` green.
- `npm run build` clean.

---

## Deploy / ops implications (human-only, noted for the launch checklist)

- Deploy the new composite index: `firebase deploy --only firestore:indexes`
  (`billSubmissions (userId, imageHash)`).
- Deploy updated rules: `firebase deploy --only firestore:rules`
  (`receiptHashes` + any `users` consent-field allowance).
- No Cloud Function changes (dedup runs in the client-side admin transaction).
- Get the privacy policy copy reviewed by legal before launch; fill in Dek Noi's
  registered legal entity name if it differs from "Dek Noi (เด็กน้อย)".

---

## Explicitly out of scope

Re-prompting existing users on a policy-version bump; OCR receipt-number extraction
for dedup (deferred — hash + amount/date heuristic is enough for MVP); broader app
localization; password reset (tracked separately).
