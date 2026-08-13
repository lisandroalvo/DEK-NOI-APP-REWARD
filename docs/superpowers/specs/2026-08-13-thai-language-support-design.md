# Thai Language Support (Customer App) — Design

**Date:** 2026-08-13
**Status:** Approved, ready for implementation plan
**Scope:** Customer-facing app only (customer pages, auth pages, client-side toasts)

## Goal

Add Thai (`th`) language support to the DEK NOI customer app alongside the existing
English (`en`) UI, with an in-app switcher. Thai is the **default** for new users; the
choice is remembered per device. The admin app and dynamic Firestore content are out of
scope.

## Decisions

| Decision | Choice |
| --- | --- |
| Language mode | Toggle (EN / TH), **Thai default**, choice persisted |
| Implementation | Lightweight custom layer — no i18n library, zero new dependencies |
| In scope | Customer UI pages, auth pages (Login/Register + complete-profile modal), client-side toast/notification messages |
| Out of scope | Admin app, dynamic Firestore content (reward/promo names & descriptions), server (Cloud Function) generated message text |
| Persistence | `localStorage` (device/browser preference), not the Firestore user profile — works pre-login |

## Architecture

A small, dependency-free i18n layer under `src/i18n/`.

### `src/i18n/LanguageContext.jsx`
- `LanguageProvider` component, mounted inside `AuthProvider` (near the top of the tree in
  `App.jsx`), so all customer and auth routes are covered.
- Holds current language state: `'th' | 'en'`, initialized from `localStorage` key
  `dekNoiLang`, defaulting to `'th'` when nothing is stored.
- `setLang(lang)` updates state and writes to `localStorage`.
- Exposes a `useT()` hook returning `{ t, lang, setLang }`.

### `src/i18n/dictionaries/th.js` and `src/i18n/dictionaries/en.js`
- Plain nested JavaScript objects mapping key → string.
- Keys namespaced by area, e.g.:
  - `nav.myPoints`, `nav.rewards`, `nav.activity`, `nav.profile`
  - `dashboard.pointsBalance`, `dashboard.greeting`
  - `auth.login.title`, `auth.register.submit`
  - `toast.redeemApproved`, `toast.pointsEarned`
- `en.js` is the source-of-truth key set; `th.js` mirrors it.

### `t(key, vars)` lookup function
- Resolves `key` (dot-path) against the active language dictionary.
- Fallback chain: active lang → `en` → the key string itself (so a missing key is visible,
  never a blank UI).
- Simple interpolation: replaces `{name}`-style placeholders in the resolved string with
  values from the `vars` object. Example:
  `t('dashboard.greeting', { name: 'Nok' })` → `สวัสดี Nok 👋`.
- No pluralization engine (Thai has no plural inflection; English strings in this app
  don't require plural variants).

## Language Switcher & Default Behavior

- **Profile page**: primary switcher — an EN / TH segmented control in a
  "Language / ภาษา" row near the logout button. Always available post-login.
- **Auth pages (Login / Register)**: a compact `ไทย | EN` toggle in a corner so users can
  switch before authenticating.
- **Default**: new users (no `dekNoiLang` in `localStorage`) get **Thai**. After an
  explicit choice, that language is remembered on the device.

## What Gets Translated

- **Static UI strings**: nav labels (sidebar + mobile bottom bar), Dashboard, Rewards,
  History (Receipts + Rewards tabs), Profile, ScanBill, Promos, Login, Register, the
  complete-profile modal, buttons, empty states, and error text.
- **Client-side toasts** from hooks:
  - `useRedemptionNotifications` — redemption approved / not approved
  - `useBillNotifications` — points received / bill needs attention
  Only the surrounding sentence is translated; interpolated dynamic values
  (`{reward}`, `{points}`, admin-entered reward names, rejection reasons/notes) pass
  through unchanged.
- **Numbers/points**: keep `toLocaleString()`; render Arabic numerals in both languages
  (standard for Thai retail apps).

## Out of Scope (Future Work)

- Admin app UI.
- Dynamic Firestore content (reward names/descriptions, promo titles/descriptions) — would
  require storing both languages per document.
- Server-generated message text from Cloud Functions. The two client hooks cover the
  currently-visible toasts. If a server-originated string surfaces in the UI later, the fix
  is to send a translation **key** (plus interpolation vars) from the function instead of
  finished text, and translate client-side — noted, not built now.

## Testing

- **Unit — `t()`**: key lookup, `{var}` interpolation, missing-key fallback (active → en →
  key), language switching returns correct strings.
- **Dictionary parity**: a test asserting the key sets of `en.js` and `th.js` are identical
  (no missing or orphan keys in either direction). Keeps translation coverage pristine.
- **Component**: switching language via the Profile switcher re-renders nav/labels in the
  new language; `localStorage` persists the choice across reloads; default is Thai with no
  stored value.

## Translations Note

Thai strings will be authored as natural, polite Thai (consistent register). Because this
is customer-facing, a native speaker should review tone before release — in particular the
politeness particles (ครับ/ค่ะ) and formal-vs-casual voice. The spec/plan will mark the
Thai dictionary for that review. This does not block implementation.

## Files (anticipated)

**New**
- `src/i18n/LanguageContext.jsx`
- `src/i18n/dictionaries/en.js`
- `src/i18n/dictionaries/th.js`
- `src/i18n/t.js` (or co-located with the context) — the `t()` lookup/interpolation helper
- Tests under `test/` mirroring existing test layout

**Modified**
- `src/App.jsx` (mount `LanguageProvider`)
- `src/components/Layout.jsx` (nav labels, "Rewards Club" subtitle)
- `src/pages/customer/*` (Dashboard, Rewards, History + tabs, Profile, ScanBill, Promos)
- `src/pages/Login.jsx`, `src/pages/Register.jsx`
- `src/hooks/useRedemptionNotifications.js`, `src/hooks/useBillNotifications.js`
