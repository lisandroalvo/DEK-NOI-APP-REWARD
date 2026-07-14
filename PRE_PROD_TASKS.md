<!-- ABOUTME: Pre-production task list to take the DEK NOI rewards PWA from feature-complete to launch. -->
<!-- ABOUTME: Tracks the code, business-content, and ops/deploy work required for MVP release. -->

# DEK NOI — Pre-Prod Task List

Goal: ship the MVP. Users can **see their points**, **see what they can redeem**, and
**request a redemption**; admins can **backfill points** from LINE-submitted receipts.

The feature set is already built and working. This list closes the remaining gaps
before we let real customers in. Check items off (`[x]`) as they land.

---

## 1. Code — MVP flow gaps

- [x] **Redemption "collected" state.** Added a `collected` status so an approved reward
      can't be shown to staff twice. Admin taps "Mark as collected" on the Approved tab
      at hand-off (`admin/Redemptions.jsx`); customer sees a "Collected" state in My
      Redemptions. Flow: `pending → approved → collected` (and `pending → rejected`).
      Rules already restrict the transition to admins (2 emulator tests added).
- [x] **Harden the points backfill.** Added `adjustPoints()` in `src/lib/points.js` — an
      atomic, balance-guarded transaction that writes the balance and the
      `pointTransactions` log together and refuses a deduction that would go negative.
      `admin/Customers.jsx` Add/Deduct now routes through it (4 emulator tests added).

## 2. Code — pre-launch polish

- [x] **Hide all promos (post-MVP).** Customer dashboard carousel replaced with a static
      branded `WelcomeBanner`. Fully unwired the rest: customer + admin `/promos` nav items,
      both routes and their imports in `App.jsx`, and the "Monthly Promos" dashboard
      quick-action. Page files (`customer/Promos.jsx`, `admin/Promos.jsx`, `PromoCarousel.jsx`)
      kept in the repo — re-enable is just restoring the nav lines + routes.

## 3. Business content (not code — blocks launch)

- [ ] **Define the reward catalog.** You can't launch a redemption app with an empty store.
      Decide the initial rewards + point costs and load them via the admin Rewards page
      (`admin/Rewards.jsx` — tooling already exists).

## 4. Ops / security — deploy & rotate (human-only, Firebase console/CLI)

These fixes exist in code but are **not live in production** until deployed.

- [ ] **Rotate the admin password.** It was committed in plaintext and is still in git
      history (commit `87fcb8e`). Rotate it and confirm the old one no longer works.
- [ ] **Deploy Firestore rules** — `firebase deploy --only firestore:rules`
      (ships the PII fix that stops customers listing the whole user roster).
- [ ] **Deploy Firestore indexes** — `firebase deploy --only firestore:indexes`
      (includes the `pointTransactions (userId, createdAt)` index).
- [ ] **Confirm/record admin bootstrap.** `role` is only ever set to `customer` in code;
      the first admin is hand-set in the Firebase console. Verify the admin account exists
      and note the procedure somewhere durable.
- [ ] **Deploy the new index** — `firebase deploy --only firestore:indexes`
      (adds `billSubmissions (userId, imageHash)` for duplicate-receipt lookup).
- [ ] **Deploy updated rules** — `firebase deploy --only firestore:rules`
      (adds the `receiptHashes` dedup-lock collection).
- [ ] **Legal review of the privacy policy** (`/privacy`) — confirm the permanent
      receipt-retention clause and fill in Dek Noi's registered legal entity name.

## 5. Verification before launch

- [ ] `npm run test:rules` green (emulator suite).
- [ ] `npm run build` clean.
- [ ] Manual E2E: register → submit bill → admin approves by amount → points update →
      redeem a reward → admin approves → admin marks collected → customer sees Collected.

---

## Explicitly deferred (post-MVP, not blocking)

Promos carousel content, email-verification enforcement, route code-splitting,
pagination, prod `console.log` cleanup, eslint cleanup.

## Known limitations

- **Duplicate-receipt hard block is client-trust bounded.** The receipt fingerprint
  (`imageHash`) is computed in the browser, so the same-account submit guard and the
  `approveBill` cross-account lock both hold against the normal app flow, shared
  screenshots, and accidental re-submits — but a modified client that omits or
  randomizes the hash can defeat them. The same-amount/same-day admin soft-flag plus
  human review are the backstop. Server-side/OCR-based dedup was deliberately deferred.
