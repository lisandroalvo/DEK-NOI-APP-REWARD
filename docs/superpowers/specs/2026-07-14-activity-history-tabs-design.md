# Activity page with Receipts + Rewards tabs

**Date:** 2026-07-14
**Status:** Approved (design)

## Problem

Today the customer has a nav tab labeled **"My Orders"** (`/my-redemptions`,
`MyRedemptions.jsx`) that shows only reward redemptions. Separately, the
**Profile** page carries a large **"Bill History"** card listing submitted
bills plus a bill-detail modal. Bill history is buried under Profile where
users don't look for it, and the two "things I've done" lists live in
unrelated places.

## Goal

Turn the "My Orders" tab into a single **Activity** page with two sub-tabs —
**Receipts** (submitted bills) and **Rewards** (reward redemptions) — and move
the bill list out of Profile into the Receipts tab.

## Decisions

- Nav label: **Activity** (was "My Orders").
- Nav icon: **`Receipt`** (lucide-react), replacing `ShoppingBag`.
- Sub-tabs: **Receipts** / **Rewards**.
- Default sub-tab: **Receipts**.
- Route: `/my-redemptions` → **`/activity`** (path matches the visible label).

## Architecture

A thin tab-shell page composes two self-contained tab components, each owning
its own Firestore fetch. This keeps the two data concerns isolated (mirroring
how the two lists already live in separate files) and keeps each file focused.

New / changed files:

- **`src/pages/customer/History.jsx`** *(new — the Activity page)*
  Tab shell. Holds active-tab state (`'receipts' | 'rewards'`, default
  `'receipts'`), renders the tab switcher and the shared LINE help card, and
  mounts one tab body at a time.

- **`src/pages/customer/history/ReceiptsTab.jsx`** *(new)*
  The bill list + bill-detail modal, moved verbatim (behavior-preserving) out
  of `Profile.jsx`: the realtime `onSnapshot` bill query, the
  `getStatusColor` / `getStatusIcon` helpers, the bill cards, and the detail
  modal.

- **`src/pages/customer/history/RewardsTab.jsx`** *(new)*
  The redemption list, moved out of `MyRedemptions.jsx`: the redemptions
  query with its index-fallback, the Pending / History sections, the
  `RedemptionCard`, `STATUS` map, and the `useRedemptionNotifications` toast.

- **`src/pages/customer/MyRedemptions.jsx`** *(deleted)* — content moves into
  `RewardsTab.jsx`.

- **`src/App.jsx`** — import `History` instead of `MyRedemptions`; route
  `/my-redemptions` → `/activity`.

- **`src/components/Layout.jsx`** — `customerLinks` index 2: label
  `My Orders` → `Activity`, `to: '/my-redemptions'` → `to: '/activity'`, icon
  `ShoppingBag` → `Receipt`. Slot position is unchanged, so the bottom-tab and
  sidebar layout are unaffected.

- **`src/pages/customer/Profile.jsx`** — remove the Bill History card, the
  bill-detail modal, the `bills` / `selectedBill` state, the `onSnapshot`
  effect, the `getStatusColor` / `getStatusIcon` helpers, and now-unused
  imports (`Receipt`, `CheckCircle`, `XCircle`, `Clock`, and the Firestore
  `collection` / `query` / `where` / `orderBy` / `onSnapshot` imports). The
  profile card, stats card, LINE card, and logout button stay.

## Data flow

No data-model changes. Firestore collections (`billSubmissions`,
`redemptions`) and their query shapes are untouched.

- Receipts tab keeps the realtime `onSnapshot` feed on `billSubmissions`.
- Rewards tab keeps the one-shot `getDocs` fetch on `redemptions` (including
  the existing composite-index fallback and client-side sort) plus its
  redemption-status notification toast.

The LINE help card is currently duplicated in both `MyRedemptions.jsx` and
`Profile.jsx`. It lives once in `History.jsx`, shown under both tabs.

## UI / layout

- Tab switcher: two pill/segmented buttons at the top of the Activity page,
  styled in the existing brand palette (`#CC0000` active, muted inactive),
  consistent with existing controls.
- Each tab body preserves its current empty state (Receipts: "No bills
  submitted yet"; Rewards: `charSitting` image + "Browse Rewards →").
- Page uses the existing content padding conventions (`p-4 sm:p-6 md:p-8`).

## Error handling

Unchanged from current behavior: the bill `onSnapshot` error handler logs and
leaves the list empty; the redemption fetch shows its existing inline error
box on failure.

## Testing

The project's test stack is **vitest with pure-logic tests only** (`test/*.test.js`);
there is **no React component testing infrastructure** (no jsdom, no
`@testing-library/react`) and no `test` npm script. This change is a
behavior-preserving move of existing components plus nav/route renames — it
introduces no new business logic.

Open decision for the plan: either (a) add a component-test stack
(jsdom + @testing-library/react) to cover the tab-shell's default-tab and
tab-switching behavior and each tab body's list/empty rendering, or (b) verify
manually in the running app (nav label/icon, `/activity` loads on Receipts,
switching tabs, bills appear under Receipts, redemptions under Rewards,
Profile no longer shows bills). Given CLAUDE.md's testing mandate, (a) is
preferred unless the user opts into manual verification. To be resolved before
implementation.

## Out of scope

- No changes to bill submission (`ScanBill`), admin review, or the redemption
  request flow.
- No change to the "Rewards Claimed" stat placeholder on Profile.
- No data migration.
