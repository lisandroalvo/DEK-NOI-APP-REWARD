# Thai Language Support (Customer App) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Thai (`th`) / English (`en`) language toggle to the DEK NOI customer app, defaulting to Thai, with the choice remembered per device.

**Architecture:** A small dependency-free i18n layer under `src/i18n/`: two flat-ish dictionary objects (`en`, `th`), a pure `translate()` lookup with `{var}` interpolation and fallback, and a React `LanguageProvider` exposing `useT()`. Components read strings via `t('key', vars)`; a switcher on the Profile and auth pages calls `setLang()`. Language persists in `localStorage`.

**Tech Stack:** React 19, Vite 8, Vitest 2 (node environment — no jsdom), plain ES modules. Zero new dependencies.

## Global Constraints

- **Zero new dependencies.** No i18n library, no jsdom, no testing-library. Tests for i18n logic must run in Vitest's default node environment.
- **Thai is the default** language when `localStorage` has no stored preference.
- **Persistence key:** `localStorage['dekNoiLang']`, values `'th'` or `'en'` only.
- **File header rule (repo convention):** every new source file starts with two `// ABOUTME: ` comment lines.
- **Fallback chain for every lookup:** active language → `en` → the key string itself. A missing key must never render blank.
- **Dynamic values pass through untranslated:** admin-entered reward/promo names, user names, point counts, rejection reasons/notes are interpolated as-is.
- **In scope:** customer pages (Dashboard, Rewards, History + Receipts/Rewards tabs, Profile, ScanBill), Layout nav/shell, auth pages (Login, Register), and the client-side toast messages in `useRedemptionNotifications` and `useBillNotifications`.
- **Out of scope:** admin app, dynamic Firestore content, Cloud Function message text. **Promos page is excluded** — it is not routed in `App.jsx` (hidden pre-MVP); translating dead UI violates YAGNI. See "Deviations from spec" below.
- **Thai translations are marked for native-speaker tone review** (ครับ/ค่ะ register) before release. This does not block implementation. The Thai voice for this app is **polite-neutral, no gendered particle** (avoids committing to ครับ/ค่ะ), matching a brand voice.
- **Run one test file:** `npx vitest run test/<file>` (repo sets `fileParallelism: false`; do not pass `--environment`).

## Deviations from spec

- The design doc listed the **Promos** page in scope. During planning we confirmed `src/pages/customer/Promos.jsx` is **not routed** in `App.jsx` (Dashboard notes the promo carousel is "hidden pre-MVP"). Per YAGNI it is excluded. If Promos is re-enabled later, add a task mirroring Task 9 (ScanBill) for its strings. **Flag this to the user at execution start.**

## File Structure

**New files**
- `src/i18n/translate.js` — pure `translate(dict, fallbackDict, key, vars)` + `resolveInitialLang(stored)`. One responsibility: string resolution. No React, no DOM.
- `src/i18n/dictionaries/en.js` — English source-of-truth dictionary (nested object).
- `src/i18n/dictionaries/th.js` — Thai dictionary, same shape as `en`.
- `src/i18n/LanguageContext.jsx` — `LanguageProvider` + `useT()` hook. Thin React wrapper over `translate.js` + `localStorage`.
- `src/components/LanguageSwitcher.jsx` — presentational EN/TH segmented toggle, reads `useT()`.
- `test/i18n.translate.test.js` — unit tests for `translate` + `resolveInitialLang`.
- `test/i18n.dictionaries.test.js` — dictionary key-parity test.

**Modified files**
- `src/App.jsx` — mount `LanguageProvider` inside `AuthProvider`.
- `src/components/Layout.jsx` — nav labels + shell strings via `t()`.
- `src/pages/customer/Dashboard.jsx`, `Rewards.jsx`, `ScanBill.jsx`, `History.jsx`, `history/ReceiptsTab.jsx`, `history/RewardsTab.jsx`, `Profile.jsx` — strings via `t()`; Profile also hosts the switcher.
- `src/pages/Login.jsx`, `src/pages/Register.jsx` — strings via `t()` + switcher.
- `src/hooks/useRedemptionNotifications.js`, `src/hooks/useBillNotifications.js` — toast text via `translate()` read from `localStorage` (hooks can't use context cleanly for a one-shot message; see Task 10).

## Dictionary key conventions

Namespaced dot-paths, grouped by area:
- `common.*` — Cancel, Close, Save, Try again, pts, points, loading…
- `nav.*` — sidebar/bottom-bar labels + shell subtitle.
- `auth.*` — login/register.
- `dashboard.*`, `rewards.*`, `scanBill.*`, `history.*`, `profile.*`.
- `toast.*` — hook messages.

Interpolation uses `{name}` placeholders, e.g. `dashboard.greeting = "Hi, {name} 👋"`.

---

### Task 1: i18n core — `translate()` and `resolveInitialLang()`

Pure functions, full TDD. No React, no DOM — runs in node.

**Files:**
- Create: `src/i18n/translate.js`
- Test: `test/i18n.translate.test.js`

**Interfaces:**
- Produces:
  - `translate(dict, fallbackDict, key, vars = {}) → string` — looks up dot-path `key` in `dict`; if missing, in `fallbackDict`; if still missing, returns `key`. Replaces every `{token}` in the resolved string with `vars[token]` (coerced to string); a `{token}` with no matching var is left literal.
  - `resolveInitialLang(stored) → 'th' | 'en'` — returns `stored` if it is exactly `'th'` or `'en'`, else `'th'`.

- [ ] **Step 1: Write the failing test**

```js
// ABOUTME: Unit tests for the pure i18n string resolver and initial-language logic.
// ABOUTME: Runs in node (no DOM); guards lookup, interpolation, fallback, and default language.
import { describe, test, expect } from 'vitest'
import { translate, resolveInitialLang } from '../src/i18n/translate.js'

const en = { common: { cancel: 'Cancel' }, dashboard: { greeting: 'Hi, {name} 👋' } }
const th = { common: { cancel: 'ยกเลิก' }, dashboard: { greeting: 'สวัสดี {name} 👋' } }

describe('translate', () => {
  test('resolves a nested key in the active dictionary', () => {
    expect(translate(th, en, 'common.cancel')).toBe('ยกเลิก')
  })
  test('interpolates {var} placeholders', () => {
    expect(translate(th, en, 'dashboard.greeting', { name: 'Nok' })).toBe('สวัสดี Nok 👋')
  })
  test('falls back to en when key missing in active dict', () => {
    const partialTh = { common: {} }
    expect(translate(partialTh, en, 'common.cancel')).toBe('Cancel')
  })
  test('returns the key itself when missing everywhere', () => {
    expect(translate(th, en, 'nope.missing')).toBe('nope.missing')
  })
  test('leaves an unmatched placeholder literal', () => {
    expect(translate(en, en, 'dashboard.greeting')).toBe('Hi, {name} 👋')
  })
})

describe('resolveInitialLang', () => {
  test('keeps a valid stored value', () => {
    expect(resolveInitialLang('en')).toBe('en')
    expect(resolveInitialLang('th')).toBe('th')
  })
  test('defaults to th for null/garbage', () => {
    expect(resolveInitialLang(null)).toBe('th')
    expect(resolveInitialLang('fr')).toBe('th')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/i18n.translate.test.js`
Expected: FAIL — cannot resolve `../src/i18n/translate.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// ABOUTME: Pure i18n resolver — dot-path lookup with en fallback and {var} interpolation.
// ABOUTME: No React/DOM so it is unit-testable in node; used by LanguageContext and hooks.
function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict)
}

export function translate(dict, fallbackDict, key, vars = {}) {
  let str = lookup(dict, key)
  if (typeof str !== 'string') str = lookup(fallbackDict, key)
  if (typeof str !== 'string') return key
  return str.replace(/\{(\w+)\}/g, (whole, token) =>
    token in vars ? String(vars[token]) : whole
  )
}

export function resolveInitialLang(stored) {
  return stored === 'en' || stored === 'th' ? stored : 'th'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/i18n.translate.test.js`
Expected: PASS (7 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/i18n/translate.js test/i18n.translate.test.js
git commit -m "feat(i18n): pure translate() resolver and default-language logic"
```

---

### Task 2: Dictionaries + parity guard

Create both dictionaries seeded with the `common`, `nav`, and shell strings, plus a test asserting `en` and `th` have identical key sets. Later tasks extend both dictionaries; this parity test is the standing automated gate that keeps them in sync.

**Files:**
- Create: `src/i18n/dictionaries/en.js`, `src/i18n/dictionaries/th.js`
- Test: `test/i18n.dictionaries.test.js`

**Interfaces:**
- Produces: default-exported nested objects `en` and `th`. Same key shape. Consumed by `LanguageContext` (Task 3) and hooks (Task 10).

- [ ] **Step 1: Write the failing parity test**

```js
// ABOUTME: Guards that the en and th dictionaries expose exactly the same key paths.
// ABOUTME: A key added to one language but not the other fails here — keeps coverage pristine.
import { describe, test, expect } from 'vitest'
import en from '../src/i18n/dictionaries/en.js'
import th from '../src/i18n/dictionaries/th.js'

function paths(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const p = prefix ? `${prefix}.${k}` : k
    return v && typeof v === 'object' ? paths(v, p) : [p]
  })
}

describe('dictionary parity', () => {
  test('en and th have identical key sets', () => {
    const enKeys = paths(en).sort()
    const thKeys = paths(th).sort()
    expect(thKeys).toEqual(enKeys)
  })
  test('no value is an empty string', () => {
    for (const dict of [en, th]) {
      for (const p of paths(dict)) {
        const val = p.split('.').reduce((n, k) => n[k], dict)
        expect(val, `${p} is empty`).not.toBe('')
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/i18n.dictionaries.test.js`
Expected: FAIL — dictionaries don't exist yet.

- [ ] **Step 3: Create `en.js`**

```js
// ABOUTME: English UI strings for the customer app, source-of-truth key set for i18n.
// ABOUTME: th.js must mirror these exact key paths (guarded by i18n.dictionaries.test.js).
export default {
  common: {
    cancel: 'Cancel',
    close: 'Close',
    tryAgain: 'Try again',
    loading: 'Loading…',
    pts: 'pts',
    points: 'points',
    or: 'or',
  },
  nav: {
    myPoints: 'My Points',
    rewards: 'Rewards',
    activity: 'Activity',
    profile: 'Profile',
    rewardsClub: '— Rewards Club —',
    signOut: 'Sign Out',
  },
}
```

- [ ] **Step 4: Create `th.js`** (marked for native review)

```js
// ABOUTME: Thai UI strings for the customer app; mirrors en.js key paths exactly.
// ABOUTME: Polite-neutral register (no gendered particle); pending native-speaker tone review.
export default {
  common: {
    cancel: 'ยกเลิก',
    close: 'ปิด',
    tryAgain: 'ลองอีกครั้ง',
    loading: 'กำลังโหลด…',
    pts: 'แต้ม',
    points: 'แต้ม',
    or: 'หรือ',
  },
  nav: {
    myPoints: 'แต้มของฉัน',
    rewards: 'ของรางวัล',
    activity: 'กิจกรรม',
    profile: 'โปรไฟล์',
    rewardsClub: '— สมาชิกสะสมแต้ม —',
    signOut: 'ออกจากระบบ',
  },
}
```

- [ ] **Step 5: Run parity test to verify it passes**

Run: `npx vitest run test/i18n.dictionaries.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/i18n/dictionaries/en.js src/i18n/dictionaries/th.js test/i18n.dictionaries.test.js
git commit -m "feat(i18n): seed en/th dictionaries with common + nav strings and parity guard"
```

---

### Task 3: LanguageProvider + `useT()`, mounted in App

Thin React wrapper. Because Vitest has no DOM here, the provider itself is not unit-tested by rendering; its logic (`resolveInitialLang`, `translate`) is already covered by Task 1. Verification is `npm run build` + `npm run lint` + manual smoke.

**Files:**
- Create: `src/i18n/LanguageContext.jsx`
- Modify: `src/App.jsx` (wrap `<BrowserRouter>` subtree — see Interfaces)

**Interfaces:**
- Consumes: `translate`, `resolveInitialLang` from `src/i18n/translate.js`; `en`, `th` dictionaries.
- Produces:
  - `LanguageProvider` — React provider component.
  - `useT()` → `{ t, lang, setLang }` where `t(key, vars) → string` binds the active dictionary, `lang` is `'th' | 'en'`, `setLang(next)` updates state + writes `localStorage['dekNoiLang']`.

- [ ] **Step 1: Create the context**

```jsx
// ABOUTME: React language provider exposing useT() { t, lang, setLang } for the customer app.
// ABOUTME: Persists choice to localStorage['dekNoiLang']; defaults to Thai on first load.
import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { translate, resolveInitialLang } from './translate'
import en from './dictionaries/en'
import th from './dictionaries/th'

const DICTS = { en, th }
const STORAGE_KEY = 'dekNoiLang'
const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() =>
    resolveInitialLang(
      typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    )
  )

  const setLang = useCallback((next) => {
    const resolved = resolveInitialLang(next)
    setLangState(resolved)
    try { localStorage.setItem(STORAGE_KEY, resolved) } catch { /* ignore quota/denied */ }
  }, [])

  const t = useCallback(
    (key, vars) => translate(DICTS[lang], en, key, vars),
    [lang]
  )

  const value = useMemo(() => ({ t, lang, setLang }), [t, lang, setLang])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useT() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useT must be used within a LanguageProvider')
  return ctx
}
```

- [ ] **Step 2: Mount the provider in `App.jsx`**

In `src/App.jsx`, add the import and wrap the router subtree. The provider goes **inside** `AuthProvider` (so it's below auth but above all routes):

```jsx
import { LanguageProvider } from './i18n/LanguageContext'
```

Change the returned tree from:

```jsx
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
```

to:

```jsx
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
```

- [ ] **Step 3: Verify build + lint pass**

Run: `npm run build && npm run lint`
Expected: build succeeds, no lint errors.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/LanguageContext.jsx src/App.jsx
git commit -m "feat(i18n): add LanguageProvider/useT and mount in App"
```

---

### Task 4: LanguageSwitcher component + Profile page

Add the reusable EN/TH toggle and place the primary instance on the Profile page. Migrate Profile's static strings in the same task (the switcher and Profile strings ship together).

**Files:**
- Create: `src/components/LanguageSwitcher.jsx`
- Modify: `src/i18n/dictionaries/en.js`, `th.js` (add `profile.*`), `src/pages/customer/Profile.jsx`
- Test: `test/i18n.dictionaries.test.js` (re-run; no edit)

**Interfaces:**
- Consumes: `useT()`.
- Produces: `LanguageSwitcher` (default export) — a segmented `ไทย | EN` control calling `setLang`.

- [ ] **Step 1: Add `profile.*` keys to both dictionaries**

Add to `en.js`:

```js
  profile: {
    title: 'My Profile',
    administrator: 'Administrator',
    customer: 'Customer',
    profilePhoto: 'Profile Photo',
    uploadPhoto: 'Upload Photo',
    fullName: 'Full Name',
    phoneNumber: 'Phone Number',
    editProfile: 'Edit Profile',
    save: 'Save Changes',
    saving: 'Saving...',
    cancel: 'Cancel',
    yourStats: 'Your Stats',
    totalPoints: 'Total Points',
    rewardsClaimed: 'Rewards Claimed',
    contactLine: 'Contact Us on LINE',
    tapToChat: 'Tap to chat with us on LINE',
    getSupport: 'Get support and updates!',
    updateFailed: 'Failed to update profile',
    language: 'Language / ภาษา',
  },
```

Add to `th.js` (same keys):

```js
  profile: {
    title: 'โปรไฟล์ของฉัน',
    administrator: 'ผู้ดูแลระบบ',
    customer: 'ลูกค้า',
    profilePhoto: 'รูปโปรไฟล์',
    uploadPhoto: 'อัปโหลดรูป',
    fullName: 'ชื่อ-นามสกุล',
    phoneNumber: 'เบอร์โทรศัพท์',
    editProfile: 'แก้ไขโปรไฟล์',
    save: 'บันทึกการเปลี่ยนแปลง',
    saving: 'กำลังบันทึก...',
    cancel: 'ยกเลิก',
    yourStats: 'สถิติของคุณ',
    totalPoints: 'แต้มสะสมทั้งหมด',
    rewardsClaimed: 'ของรางวัลที่แลกแล้ว',
    contactLine: 'ติดต่อเราทาง LINE',
    tapToChat: 'แตะเพื่อแชทกับเราทาง LINE',
    getSupport: 'รับความช่วยเหลือและข่าวสาร!',
    updateFailed: 'อัปเดตโปรไฟล์ไม่สำเร็จ',
    language: 'ภาษา / Language',
  },
```

- [ ] **Step 2: Create `LanguageSwitcher.jsx`**

```jsx
// ABOUTME: Segmented ไทย | EN toggle that switches the app language via useT().setLang.
// ABOUTME: Presentational; used on the Profile page and the auth pages.
import { useT } from '../i18n/LanguageContext'

export default function LanguageSwitcher() {
  const { lang, setLang } = useT()
  const opts = [
    { code: 'th', label: 'ไทย' },
    { code: 'en', label: 'EN' },
  ]
  return (
    <div className="inline-flex rounded-full border-2 border-gray-200 p-0.5" role="group" aria-label="Language">
      {opts.map(({ code, label }) => {
        const active = lang === code
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            className="px-4 py-1.5 rounded-full text-sm font-black transition-colors"
            style={active ? { background: '#CC0000', color: '#fff' } : { color: '#6b7280' }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Wire Profile strings + switcher**

In `src/pages/customer/Profile.jsx`:
- Add imports: `import { useT } from '../../i18n/LanguageContext'` and `import LanguageSwitcher from '../../components/LanguageSwitcher'`.
- Inside the component: `const { t } = useT()`.
- Replace the literal strings with `t()` calls per the key map in Step 1. Examples:
  - `My Profile` → `{t('profile.title')}`
  - `'Administrator' : 'Customer'` → `t('profile.administrator') : t('profile.customer')`
  - `Profile Photo`/`Upload Photo`/`Full Name`/`Phone Number` labels → their keys.
  - `Save Changes`/`Saving...`/`Cancel`/`Edit Profile` → their keys.
  - `Your Stats`/`Total Points`/`Rewards Claimed` → their keys.
  - LINE card: `Contact Us on LINE`/`Tap to chat with us on LINE`/`Get support and updates!` → keys.
  - `alert('Failed to update profile')` → `alert(t('profile.updateFailed'))`.
  - `Sign Out` → `{t('nav.signOut')}`.
- Add a language row above the Logout button:

```jsx
      {/* Language */}
      <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <span className="text-sm font-bold text-gray-700">{t('profile.language')}</span>
        <LanguageSwitcher />
      </div>
```

- [ ] **Step 4: Verify parity, build, lint**

Run: `npx vitest run test/i18n.dictionaries.test.js && npm run build && npm run lint`
Expected: parity PASS, build ok, lint clean.

- [ ] **Step 5: Manual smoke**

Run: `npm run dev`, open Profile, toggle ไทย/EN — labels switch and the choice survives a reload.

- [ ] **Step 6: Commit**

```bash
git add src/components/LanguageSwitcher.jsx src/pages/customer/Profile.jsx src/i18n/dictionaries/en.js src/i18n/dictionaries/th.js
git commit -m "feat(i18n): language switcher and translated Profile page"
```

---

### Task 5: Layout nav + shell

**Files:**
- Modify: `src/i18n/dictionaries/en.js`, `th.js` (nav keys already exist from Task 2), `src/components/Layout.jsx`

**Interfaces:**
- Consumes: `useT()`. `nav.*` keys from Task 2.

- [ ] **Step 1: Translate Layout**

In `src/components/Layout.jsx`:
- Add `import { useT } from '../i18n/LanguageContext'` and `const { t } = useT()` in the component that renders the customer links (and the `CompleteProfileModal` if it renders customer-visible copy — see Step 2).
- Build the customer `links` array labels from `t()`:
  - `label: 'My Points'` → `label: t('nav.myPoints')`
  - `'Rewards'` → `t('nav.rewards')`
  - `'Activity'` → `t('nav.activity')`
  - `'Profile'` → `t('nav.profile')`
- Shell subtitle: replace the customer branch `'— Rewards Club —'` with `t('nav.rewardsClub')`. **Leave the admin branch `'— Admin Panel —'` in English** (admin out of scope).
- The `pts` suffix near the points chip → `t('common.pts')`.

- [ ] **Step 2: Translate the CompleteProfileModal copy**

Add to both dictionaries under a new `completeProfile` namespace:

`en.js`:
```js
  completeProfile: {
    title: 'One more thing!',
    subtitle: 'Add your phone number so we can reach you about your rewards.',
    phoneLabel: 'Phone Number',
    save: 'Save',
    skip: 'Skip for now',
  },
```

`th.js`:
```js
  completeProfile: {
    title: 'อีกนิดเดียว!',
    subtitle: 'กรอกเบอร์โทรศัพท์เพื่อให้เราติดต่อคุณเรื่องของรางวัลได้',
    phoneLabel: 'เบอร์โทรศัพท์',
    save: 'บันทึก',
    skip: 'ข้ามไปก่อน',
  },
```

Then replace the modal's literals (`One more thing!`, the subtitle, `Phone Number` label, and its save/skip buttons) with the matching `t()` calls. Match the actual button text in the file; if the current save/skip labels differ, add keys with the real text rather than inventing new copy.

- [ ] **Step 3: Verify parity, build, lint**

Run: `npx vitest run test/i18n.dictionaries.test.js && npm run build && npm run lint`
Expected: all pass.

- [ ] **Step 4: Manual smoke**

Sidebar + mobile bottom bar labels switch language; complete-profile modal (if triggered) is translated.

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.jsx src/i18n/dictionaries/en.js src/i18n/dictionaries/th.js
git commit -m "feat(i18n): translate nav labels and app shell"
```

---

### Task 6: Dashboard page

**Files:**
- Modify: `src/i18n/dictionaries/en.js`, `th.js` (add `dashboard.*`), `src/pages/customer/Dashboard.jsx`

- [ ] **Step 1: Add `dashboard.*` keys**

`en.js`:
```js
  dashboard: {
    greeting: 'Hi, {name} 👋',
    pointsBalance: 'POINTS BALANCE',
    ptsUnit: 'PTS',
    earned: 'Earned',
    redeemed: 'Redeemed',
    pending: 'Pending',
    toNextPoint: '{n} ฿ to your next point',
    nextReward: 'Next reward',
    unlockAt: 'Unlock at {n} pts',
    allUnlocked: 'You can redeem every reward — nice!',
    viewRewards: 'View rewards',
    loadError: "Couldn't load your activity. Pull to refresh or try again later.",
    recentActivity: 'Recent Activity',
  },
```

`th.js`:
```js
  dashboard: {
    greeting: 'สวัสดี {name} 👋',
    pointsBalance: 'แต้มสะสม',
    ptsUnit: 'แต้ม',
    earned: 'ได้รับ',
    redeemed: 'แลกแล้ว',
    pending: 'รอดำเนินการ',
    toNextPoint: 'อีก {n} บาท รับอีก 1 แต้ม',
    nextReward: 'รางวัลถัดไป',
    unlockAt: 'ปลดล็อกที่ {n} แต้ม',
    allUnlocked: 'คุณแลกได้ทุกรางวัลแล้ว เยี่ยมไปเลย!',
    viewRewards: 'ดูของรางวัล',
    loadError: 'โหลดกิจกรรมของคุณไม่สำเร็จ ลองรีเฟรชหรือกลับมาใหม่ภายหลัง',
    recentActivity: 'กิจกรรมล่าสุด',
  },
```

> Note: verify each key against the current Dashboard copy while editing — add keys for any visible string this list misses (e.g. exact "Earned/Redeemed/Pending" tile labels, the tx-error message text). Every visible literal must become a key; the parity test only checks en/th agree, not that you caught them all, so read the file top to bottom.

- [ ] **Step 2: Translate Dashboard.jsx**

Add `import { useT } from '../../i18n/LanguageContext'`, `const { t } = useT()`. Replace literals with `t()`. Interpolate dynamic values:
- Greeting: `{t('dashboard.greeting', { name: profile?.name?.split(' ')[0] })}`.
- `to your next point`: `{t('dashboard.toNextPoint', { n: toNextPoint })}`.
- Reward-unlock text: `{t('dashboard.unlockAt', { n: nextReward.pointsCost.toLocaleString() })}`.
- Keep `pts.toLocaleString()` numeric output as-is.

- [ ] **Step 3: Verify parity, build, lint**

Run: `npx vitest run test/i18n.dictionaries.test.js && npm run build && npm run lint`

- [ ] **Step 4: Manual smoke** — Dashboard renders Thai by default; toggling to EN restores English.

- [ ] **Step 5: Commit**

```bash
git add src/pages/customer/Dashboard.jsx src/i18n/dictionaries/en.js src/i18n/dictionaries/th.js
git commit -m "feat(i18n): translate customer Dashboard"
```

---

### Task 7: Rewards page (grid + 3 modals + error messages)

**Files:**
- Modify: `src/i18n/dictionaries/en.js`, `th.js` (add `rewards.*`), `src/pages/customer/Rewards.jsx`

- [ ] **Step 1: Add `rewards.*` keys** (covers header, cards, confirm/details/result modals, and `CODE_MESSAGES`)

`en.js`:
```js
  rewards: {
    storeTitle: 'Rewards Store',
    subtitle: 'Redeem your points for great rewards!',
    empty: 'No rewards available right now. Check back soon!',
    needMore: 'Need {n} more pts',
    redeem: 'Redeem',
    locked: 'Locked 🔒',
    // confirm modal
    thisWillUse: 'This will use',
    pointsWord: 'points',
    remainingAfter: "You'll have {n} pts remaining after redeeming",
    scanHint: "Next, scan the barcode of the item you're taking — your points are used right away.",
    confirmRedeem: 'Confirm Redeem',
    submitting: 'Submitting…',
    // details modal
    pointsRequired: 'Points Required',
    yourBalance: 'Your Balance',
    needToRedeem: 'You need {n} more points to redeem this reward',
    redeemNow: 'Redeem Now',
    // result modal
    redeeming: 'Redeeming…',
    confirmingReward: 'Confirming your {name} — one moment.',
    enjoyTitle: 'Enjoy your reward!',
    almostTitle: 'Almost there',
    couldntTitle: "Couldn't redeem",
    enjoyBody: 'Grab your {name}. {n} points were used.',
    // error/code messages
    errOutOfStock: 'That item is out of stock right now.',
    errExceedsMax: 'That item costs more than this reward allows. Please pick a lower-priced item.',
    errNotFound: "We couldn't find that barcode. Please scan again.",
    errInsufficient: "You don't have enough points for this reward.",
    errBadRequest: 'That barcode looks invalid. Please scan again.',
    errGenericComplete: 'This redemption could not be completed.',
    errBusy: 'The store system is busy. Please try again in a moment.',
    errPermanent: 'This reward can’t be redeemed right now. Please try a different item or contact support.',
    errStart: 'Could not start the redemption. Please try again.',
  },
```

`th.js`:
```js
  rewards: {
    storeTitle: 'ร้านของรางวัล',
    subtitle: 'นำแต้มของคุณมาแลกของรางวัลสุดพิเศษ!',
    empty: 'ยังไม่มีของรางวัลตอนนี้ กลับมาดูใหม่เร็ว ๆ นี้!',
    needMore: 'ต้องการอีก {n} แต้ม',
    redeem: 'แลกเลย',
    locked: 'ล็อกอยู่ 🔒',
    thisWillUse: 'จะใช้',
    pointsWord: 'แต้ม',
    remainingAfter: 'หลังแลกแล้วคุณจะเหลือ {n} แต้ม',
    scanHint: 'ขั้นต่อไป สแกนบาร์โค้ดสินค้าที่คุณเลือก แต้มจะถูกใช้ทันที',
    confirmRedeem: 'ยืนยันการแลก',
    submitting: 'กำลังส่ง…',
    pointsRequired: 'แต้มที่ต้องใช้',
    yourBalance: 'แต้มคงเหลือ',
    needToRedeem: 'คุณต้องการอีก {n} แต้มเพื่อแลกรางวัลนี้',
    redeemNow: 'แลกเลย',
    redeeming: 'กำลังแลก…',
    confirmingReward: 'กำลังยืนยัน {name} ของคุณ รอสักครู่',
    enjoyTitle: 'ขอให้สนุกกับรางวัลของคุณ!',
    almostTitle: 'อีกนิดเดียว',
    couldntTitle: 'แลกไม่สำเร็จ',
    enjoyBody: 'รับ {name} ของคุณได้เลย ใช้ไป {n} แต้ม',
    errOutOfStock: 'สินค้านี้หมดสต็อกในขณะนี้',
    errExceedsMax: 'สินค้านี้มีราคาเกินที่รางวัลนี้กำหนด กรุณาเลือกสินค้าที่ราคาต่ำกว่า',
    errNotFound: 'ไม่พบบาร์โค้ดนี้ กรุณาสแกนใหม่อีกครั้ง',
    errInsufficient: 'แต้มของคุณไม่พอสำหรับรางวัลนี้',
    errBadRequest: 'บาร์โค้ดไม่ถูกต้อง กรุณาสแกนใหม่อีกครั้ง',
    errGenericComplete: 'ไม่สามารถทำรายการแลกนี้ได้',
    errBusy: 'ระบบร้านกำลังไม่ว่าง กรุณาลองใหม่อีกสักครู่',
    errPermanent: 'ขณะนี้ยังแลกรางวัลนี้ไม่ได้ กรุณาลองสินค้าอื่นหรือติดต่อฝ่ายบริการ',
    errStart: 'เริ่มการแลกไม่สำเร็จ กรุณาลองอีกครั้ง',
  },
```

- [ ] **Step 2: Translate Rewards.jsx**

Add `useT`. Rebuild `CODE_MESSAGES` from `t()` **inside the component** (it currently sits at module/closure scope — move it inside so it re-resolves per language):

```jsx
const CODE_MESSAGES = {
  OUT_OF_STOCK: t('rewards.errOutOfStock'),
  EXCEEDS_MAX_VALUE: t('rewards.errExceedsMax'),
  PRODUCT_NOT_FOUND: t('rewards.errNotFound'),
  INSUFFICIENT_POINTS: t('rewards.errInsufficient'),
  BAD_REQUEST: t('rewards.errBadRequest'),
}
```

Replace remaining literal fallbacks (`'This redemption could not be completed.'`, `'The store system is busy…'`, the permanent-error string, `'Could not start the redemption…'`) with their keys. Replace header/card/modal literals with `t()`; interpolate dynamic numbers/names:
- `Need {ptsNeeded} more pts` → `t('rewards.needMore', { n: ptsNeeded.toLocaleString() })`.
- Remaining-after line → `t('rewards.remainingAfter', { n: (pts - showModal.pointsCost).toLocaleString() })`.
- Result body → `t('rewards.enjoyBody', { name: result.product?.name || result.reward.name, n: result.reward.pointsCost.toLocaleString() })`.
- `Confirming your {reward.name}` → `t('rewards.confirmingReward', { name: result.reward.name })`.
- Reward `name`/`description` stay untranslated (admin content).

- [ ] **Step 3: Verify parity, build, lint** — `npx vitest run test/i18n.dictionaries.test.js && npm run build && npm run lint`

- [ ] **Step 4: Manual smoke** — grid, both modals, and a forced error path show Thai; toggling restores English.

- [ ] **Step 5: Commit**

```bash
git add src/pages/customer/Rewards.jsx src/i18n/dictionaries/en.js src/i18n/dictionaries/th.js
git commit -m "feat(i18n): translate Rewards store, modals, and redemption messages"
```

---

### Task 8: ScanBill page

**Files:**
- Modify: `src/i18n/dictionaries/en.js`, `th.js` (add `scanBill.*`), `src/pages/customer/ScanBill.jsx`

- [ ] **Step 1: Add `scanBill.*` keys**

`en.js`:
```js
  scanBill: {
    title: '📄 Scan Your Bill',
    subtitle: 'Upload your receipt to collect points!',
    takePhoto: 'Take a Photo',
    tapCamera: 'Tap to use camera',
    or: 'OR',
    uploadGallery: 'Upload from Gallery',
    tapBrowse: 'Tap to browse files',
    sizeHint: 'Photos up to 10MB accepted (auto-compressed)',
    tipsTitle: '📌 Tips for best results:',
    tipVisible: 'Make sure the bill is clearly visible',
    tipTotal: 'Include the total amount and date',
    tipBlur: 'Avoid blurry or dark photos',
    reading: '📷 Reading the total from your receipt…',
    readingShort: 'Reading receipt…',
    enterTotal: 'Enter the total',
    submit: '✅ Submit Bill',
    uploading: 'Uploading...',
    submittedTitle: 'Bill submitted successfully!',
    submittedBody: 'An admin will review it soon.',
    errChooseImage: 'Please choose an image file',
    errTooLarge: 'File size must be less than 10MB',
    errImageTooLarge: 'Image too large. Try a smaller image.',
    errEnterAmount: 'Please enter the bill amount (฿).',
    errPermission: 'Permission denied. Please contact support.',
    errUpload: 'Failed to upload bill. ',
    errTryAgain: 'Please try again.',
  },
```

`th.js`:
```js
  scanBill: {
    title: '📄 สแกนใบเสร็จ',
    subtitle: 'อัปโหลดใบเสร็จเพื่อรับแต้มสะสม!',
    takePhoto: 'ถ่ายรูป',
    tapCamera: 'แตะเพื่อใช้กล้อง',
    or: 'หรือ',
    uploadGallery: 'อัปโหลดจากคลังภาพ',
    tapBrowse: 'แตะเพื่อเลือกไฟล์',
    sizeHint: 'รองรับรูปขนาดไม่เกิน 10MB (บีบอัดอัตโนมัติ)',
    tipsTitle: '📌 เคล็ดลับให้ได้ผลดีที่สุด:',
    tipVisible: 'ให้เห็นใบเสร็จชัดเจน',
    tipTotal: 'ใส่ยอดรวมและวันที่ให้ครบ',
    tipBlur: 'หลีกเลี่ยงรูปเบลอหรือมืดเกินไป',
    reading: '📷 กำลังอ่านยอดรวมจากใบเสร็จ…',
    readingShort: 'กำลังอ่านใบเสร็จ…',
    enterTotal: 'กรอกยอดรวม',
    submit: '✅ ส่งใบเสร็จ',
    uploading: 'กำลังอัปโหลด...',
    submittedTitle: 'ส่งใบเสร็จเรียบร้อยแล้ว!',
    submittedBody: 'ผู้ดูแลจะตรวจสอบให้เร็ว ๆ นี้',
    errChooseImage: 'กรุณาเลือกไฟล์รูปภาพ',
    errTooLarge: 'ไฟล์ต้องมีขนาดน้อยกว่า 10MB',
    errImageTooLarge: 'รูปใหญ่เกินไป ลองใช้รูปที่เล็กลง',
    errEnterAmount: 'กรุณากรอกยอดใบเสร็จ (฿)',
    errPermission: 'ไม่มีสิทธิ์ดำเนินการ กรุณาติดต่อฝ่ายบริการ',
    errUpload: 'อัปโหลดใบเสร็จไม่สำเร็จ ',
    errTryAgain: 'กรุณาลองอีกครั้ง',
  },
```

- [ ] **Step 2: Translate ScanBill.jsx** — add `useT`; replace each literal above with its key. Keep the `฿` amount and any numeric total as-is.

- [ ] **Step 3: Verify parity, build, lint** — `npx vitest run test/i18n.dictionaries.test.js && npm run build && npm run lint`

- [ ] **Step 4: Manual smoke** — upload flow, tips, and an error (e.g. non-image file) show Thai.

- [ ] **Step 5: Commit**

```bash
git add src/pages/customer/ScanBill.jsx src/i18n/dictionaries/en.js src/i18n/dictionaries/th.js
git commit -m "feat(i18n): translate ScanBill upload flow"
```

---

### Task 9: History page + Receipts tab + Rewards tab

**Files:**
- Modify: `src/i18n/dictionaries/en.js`, `th.js` (add `history.*`), `src/pages/customer/History.jsx`, `src/pages/customer/history/ReceiptsTab.jsx`, `src/pages/customer/history/RewardsTab.jsx`

- [ ] **Step 1: Add `history.*` keys**

`en.js`:
```js
  history: {
    title: 'Activity',
    tabReceipts: 'Receipts',
    tabRewards: 'Rewards',
    haveQuestion: 'Have a question?',
    tapChat: 'Tap to chat with us on',
    forHelp: 'for help with your rewards.',
    // receipts tab
    noBills: 'No bills submitted yet',
    uploadFirst: 'Tap the 📄 button to upload your first bill!',
    billDetails: 'Bill Details',
    bill: 'Bill',
    adminNotes: 'Admin Notes:',
    statusPending: 'Pending',
    statusApproved: 'Approved',
    statusRejected: 'Rejected',
    loadBillsError: 'Failed to load bill history',
    // rewards tab
    loading: 'Loading…',
    noRedemptions: 'No redemptions yet',
    browseRewards: 'Browse Rewards →',
    loadRedemptionsError: 'Error loading redemptions',
    rPending: '⏳ Pending Approval',
    rProcessing: '⏳ Processing',
    rApproved: '✅ Approved',
    rCollected: '🛍️ Collected',
    rRejected: '❌ Not Approved',
    rPendingNote: 'Admin will review your request shortly.',
    rProcessingNote: 'Finishing your redemption…',
    rApprovedNote: 'Enjoy — your reward is yours!',
    rCollectedNote: 'Enjoy your reward — thanks for collecting!',
    rRejectedNote: 'Contact us on LINE if you have questions.',
  },
```

`th.js`:
```js
  history: {
    title: 'กิจกรรม',
    tabReceipts: 'ใบเสร็จ',
    tabRewards: 'ของรางวัล',
    haveQuestion: 'มีคำถามไหม?',
    tapChat: 'แตะเพื่อแชทกับเราทาง',
    forHelp: 'เพื่อขอความช่วยเหลือเรื่องรางวัลของคุณ',
    noBills: 'ยังไม่มีใบเสร็จที่ส่ง',
    uploadFirst: 'แตะปุ่ม 📄 เพื่ออัปโหลดใบเสร็จแรกของคุณ!',
    billDetails: 'รายละเอียดใบเสร็จ',
    bill: 'ใบเสร็จ',
    adminNotes: 'หมายเหตุจากผู้ดูแล:',
    statusPending: 'รอดำเนินการ',
    statusApproved: 'อนุมัติแล้ว',
    statusRejected: 'ไม่อนุมัติ',
    loadBillsError: 'โหลดประวัติใบเสร็จไม่สำเร็จ',
    loading: 'กำลังโหลด…',
    noRedemptions: 'ยังไม่มีการแลกรางวัล',
    browseRewards: 'ดูของรางวัล →',
    loadRedemptionsError: 'โหลดข้อมูลการแลกรางวัลไม่สำเร็จ',
    rPending: '⏳ รออนุมัติ',
    rProcessing: '⏳ กำลังดำเนินการ',
    rApproved: '✅ อนุมัติแล้ว',
    rCollected: '🛍️ รับแล้ว',
    rRejected: '❌ ไม่อนุมัติ',
    rPendingNote: 'ผู้ดูแลจะตรวจสอบคำขอของคุณเร็ว ๆ นี้',
    rProcessingNote: 'กำลังดำเนินการแลกรางวัลให้เสร็จ…',
    rApprovedNote: 'รับรางวัลของคุณได้เลย!',
    rCollectedNote: 'ขอให้สนุกกับรางวัล ขอบคุณที่มารับ!',
    rRejectedNote: 'หากมีคำถาม ติดต่อเราทาง LINE ได้เลย',
  },
```

- [ ] **Step 2: Translate the three files** — add `useT` in each; map every visible literal to its key. Status labels come from the `r*`/`status*` keys. Keep `LINE` as the literal brand word inside the sentence (compose: `{t('history.tapChat')} LINE {t('history.forHelp')}` following the existing markup).

- [ ] **Step 3: Verify parity, build, lint** — `npx vitest run test/i18n.dictionaries.test.js && npm run build && npm run lint`

- [ ] **Step 4: Manual smoke** — both tabs, empty states, and at least one redemption status render Thai.

- [ ] **Step 5: Commit**

```bash
git add src/pages/customer/History.jsx src/pages/customer/history/ReceiptsTab.jsx src/pages/customer/history/RewardsTab.jsx src/i18n/dictionaries/en.js src/i18n/dictionaries/th.js
git commit -m "feat(i18n): translate Activity history (receipts + rewards tabs)"
```

---

### Task 10: Auth pages (Login, Register) + switcher

**Files:**
- Modify: `src/i18n/dictionaries/en.js`, `th.js` (add `auth.*`), `src/pages/Login.jsx`, `src/pages/Register.jsx`

- [ ] **Step 1: Add `auth.*` keys**

`en.js`:
```js
  auth: {
    welcomeBack: 'Welcome back!',
    signInSub: 'Sign in to your Rewards account',
    continueGoogle: 'Continue with Google',
    signingIn: 'Signing in…',
    googleTerms: 'By continuing with Google, you agree to our',
    privacyPolicy: 'Privacy Policy',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign In',
    newMember: 'New member?',
    joinFree: 'Join for free!',
    invalidLogin: 'Invalid email or password.',
    googleFailed: 'Google sign-in failed. Please try again.',
    // register
    joinTitle: 'Join Rewards Club',
    joinSub: 'Earn points with every purchase!',
    signUpGoogle: 'Sign up with Google',
    signingUp: 'Signing up…',
    fillManually: 'or fill in manually',
    fullName: 'Full Name',
    emailAddress: 'Email Address',
    phoneNumber: 'Phone Number',
    createAccount: 'Create My Account',
    creatingAccount: 'Creating account…',
    registrationFailed: 'Registration failed.',
    alreadyMember: 'Already a member?',
  },
```

`th.js`:
```js
  auth: {
    welcomeBack: 'ยินดีต้อนรับกลับ!',
    signInSub: 'เข้าสู่ระบบบัญชีสะสมแต้มของคุณ',
    continueGoogle: 'ดำเนินการต่อด้วย Google',
    signingIn: 'กำลังเข้าสู่ระบบ…',
    googleTerms: 'เมื่อดำเนินการต่อด้วย Google ถือว่าคุณยอมรับ',
    privacyPolicy: 'นโยบายความเป็นส่วนตัว',
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    signIn: 'เข้าสู่ระบบ',
    newMember: 'ยังไม่เป็นสมาชิก?',
    joinFree: 'สมัครฟรี!',
    invalidLogin: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    googleFailed: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    joinTitle: 'สมัครสมาชิกสะสมแต้ม',
    joinSub: 'รับแต้มสะสมทุกการซื้อ!',
    signUpGoogle: 'สมัครด้วย Google',
    signingUp: 'กำลังสมัคร…',
    fillManually: 'หรือกรอกข้อมูลเอง',
    fullName: 'ชื่อ-นามสกุล',
    emailAddress: 'อีเมล',
    phoneNumber: 'เบอร์โทรศัพท์',
    createAccount: 'สร้างบัญชีของฉัน',
    creatingAccount: 'กำลังสร้างบัญชี…',
    registrationFailed: 'สมัครสมาชิกไม่สำเร็จ',
    alreadyMember: 'เป็นสมาชิกอยู่แล้ว?',
  },
```

- [ ] **Step 2: Translate Login.jsx + Register.jsx** — add `useT` + `import LanguageSwitcher`. Replace literals with keys. Place `<LanguageSwitcher />` in the top-right corner of each page's card container (inside the existing top color-bar layout, so it sits above the form). Keep the trailing Thai phrase already hardcoded in Login's Google-terms line by replacing the whole line with the `auth.googleTerms` + `auth.privacyPolicy` composition (the standalone Thai fragment is removed — it's now covered by the `th` dictionary).

- [ ] **Step 3: Verify parity, build, lint** — `npx vitest run test/i18n.dictionaries.test.js && npm run build && npm run lint`

- [ ] **Step 4: Manual smoke** — Login and Register default to Thai; switcher on each page flips language pre-login and the choice carries into the app.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Login.jsx src/pages/Register.jsx src/i18n/dictionaries/en.js src/i18n/dictionaries/th.js
git commit -m "feat(i18n): translate Login/Register and add pre-login switcher"
```

---

### Task 11: Client-side toast messages (hooks)

Hooks emit one-shot toast strings and are not inside a component render, so they read the language directly from `localStorage` and call the pure `translate()` with both dictionaries — no context dependency. Dynamic values (reward name, points, notes) interpolate.

**Files:**
- Modify: `src/i18n/dictionaries/en.js`, `th.js` (add `toast.*`), `src/hooks/useRedemptionNotifications.js`, `src/hooks/useBillNotifications.js`

**Interfaces:**
- Consumes: `translate` from `src/i18n/translate.js`, `resolveInitialLang`, `en`, `th`.

- [ ] **Step 1: Add `toast.*` keys**

`en.js`:
```js
  toast: {
    redeemApproved: '🎉 Your "{reward}" redemption was approved! Visit the store to collect it.',
    redeemRejected: 'Your "{reward}" redemption was not approved.{reason}',
    pointsReceived: 'You received +{points} points!',
    billNeedsAttention: 'Please check the bill and try again.',
  },
```

`th.js`:
```js
  toast: {
    redeemApproved: '🎉 อนุมัติการแลก "{reward}" แล้ว! เชิญมารับที่ร้านได้เลย',
    redeemRejected: 'การแลก "{reward}" ไม่ได้รับอนุมัติ{reason}',
    pointsReceived: 'คุณได้รับ +{points} แต้ม!',
    billNeedsAttention: 'กรุณาตรวจสอบใบเสร็จแล้วลองใหม่อีกครั้ง',
  },
```

> `{reason}` is the already-built suffix string (e.g. `" Reason: …"`), passed through untranslated since it may contain admin free-text. `bill.notes` likewise passes through; `billNeedsAttention` is only the fallback when there are no notes.

- [ ] **Step 2: Add a tiny toast-translate helper usage in each hook**

At the top of each hook module, import the pieces and add a local resolver:

```js
import { translate, resolveInitialLang } from '../i18n/translate'
import en from '../i18n/dictionaries/en'
import th from '../i18n/dictionaries/th'

const DICTS = { en, th }
function tMsg(key, vars) {
  const lang = resolveInitialLang(localStorage.getItem('dekNoiLang'))
  return translate(DICTS[lang], en, key, vars)
}
```

Then replace the literal template strings:
- `useRedemptionNotifications.js`:
  - approved → `tMsg('toast.redeemApproved', { reward: data.rewardName })`
  - rejected → `tMsg('toast.redeemRejected', { reward: data.rewardName, reason })` (keep the existing `reason` variable exactly as built).
- `useBillNotifications.js`:
  - points → `tMsg('toast.pointsReceived', { points: bill.pointsAwarded })`
  - needs-attention → `bill.notes || tMsg('toast.billNeedsAttention')`

- [ ] **Step 3: Verify parity, build, lint** — `npx vitest run test/i18n.dictionaries.test.js && npm run build && npm run lint`

- [ ] **Step 4: Manual smoke** — trigger (or simulate) an approval/points toast in each language.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRedemptionNotifications.js src/hooks/useBillNotifications.js src/i18n/dictionaries/en.js src/i18n/dictionaries/th.js
git commit -m "feat(i18n): translate client-side redemption/bill toast messages"
```

---

### Task 12: Full-suite verification + translation-review marker

**Files:** none new; final gate.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run` (all files; emulator suites need the emulator — if not running, at minimum run the i18n tests: `npx vitest run test/i18n.translate.test.js test/i18n.dictionaries.test.js`).
Expected: i18n tests PASS; no regressions in existing suites you can run.

- [ ] **Step 2: Build + lint clean**

Run: `npm run build && npm run lint`
Expected: both clean.

- [ ] **Step 3: Manual end-to-end pass**

Fresh browser (clear `localStorage`) → app is Thai. Walk Login → Dashboard → Rewards → ScanBill → Activity → Profile. Toggle to EN on Profile, confirm every page flips and the choice persists across reload.

- [ ] **Step 4: Add the native-review marker**

Confirm `th.js` header carries the "pending native-speaker tone review" note (from Task 2). Open a tracking issue/TODO for a native speaker to review Thai copy (register, particles) — do not block release on it.

- [ ] **Step 5: Commit any final touch-ups** (only if Steps 1–4 surfaced fixes)

```bash
git add -A
git commit -m "chore(i18n): full-suite verification pass for Thai support"
```

---

## Self-Review

**Spec coverage:**
- Toggle EN/TH, Thai default, persisted → Tasks 2 (`resolveInitialLang` default th), 3 (provider + localStorage), 4 (switcher). ✅
- Lightweight custom, zero deps → Global Constraints + Task 1/2 pure JS, node tests. ✅
- Customer UI pages → Tasks 5–9. ✅
- Auth pages → Task 10. ✅
- Client-side toasts → Task 11. ✅
- Out of scope (admin, dynamic content, CF text) → Global Constraints; admin subtitle explicitly left English (Task 5). ✅
- Dynamic values pass through → Tasks 6–11 interpolation notes. ✅
- Testing: unit (Task 1), parity/coverage (Task 2, re-run every task), manual smoke each task + full pass (Task 12). Component-render tests intentionally omitted to honor zero-dep constraint; logic is covered by pure-function tests. ✅
- Translations marked for native review → Task 2 header + Task 12 Step 4. ✅
- **Promos**: spec listed it; excluded here because unrouted → documented under "Deviations from spec". ⚠️ Flag to user.

**Placeholder scan:** No "TBD"/"implement later". Each task carries real dictionary content and real replacement instructions. The Dashboard note to "read the file top to bottom for missed literals" is guidance for exhaustive extraction, not a deferred placeholder — the listed keys are complete for the known strings.

**Type consistency:** `translate(dict, fallbackDict, key, vars)` and `resolveInitialLang(stored)` signatures match across Tasks 1, 3, 11. `useT()` returns `{ t, lang, setLang }` consistently (Tasks 3, 4, 5+). Storage key `'dekNoiLang'` identical in Tasks 3 and 11. Dictionary namespaces referenced by page tasks all exist by the task that uses them.
