# Admin Redemptions Reorg Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the admin Redemptions page around automatic redemption — a "Needs attention" action surface + a searchable "History" log — and give admins a server-side Retry for stuck redemptions.

**Architecture:** Extract `redeemReward`'s reserve→dispense→finalize/refund logic into a caller-agnostic `redeemCore` keyed off the redemption's own owner, so both the existing customer callable and a new admin-only `retryRedemption` callable share it. On the client, extract pure redemption helpers (filter/search/summarize/label) into `src/lib/redemptions.js`, then rebuild `Redemptions.jsx` into two tabs and retarget the Dashboard's stale copy.

**Tech Stack:** React 19 (JSX) + Vite, Firebase (Firestore, Cloud Functions v2, `asia-southeast1`), Vitest + Firebase emulator (`@firebase/rules-unit-testing` for client-rules tests, `firebase-admin` for core money-path tests).

## Global Constraints

- Every source file starts with two `// ABOUTME: ` comment lines (repo convention).
- Never use `--no-verify`; never bypass pre-commit hooks.
- No mock modes. Tests use the real Firebase emulator; `redeemCore` takes an **injected `dispense` collaborator** (a real async function) so the POS HTTP call is a genuine architectural seam, not a fake mode. The customer redemption flow's external behavior must be **identical** after the refactor.
- All Vitest suites run via `npm run test:rules` (starts the emulator via `firebase emulators:exec --project demo-dek-noi`, which sets `FIRESTORE_EMULATOR_HOST`).
- Cloud Functions region is `asia-southeast1`; secret is `REWARDS_API_KEY`; POS URL is `https://dek-noi-dashboard.vercel.app/api/reward-redemptions`.
- Status vocabulary: live flow `pending → reserving → approved` / `rejected`; legacy `collected` is frozen (displayed as "Completed", never written).
- Admin is identified by `users/{uid}.role === 'admin'` (no custom claims in this project).
- Brand red is `#CC0000`; match existing Tailwind/inline-style patterns in the file being edited.

---

### Task 1: Pure redemption helpers (`src/lib/redemptions.js`)

Foundation for the UI rebuild: all filter/search/summarize/label logic lives here as pure functions so it is unit-tested without a component harness (mirrors `src/lib/points.js` / `functions/rewardApi.js`).

**Files:**
- Create: `src/lib/redemptions.js`
- Test: `test/redemptions.test.js`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - `NEEDS_ATTENTION_STATUSES: string[]` = `['reserving', 'pending']`
  - `isNeedsAttention(status: string): boolean`
  - `outcomeOf(status: string): 'completed' | 'rejected' | 'stuck' | 'other'` — `approved`/`collected`→`'completed'`, `rejected`→`'rejected'`, `reserving`/`pending`→`'stuck'`.
  - `matchesHistoryFilter(r: object, filter: 'all'|'completed'|'rejected'|'stuck'): boolean`
  - `matchesSearch(r: object, term: string): boolean` — case-insensitive match over `userName`, `userEmail`, `rewardName`.
  - `summarize(list: object[]): { count: number, pointsRedeemed: number }` — `pointsRedeemed` sums `pointsCost` over `outcomeOf === 'completed'` rows.

- [ ] **Step 1: Write the failing test**

```js
// ABOUTME: Unit tests for pure admin-redemption view helpers (filter/search/summarize).
import { describe, test, expect } from 'vitest'
import {
  NEEDS_ATTENTION_STATUSES, isNeedsAttention, outcomeOf,
  matchesHistoryFilter, matchesSearch, summarize,
} from '../src/lib/redemptions.js'

describe('needs-attention selection', () => {
  test('reserving and pending need attention; terminal states do not', () => {
    expect(NEEDS_ATTENTION_STATUSES).toEqual(['reserving', 'pending'])
    expect(isNeedsAttention('reserving')).toBe(true)
    expect(isNeedsAttention('pending')).toBe(true)
    expect(isNeedsAttention('approved')).toBe(false)
    expect(isNeedsAttention('collected')).toBe(false)
    expect(isNeedsAttention('rejected')).toBe(false)
  })
})

describe('outcomeOf', () => {
  test('approved and legacy collected both read as completed', () => {
    expect(outcomeOf('approved')).toBe('completed')
    expect(outcomeOf('collected')).toBe('completed')
  })
  test('rejected -> rejected, reserving/pending -> stuck', () => {
    expect(outcomeOf('rejected')).toBe('rejected')
    expect(outcomeOf('reserving')).toBe('stuck')
    expect(outcomeOf('pending')).toBe('stuck')
  })
})

describe('matchesHistoryFilter', () => {
  test.each([
    ['all', 'approved', true], ['all', 'rejected', true],
    ['completed', 'approved', true], ['completed', 'collected', true], ['completed', 'rejected', false],
    ['rejected', 'rejected', true], ['rejected', 'approved', false],
    ['stuck', 'reserving', true], ['stuck', 'pending', true], ['stuck', 'approved', false],
  ])('filter %s vs status %s -> %s', (filter, status, expected) => {
    expect(matchesHistoryFilter({ status }, filter)).toBe(expected)
  })
})

describe('matchesSearch', () => {
  const r = { userName: 'Somchai P.', userEmail: 'som@example.com', rewardName: 'Soft Drink' }
  test('empty term matches everything', () => { expect(matchesSearch(r, '')).toBe(true) })
  test('case-insensitive match on name, email, reward', () => {
    expect(matchesSearch(r, 'somchai')).toBe(true)
    expect(matchesSearch(r, 'SOM@')).toBe(true)
    expect(matchesSearch(r, 'drink')).toBe(true)
  })
  test('non-match returns false', () => { expect(matchesSearch(r, 'coffee')).toBe(false) })
})

describe('summarize', () => {
  test('counts all, sums pointsCost only over completed', () => {
    const list = [
      { status: 'approved', pointsCost: 30 },
      { status: 'collected', pointsCost: 20 },
      { status: 'rejected', pointsCost: 50 },
      { status: 'reserving', pointsCost: 10 },
    ]
    expect(summarize(list)).toEqual({ count: 4, pointsRedeemed: 50 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:rules -- redemptions.test.js`
Expected: FAIL — cannot resolve `../src/lib/redemptions.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// ABOUTME: Pure view helpers for the admin Redemptions page — filter, search, summarize.
// ABOUTME: No Firestore/React deps so the page's list logic is unit-tested in isolation.

export const NEEDS_ATTENTION_STATUSES = ['reserving', 'pending']

export function isNeedsAttention(status) {
  return NEEDS_ATTENTION_STATUSES.includes(status)
}

// Map a stored status to the customer-facing outcome the History tab groups by.
// approved and legacy 'collected' are both "completed"; the live limbo states are "stuck".
export function outcomeOf(status) {
  if (status === 'approved' || status === 'collected') return 'completed'
  if (status === 'rejected') return 'rejected'
  if (status === 'reserving' || status === 'pending') return 'stuck'
  return 'other'
}

export function matchesHistoryFilter(r, filter) {
  if (filter === 'all') return true
  return outcomeOf(r.status) === filter
}

export function matchesSearch(r, term) {
  const t = term.trim().toLowerCase()
  if (!t) return true
  return [r.userName, r.userEmail, r.rewardName]
    .some((f) => String(f ?? '').toLowerCase().includes(t))
}

export function summarize(list) {
  let pointsRedeemed = 0
  for (const r of list) {
    if (outcomeOf(r.status) === 'completed') pointsRedeemed += r.pointsCost ?? 0
  }
  return { count: list.length, pointsRedeemed }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:rules -- redemptions.test.js`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/redemptions.js test/redemptions.test.js
git commit -m "feat: pure helpers for admin redemptions filter/search/summary"
```

---

### Task 2: Extract `redeemCore` + dispenser; refactor `redeemReward` (behavior-preserving)

Pull the money logic out of the customer callable into a caller-agnostic core keyed off `redemption.userId`, with the POS call injected as `dispense`. The customer callable keeps identical external behavior.

**Files:**
- Create: `functions/dispense.js`
- Create: `functions/redeemCore.js`
- Modify: `functions/redeemReward.js` (replace body; keep the `redeemReward` export + `onCall` options)
- Create: `test/redeemCore.test.js`
- Modify: `package.json` (add `firebase-admin` to `devDependencies` so the core test can init an admin app against the emulator)

**Interfaces:**
- Consumes: `classifyRedemptionResult`, `postRewardRedemption` from `functions/rewardApi.js`.
- Produces:
  - `makeDispenser(apiUrl: string, apiKey: string): (payload) => Promise<{action:'complete'|'reject'|'retry', product?, code?, message?}>` — runs the `[0,1000,2000,4000]ms` backoff loop, returns the classified result.
  - `redeemCore({ db, redemptionId, dispense }): Promise<{ ok, status, product?, code?, message? }>` — loads the redemption, short-circuits on `approved`/`rejected`, reserves points from `users/{redemption.userId}`, calls `dispense`, then finalizes (`approved`) or refunds (`rejected`); throws `HttpsError('unavailable')` on persistent transient. Idempotent per `redemptionId`.

- [ ] **Step 1: Write the failing test**

```js
// ABOUTME: Emulator-backed tests for redeemCore — reserve/finalize/refund/idempotency money paths.
// ABOUTME: Runs under `npm run test:rules`; uses firebase-admin against the Firestore emulator.
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { redeemCore } from '../functions/redeemCore.js'

const PROJECT_ID = 'demo-dek-noi'
let app, db

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' })
}

async function seed({ points = 100, status = 'pending' } = {}) {
  await db.collection('users').doc('u1').set({ name: 'Alice', points })
  await db.collection('rewards').doc('rw1').set({ name: 'Soft Drink', pointsCost: 30, maxValue: 20 })
  await db.collection('redemptions').doc('rd1').set({
    userId: 'u1', userName: 'Alice', rewardId: 'rw1', rewardName: 'Soft Drink', barcode: '8850999320005', status,
  })
}
const balance = async () => (await db.collection('users').doc('u1').get()).data().points
const redemption = async () => (await db.collection('redemptions').doc('rd1').get()).data()
const ledgerCount = async () => (await db.collection('pointTransactions').get()).size

beforeAll(() => { app = initializeApp({ projectId: PROJECT_ID }); db = getFirestore() })
afterAll(async () => { await deleteApp(app) })
beforeEach(clearFirestore)

describe('redeemCore', () => {
  test('complete: deducts once, approves, writes one ledger entry', async () => {
    await seed()
    const dispense = async () => ({ action: 'complete', product: { name: 'Coke', price: 15 } })
    const res = await redeemCore({ db, redemptionId: 'rd1', dispense })
    expect(res).toEqual({ ok: true, status: 'approved', product: { name: 'Coke', price: 15 } })
    expect(await balance()).toBe(70)
    expect((await redemption()).status).toBe('approved')
    expect(await ledgerCount()).toBe(1)
  })

  test('idempotent: a second complete call does not deduct again', async () => {
    await seed()
    const dispense = async () => ({ action: 'complete', product: { name: 'Coke' } })
    await redeemCore({ db, redemptionId: 'rd1', dispense })
    await redeemCore({ db, redemptionId: 'rd1', dispense }) // status now 'approved' -> short-circuits
    expect(await balance()).toBe(70)
    expect(await ledgerCount()).toBe(1)
  })

  test('reject after reserve: refunds points and records failure', async () => {
    await seed()
    const dispense = async () => ({ action: 'reject', code: 'OUT_OF_STOCK', message: 'Sold out', product: null })
    const res = await redeemCore({ db, redemptionId: 'rd1', dispense })
    expect(res.ok).toBe(false)
    expect(res.code).toBe('OUT_OF_STOCK')
    expect(await balance()).toBe(100) // deducted then refunded
    const r = await redemption()
    expect(r.status).toBe('rejected')
    expect(r.failureCode).toBe('OUT_OF_STOCK')
    expect(await ledgerCount()).toBe(2) // debit + refund
  })

  test('insufficient points: rejects without dispensing', async () => {
    await seed({ points: 10 })
    let called = false
    const dispense = async () => { called = true; return { action: 'complete' } }
    const res = await redeemCore({ db, redemptionId: 'rd1', dispense })
    expect(res.code).toBe('INSUFFICIENT_POINTS')
    expect(called).toBe(false)
    expect(await balance()).toBe(10)
    expect((await redemption()).status).toBe('rejected')
  })

  test('persistent transient: throws, leaves points reserved (retryable)', async () => {
    await seed()
    const dispense = async () => ({ action: 'retry', code: 'UPSTREAM_ERROR' })
    await expect(redeemCore({ db, redemptionId: 'rd1', dispense })).rejects.toThrow()
    expect(await balance()).toBe(70) // still held
    expect((await redemption()).status).toBe('reserving')
  })

  test('retry from reserving completes without a second deduction', async () => {
    await seed()
    // First attempt reserves then dies transiently.
    await expect(redeemCore({ db, redemptionId: 'rd1', dispense: async () => ({ action: 'retry', code: 'UPSTREAM_ERROR' }) })).rejects.toThrow()
    // Retry drives the same redemption to completion.
    const res = await redeemCore({ db, redemptionId: 'rd1', dispense: async () => ({ action: 'complete', product: { name: 'Coke' } }) })
    expect(res.status).toBe('approved')
    expect(await balance()).toBe(70) // deducted exactly once across both attempts
    expect(await ledgerCount()).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:rules -- redeemCore.test.js`
Expected: FAIL — cannot resolve `../functions/redeemCore.js` (and possibly `firebase-admin` not resolvable from root until the devDependency is added).

- [ ] **Step 3: Add `firebase-admin` to root devDependencies**

The core test file itself imports `firebase-admin/app`. Add it so root Vitest can resolve it:

```bash
npm install --save-dev firebase-admin
```

Expected: `package.json` gains `firebase-admin` under `devDependencies`; `package-lock.json` updates. (The `functions/` package keeps its own copy for deploy.)

- [ ] **Step 4: Write the dispenser**

```js
// ABOUTME: Builds the POS dispense collaborator — runs the retry/backoff loop over the
// ABOUTME: reward-redemptions API and returns one classified result for redeemCore to act on.
import { classifyRedemptionResult, postRewardRedemption } from './rewardApi.js'

const BACKOFF_MS = [0, 1000, 2000, 4000]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function makeDispenser(apiUrl, apiKey) {
  return async function dispense(payload) {
    let result = null
    for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
      if (attempt > 0) await sleep(BACKOFF_MS[attempt])
      const { status, body } = await postRewardRedemption(apiUrl, apiKey, payload)
      result = classifyRedemptionResult(status, body)
      if (result.action !== 'retry') break
    }
    return result
  }
}
```

- [ ] **Step 5: Write `redeemCore`**

```js
// ABOUTME: Caller-agnostic redemption engine — reserves the owner's points, dispenses via the
// ABOUTME: injected collaborator, then finalizes or refunds atomically. Idempotent per redemption.
import { HttpsError } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'

export async function redeemCore({ db, redemptionId, dispense }) {
  const redemptionRef = db.collection('redemptions').doc(redemptionId)
  const snap = await redemptionRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Redemption not found.')
  const redemption = snap.data()
  const ownerId = redemption.userId
  const userRef = db.collection('users').doc(ownerId)

  // Already resolved -> return the stored outcome (idempotent, no re-dispense).
  if (redemption.status === 'approved') {
    return { ok: true, status: 'approved', product: redemption.product ?? null }
  }
  if (redemption.status === 'rejected') {
    return { ok: false, status: 'rejected', code: redemption.failureCode ?? 'REJECTED', message: redemption.failureMessage ?? null, product: redemption.product ?? null }
  }
  // Only 'pending' (fresh) or 'reserving' (a retry after a mid-flight death) proceed.
  if (redemption.status !== 'pending' && redemption.status !== 'reserving') {
    throw new HttpsError('failed-precondition', 'Redemption is not processable.')
  }

  const barcode = String(redemption.barcode ?? '').trim()
  if (!barcode) throw new HttpsError('failed-precondition', 'Redemption has no barcode.')

  // Authoritative reward values — never trust the client-written snapshot.
  const rewardSnap = await db.collection('rewards').doc(redemption.rewardId).get()
  if (!rewardSnap.exists) throw new HttpsError('failed-precondition', 'Reward no longer exists.')
  const reward = rewardSnap.data()
  const pointsCost = reward.pointsCost
  const maxValue = reward.maxValue
  if (!(pointsCost > 0) || !(maxValue > 0)) throw new HttpsError('failed-precondition', 'Reward is misconfigured.')

  // ── Reserve step ──────────────────────────────────────────────────────────
  // Deduct BEFORE dispensing so two concurrent redemptions can't both dispense.
  // Idempotent: only a 'pending' redemption reserves; a 'reserving' one (retry) skips
  // to the API. An insufficient balance rejects here, before any item is dispensed.
  const reserveOutcome = await db.runTransaction(async (tx) => {
    const rSnap = await tx.get(redemptionRef)
    if (rSnap.data()?.status !== 'pending') return 'proceed' // already reserved (retry) or resolved
    const bal = (await tx.get(userRef)).data()?.points ?? 0
    if (bal < pointsCost) {
      tx.update(redemptionRef, {
        status: 'rejected', failureCode: 'INSUFFICIENT_POINTS', failureMessage: 'Not enough points.',
        reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system',
      })
      return 'insufficient'
    }
    tx.update(userRef, { points: bal - pointsCost })
    tx.update(redemptionRef, { status: 'reserving', reservedAt: FieldValue.serverTimestamp(), reservedPoints: pointsCost })
    tx.set(db.collection('pointTransactions').doc(), {
      userId: ownerId, points: -pointsCost, reason: `Redeemed: ${reward.name ?? 'reward'}`,
      addedBy: 'system', createdAt: FieldValue.serverTimestamp(),
    })
    return 'reserved'
  })
  if (reserveOutcome === 'insufficient') {
    return { ok: false, status: 'rejected', code: 'INSUFFICIENT_POINTS', message: 'Not enough points.', product: null }
  }

  // ── Dispense (idempotencyKey = redemptionId) ──
  const payload = {
    idempotencyKey: redemptionId,
    barcode,
    maxValue,
    reward: { id: redemption.rewardId, name: reward.name },
    customer: { id: ownerId, name: redemption.userName ?? '' },
    requestedAt: new Date().toISOString(),
  }
  const result = await dispense(payload)

  if (result.action === 'complete') {
    const product = result.product ?? null
    await db.runTransaction(async (tx) => {
      const rSnap = await tx.get(redemptionRef)
      if (rSnap.data()?.status !== 'reserving') return
      tx.update(redemptionRef, { status: 'approved', product, reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system' })
    })
    return { ok: true, status: 'approved', product }
  }

  if (result.action === 'reject') {
    await db.runTransaction(async (tx) => {
      const rSnap = await tx.get(redemptionRef)
      if (rSnap.data()?.status !== 'reserving') return
      const refundAmount = rSnap.data()?.reservedPoints ?? pointsCost
      const bal = (await tx.get(userRef)).data()?.points ?? 0
      tx.update(userRef, { points: bal + refundAmount })
      tx.update(redemptionRef, {
        status: 'rejected', failureCode: result.code, failureMessage: result.message ?? null,
        product: result.product ?? null, reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system',
      })
      tx.set(db.collection('pointTransactions').doc(), {
        userId: ownerId, points: refundAmount, reason: `Refund: ${reward.name ?? 'reward'} (${result.code})`,
        addedBy: 'system', createdAt: FieldValue.serverTimestamp(),
      })
    })
    return { ok: false, status: 'rejected', code: result.code, message: result.message ?? null, product: result.product ?? null }
  }

  // Transient failures persisted — points remain reserved, status stays 'reserving'.
  throw new HttpsError('unavailable', 'The store system is busy. Please try again in a moment.')
}
```

- [ ] **Step 6: Refactor `redeemReward` to a thin owner-authorizing callable**

Replace the entire body of `functions/redeemReward.js` with:

```js
// ABOUTME: Customer callable to redeem one shelf item — authorizes the owner, then runs the
// ABOUTME: shared redeemCore against the caller's own redemption.
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { makeDispenser } from './dispense.js'
import { redeemCore } from './redeemCore.js'

const REWARDS_API_KEY = defineSecret('REWARDS_API_KEY')
const REWARDS_API_URL = 'https://dek-noi-dashboard.vercel.app/api/reward-redemptions'

if (getApps().length === 0) initializeApp()

export const redeemReward = onCall(
  { region: 'asia-southeast1', memory: '256MiB', timeoutSeconds: 60, secrets: [REWARDS_API_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in.')
    const uid = request.auth.uid
    const redemptionId = request.data?.redemptionId
    if (!redemptionId || typeof redemptionId !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing redemptionId.')
    }
    const db = getFirestore()
    const snap = await db.collection('redemptions').doc(redemptionId).get()
    if (!snap.exists) throw new HttpsError('not-found', 'Redemption not found.')
    if (snap.data().userId !== uid) throw new HttpsError('permission-denied', 'Not your redemption.')
    const dispense = makeDispenser(REWARDS_API_URL, REWARDS_API_KEY.value())
    return redeemCore({ db, redemptionId, dispense })
  },
)
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:rules -- redeemCore.test.js rewardApi.test.js`
Expected: PASS — all `redeemCore` money-path cases green; existing `rewardApi` tests still green.

- [ ] **Step 8: Commit**

```bash
git add functions/dispense.js functions/redeemCore.js functions/redeemReward.js test/redeemCore.test.js package.json package-lock.json
git commit -m "refactor: extract redeemCore shared engine + dispenser from redeemReward"
```

---

### Task 3: Admin-only `retryRedemption` callable + client wrapper

Expose the shared core to admins for stuck redemptions, gated on `role === 'admin'`, operating on the redemption owner's account.

**Files:**
- Create: `functions/retryRedemption.js`
- Modify: `functions/index.js` (add export)
- Modify: `src/lib/redeemReward.js` (add `retryRedemption` client wrapper)
- Create: `test/retryRedemption.auth.test.js`

**Interfaces:**
- Consumes: `redeemCore`, `makeDispenser`; admin signal `users/{uid}.role === 'admin'`.
- Produces:
  - Callable `retryRedemption({ redemptionId })` → same result shape as `redeemReward`.
  - Client `retryRedemption(redemptionId): Promise<{ ok, status, product?, code?, message? }>` in `src/lib/redeemReward.js`.

- [ ] **Step 1: Write the failing test (admin authorization)**

This test exercises the admin-gate logic the callable relies on, against the emulator. It calls a small exported `assertAdmin` guard so the rule is unit-checkable without invoking the full callable transport.

```js
// ABOUTME: Verifies the admin gate used by retryRedemption — only role:'admin' users pass.
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { assertAdmin } from '../functions/retryRedemption.js'

const PROJECT_ID = 'demo-dek-noi'
let app, db
async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' })
}
beforeAll(() => { app = initializeApp({ projectId: PROJECT_ID }); db = getFirestore() })
afterAll(async () => { await deleteApp(app) })
beforeEach(clearFirestore)

describe('assertAdmin', () => {
  test('passes for an admin user', async () => {
    await db.collection('users').doc('admin1').set({ role: 'admin' })
    await expect(assertAdmin(db, 'admin1')).resolves.toBeUndefined()
  })
  test('throws for a customer', async () => {
    await db.collection('users').doc('cust1').set({ role: 'customer' })
    await expect(assertAdmin(db, 'cust1')).rejects.toThrow(/[Aa]dmin/)
  })
  test('throws for a missing user', async () => {
    await expect(assertAdmin(db, 'ghost')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:rules -- retryRedemption.auth.test.js`
Expected: FAIL — cannot resolve `../functions/retryRedemption.js`.

- [ ] **Step 3: Write the callable + `assertAdmin`**

```js
// ABOUTME: Admin-only callable to re-drive a stuck redemption through the shared redeemCore,
// ABOUTME: operating on the redemption owner's account (not the admin caller's).
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { makeDispenser } from './dispense.js'
import { redeemCore } from './redeemCore.js'

const REWARDS_API_KEY = defineSecret('REWARDS_API_KEY')
const REWARDS_API_URL = 'https://dek-noi-dashboard.vercel.app/api/reward-redemptions'

if (getApps().length === 0) initializeApp()

// Throw permission-denied unless users/{uid}.role === 'admin' (the app's admin signal).
export async function assertAdmin(db, uid) {
  const snap = await db.collection('users').doc(uid).get()
  if (snap.data()?.role !== 'admin') throw new HttpsError('permission-denied', 'Admins only.')
}

export const retryRedemption = onCall(
  { region: 'asia-southeast1', memory: '256MiB', timeoutSeconds: 60, secrets: [REWARDS_API_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in.')
    const uid = request.auth.uid
    const redemptionId = request.data?.redemptionId
    if (!redemptionId || typeof redemptionId !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing redemptionId.')
    }
    const db = getFirestore()
    await assertAdmin(db, uid)
    const dispense = makeDispenser(REWARDS_API_URL, REWARDS_API_KEY.value())
    return redeemCore({ db, redemptionId, dispense })
  },
)
```

- [ ] **Step 4: Export from `functions/index.js`**

Add below the existing `redeemReward` export (line 65):

```js
export { retryRedemption } from './retryRedemption.js'
```

- [ ] **Step 5: Add the client wrapper**

Append to `src/lib/redeemReward.js`:

```js
// Admin-only: re-drives a stuck redemption server-side (points already held). Returns the
// same shape as redeemReward; transient failures reject the promise for the caller to catch.
export async function retryRedemption(redemptionId) {
  const call = httpsCallable(functions, 'retryRedemption')
  const { data } = await call({ redemptionId })
  return data
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:rules -- retryRedemption.auth.test.js redeemCore.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add functions/retryRedemption.js functions/index.js src/lib/redeemReward.js test/retryRedemption.auth.test.js
git commit -m "feat: admin-only retryRedemption callable for stuck redemptions"
```

---

### Task 4: Rebuild `Redemptions.jsx` — Needs attention + History tabs

Restructure the existing page (modify, do not rewrite from scratch): two tabs, remove the dead collected workflow, wire Refund/Reject/Retry and History search/filter/summary via the Task 1 helpers.

**Files:**
- Modify: `src/pages/admin/Redemptions.jsx`
- Uses: `src/lib/redemptions.js` (Task 1), `retryRedemption` from `src/lib/redeemReward.js` (Task 3)

**Interfaces:**
- Consumes: `isNeedsAttention`, `outcomeOf`, `matchesHistoryFilter`, `matchesSearch`, `summarize` from `src/lib/redemptions.js`; `retryRedemption(redemptionId)` from `src/lib/redeemReward.js`; existing `adjustPoints` from `src/lib/points.js`.
- Produces: the reworked admin Redemptions page (no new exports).

**Note on testing:** this repo has no React component-test harness; the page's logic lives in the Task 1 pure helpers (unit-tested) and the Task 2/3 core (emulator-tested). Verify this task with `npm run lint`, `npm run build`, and a manual click-through against the live/emulated app (steps below). This is the honest coverage boundary — see the plan's closing note.

- [ ] **Step 1: Replace status/tab scaffolding**

At the top of the component, replace the `STATUS_STYLE` map, the `counts`/`tab` state, and the `tabs` array with a two-tab model plus History controls. Set the two tabs and default to `attention`:

```jsx
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { adjustPoints } from '../../lib/points'
import { retryRedemption } from '../../lib/redeemReward'
import { isNeedsAttention, outcomeOf, matchesHistoryFilter, matchesSearch, summarize } from '../../lib/redemptions'
import { useAuth } from '../../context/AuthContext'
import { CheckCircle, XCircle, Clock, X, RefreshCw } from 'lucide-react'

const OUTCOME_STYLE = {
  completed: { bg: '#F0FFF4', color: '#16a34a', label: '✅ Completed' },
  rejected:  { bg: '#FFF0F0', color: '#CC0000', label: '❌ Rejected' },
  stuck:     { bg: '#FFF9E0', color: '#CC7700', label: '⏳ Stuck' },
  other:     { bg: '#F3F4F6', color: '#4b5563', label: '•' },
}
const HISTORY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'stuck', label: 'Stuck' },
]
```

Replace the component state block with:

```jsx
export default function AdminRedemptions() {
  const { user } = useAuth()
  const [tab, setTab] = useState('attention') // 'attention' | 'history'
  const [attentionItems, setAttentionItems] = useState([])
  const [historyItems, setHistoryItems] = useState([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectNote, setRejectNote] = useState('')
  const [working, setWorking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
```

- [ ] **Step 2: Replace data loading (two queries: attention + all)**

Replace `load`, `loadCounts`, and the `useEffect` with a single loader that fetches the two `reserving`/`pending` statuses for the attention tab and a recent slice for history:

```jsx
  const sortByRequestedDesc = (data) =>
    [...data].sort((a, b) => (b.requestedAt?.toMillis?.() || 0) - (a.requestedAt?.toMillis?.() || 0))

  const loadAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [reserving, pending, recent] = await Promise.all([
        getDocs(query(collection(db, 'redemptions'), where('status', '==', 'reserving'))),
        getDocs(query(collection(db, 'redemptions'), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'redemptions'), orderBy('requestedAt', 'desc'))),
      ])
      const map = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setAttentionItems(sortByRequestedDesc([...map(reserving), ...map(pending)]))
      setHistoryItems(map(recent))
    } catch (err) {
      console.error('Error loading redemptions:', err)
      setError(err.message || 'Failed to load redemptions')
      setAttentionItems([]); setHistoryItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll()
  }, [])
```

If the `orderBy('requestedAt', 'desc')` recent query throws for a missing index, keep the existing fallback pattern: wrap it in try/catch, refetch without `orderBy`, and rely on client sort. (Add the same try/catch shape used previously around the `recent` query.)

- [ ] **Step 3: Update actions — keep refund/reject, add retry, delete collected handlers**

Delete `markCollected` and `undoCollected` entirely. Change each surviving handler's `await load(tab); await loadCounts()` to `await loadAll()`. Add `retry`:

```jsx
  const refund = async (r) => {
    if (!confirm(`Refund ${r.reservedPoints || 0} points to ${r.userName} for the stuck "${r.rewardName}" request?`)) return
    setWorking(r.id)
    try {
      await adjustPoints(db, r.userId, r.reservedPoints || 0, 'Refund: stuck redemption', user.uid)
      await updateDoc(doc(db, 'redemptions', r.id), {
        status: 'rejected', failureCode: 'REFUNDED', failureMessage: 'Refunded a stuck redemption.',
        reviewedAt: serverTimestamp(), reviewedBy: user.uid,
      })
      await loadAll()
    } catch (err) {
      console.error('Error refunding redemption:', err)
      alert('Failed to refund redemption. Please try again.')
    } finally { setWorking(null) }
  }

  // Re-drive a stuck redemption through the server (points already held). On success it
  // completes; on a business rejection the server refunds; a transient failure leaves it stuck.
  const retry = async (r) => {
    setWorking(r.id)
    try {
      const res = await retryRedemption(r.id)
      if (res.ok) alert(`Completed: ${res.product?.name ?? r.rewardName}.`)
      else alert(`Closed as rejected: ${res.code}${res.message ? ` — ${res.message}` : ''}.`)
    } catch (err) {
      console.error('Error retrying redemption:', err)
      alert('Still stuck — the store system did not respond. Points remain held; try again or refund.')
    } finally {
      await loadAll()
      setWorking(null)
    }
  }
```

Update `confirmReject` to call `await loadAll()` instead of `load(tab)/loadCounts()`.

- [ ] **Step 4: Replace the render — two tabs, attention list, history list**

Replace the whole `return (...)` JSX. Header + tab switch:

```jsx
  const historyView = historyItems.filter((r) => matchesHistoryFilter(r, filter) && matchesSearch(r, search))
  const historySummary = summarize(historyView)

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-6xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-black text-gray-900 mb-1">Redemptions</h1>

      <div className="flex gap-2 mb-6">
        {[
          { key: 'attention', label: '⚠️ Needs attention', count: attentionItems.length },
          { key: 'history', label: '📜 History', count: null },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all"
            style={tab === t.key ? { background: '#CC0000', color: '#fff' } : { background: '#fff', color: '#666', border: '2px solid #e5e7eb' }}>
            {t.label}
            {t.count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-black"
                style={tab === t.key ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : { background: '#FFE600', color: '#CC0000' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 max-w-2xl">
          <p className="text-sm font-bold text-red-800">Error loading redemptions</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <Clock size={40} className="mx-auto mb-2 opacity-20 animate-spin" />
          <p>Loading...</p>
        </div>
      ) : tab === 'attention' ? (
        <AttentionList items={attentionItems} working={working} onRetry={retry} onRefund={refund} onReject={openReject} />
      ) : (
        <HistoryList items={historyView} summary={historySummary}
          filter={filter} setFilter={setFilter} search={search} setSearch={setSearch}
          working={working} onReject={openReject} />
      )}

      {/* Reject modal — unchanged from the existing implementation */}
      {rejectModal && ( /* keep the existing reject-modal JSX verbatim */ )}
    </div>
  )
}
```

- [ ] **Step 5: Add the two list subcomponents (same file, below the default export)**

Reuse the existing card markup. `AttentionList` shows severity + Retry/Refund/Reject; `HistoryList` shows filter chips + search + summary and a read-only card (Reject only if not terminal).

```jsx
function RedemptionCard({ r, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-3xl shrink-0">{r.rewardEmoji || '🎁'}</span>
          <div className="min-w-0">
            <p className="font-black text-gray-900">{r.rewardName}</p>
            <p className="text-sm font-semibold text-gray-700 truncate">{r.userName}</p>
            <p className="text-xs text-gray-400 truncate">{r.userEmail}</p>
            <p className="text-xs mt-1">
              <span className="font-black" style={{ color: '#CC0000' }}>⭐ {r.pointsCost} pts</span>
              <span className="text-gray-400"> · {r.requestedAt?.toDate?.()?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—'}</span>
            </p>
            {r.barcode && (
              <p className="text-xs mt-1 font-mono text-gray-600 break-all">🔖 {r.barcode}
                {r.maxValue != null && <span className="text-gray-400"> · max ฿{r.maxValue}</span>}</p>
            )}
            {r.product?.name && (
              <p className="text-xs mt-0.5 text-gray-600">📦 {r.product.name}{r.product.price != null && <span className="text-gray-400"> · ฿{r.product.price}</span>}</p>
            )}
            {r.status === 'rejected' && r.failureCode && (
              <p className="text-xs mt-0.5 font-bold" style={{ color: '#CC0000' }}>⚠ {r.failureCode}{r.failureMessage ? `: ${r.failureMessage}` : ''}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right flex flex-col items-end gap-2">{children}</div>
      </div>
    </div>
  )
}

function AttentionList({ items, working, onRetry, onRefund, onReject }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 max-w-2xl">
        <CheckCircle size={40} className="mx-auto mb-2 opacity-20" />
        <p>Nothing needs attention. 🎉</p>
      </div>
    )
  }
  return (
    <div className="space-y-3 max-w-2xl">
      {items.map((r) => {
        const held = r.status === 'reserving'
        return (
          <RedemptionCard key={r.id} r={r}>
            <span className="text-xs font-black px-3 py-1.5 rounded-full"
              style={held ? { background: '#FFF9E0', color: '#CC7700' } : { background: '#F3F4F6', color: '#4b5563' }}>
              {held ? '⏳ Stuck — points held' : '• Pending — no points moved'}
            </span>
            <button onClick={() => onRetry(r)} disabled={working === r.id}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black transition-colors disabled:opacity-50"
              style={{ background: '#EEF6FF', color: '#1d4ed8' }}>
              <RefreshCw size={15} /> Retry
            </button>
            {held && r.reservedPoints > 0 && (
              <button onClick={() => onRefund(r)} disabled={working === r.id}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black transition-colors disabled:opacity-50"
                style={{ background: '#FFF0F0', color: '#CC0000' }}>
                <XCircle size={15} /> Refund
              </button>
            )}
            <button onClick={() => onReject(r)} disabled={working === r.id}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black transition-colors disabled:opacity-50"
              style={{ background: '#FFF0F0', color: '#CC0000' }}>
              <XCircle size={15} /> Reject
            </button>
          </RedemptionCard>
        )
      })}
    </div>
  )
}

function HistoryList({ items, summary, filter, setFilter, search, setSearch, working, onReject }) {
  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {HISTORY_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-full text-xs font-black transition-all"
            style={filter === f.key ? { background: '#CC0000', color: '#fff' } : { background: '#fff', color: '#666', border: '2px solid #e5e7eb' }}>
            {f.label}
          </button>
        ))}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer or reward…"
          className="flex-1 min-w-40 border-2 border-gray-200 rounded-full px-4 py-1.5 text-sm focus:outline-none" />
      </div>
      <p className="text-xs text-gray-500 mb-3 font-semibold">
        {summary.count} redemption{summary.count === 1 ? '' : 's'} · ⭐ {summary.pointsRedeemed.toLocaleString()} pts redeemed
      </p>
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Clock size={40} className="mx-auto mb-2 opacity-20" />
          <p>No redemptions match.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
            const style = OUTCOME_STYLE[outcomeOf(r.status)]
            return (
              <RedemptionCard key={r.id} r={r}>
                <span className="text-xs font-black px-3 py-1.5 rounded-full" style={{ background: style.bg, color: style.color }}>{style.label}</span>
                {isNeedsAttention(r.status) && (
                  <button onClick={() => onReject(r)} disabled={working === r.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black transition-colors disabled:opacity-50"
                    style={{ background: '#FFF0F0', color: '#CC0000' }}>
                    <XCircle size={15} /> Reject
                  </button>
                )}
                {r.rejectNote && <p className="text-xs text-gray-400 mt-1 max-w-32">Note: {r.rejectNote}</p>}
              </RedemptionCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

Keep the existing reject-modal JSX (lines 289–322 of the original) verbatim inside the component's return.

- [ ] **Step 6: Lint and build**

Run: `npm run lint && npm run build`
Expected: no ESLint errors; production build succeeds.

- [ ] **Step 7: Manual click-through**

Start the app (`npm run dev`, sign in as an admin). Verify:
- The page is titled **Redemptions** with two tabs; there is no Pending/Approved/Collected/Stuck tab row and no "Mark collected"/"Undo" buttons anywhere.
- **Needs attention** lists any `reserving`/`pending` docs with a severity chip; Retry / Refund / Reject render and each triggers a reload.
- **History** filter chips (All/Completed/Rejected/Stuck) and search narrow the list; the summary line updates; `approved` and legacy `collected` both show "✅ Completed".

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/Redemptions.jsx
git commit -m "feat: reorg admin Redemptions into Needs attention + History tabs"
```

---

### Task 5: Retarget the admin Dashboard's redemption surfacing

Replace the stale "waiting for approval" banner and "Pending Requests" card with a "Needs attention" count (`reserving` + `pending`), and refresh the recent-list status labels.

**Files:**
- Modify: `src/pages/admin/Dashboard.jsx`
- Uses: `outcomeOf` from `src/lib/redemptions.js`

**Interfaces:**
- Consumes: `outcomeOf` from `src/lib/redemptions.js`.
- Produces: updated Dashboard (no new exports).

- [ ] **Step 1: Load a needs-attention count instead of pending-only**

Replace the `pending` query (Dashboard.jsx:18) and the `stats` shape so it counts `reserving` + `pending`:

```jsx
  const [stats, setStats] = useState({ customers: 0, rewards: 0, attention: 0, totalPoints: 0 })
```

In `load`, replace the single `pending` query with both statuses and sum them:

```jsx
      const [customers, rewards, reserving, pending, redemptions, transactions] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'customer'))),
        getDocs(query(collection(db, 'rewards'), where('available', '==', true))),
        getDocs(query(collection(db, 'redemptions'), where('status', '==', 'reserving'))),
        getDocs(query(collection(db, 'redemptions'), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'redemptions'), orderBy('requestedAt', 'desc'), limit(5))),
        getDocs(query(collection(db, 'pointTransactions'), orderBy('createdAt', 'desc'), limit(5))),
      ])
      setStats({
        customers: customers.size,
        rewards: rewards.size,
        attention: reserving.size + pending.size,
        totalPoints: customers.docs.reduce((a, d) => a + (d.data().points || 0), 0),
      })
```

- [ ] **Step 2: Retarget the banner + stat card copy**

Replace the "Pending Requests" stat card (line 38) with:

```jsx
    { label: 'Needs attention', value: stats.attention, icon: <ShoppingBag size={20} />, accent: stats.attention > 0 ? '#CC0000' : '#888', to: '/admin/redemptions' },
```

Replace the banner block (lines 54–69) with an attention banner:

```jsx
      {stats.attention > 0 && (
        <Link to="/admin/redemptions"
          className="flex items-center justify-between mb-6 p-4 rounded-2xl border-2"
          style={{ background: '#FFF9E0', borderColor: '#FFE600' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-black text-sm" style={{ color: '#CC7700' }}>
                {stats.attention} redemption{stats.attention > 1 ? 's' : ''} need{stats.attention > 1 ? '' : 's'} attention
              </p>
              <p className="text-xs text-gray-500">Tap to review stuck or unprocessed redemptions</p>
            </div>
          </div>
          <ChevronRight size={18} style={{ color: '#CC7700' }} />
        </Link>
      )}
```

- [ ] **Step 3: Refresh recent-redemption status labels**

Replace the local `statusStyle` map (lines 42–46) and its use so statuses render via shared outcomes. Add the import at top:

```jsx
import { outcomeOf } from '../../lib/redemptions'
```

Replace the map + lookup:

```jsx
  const outcomeStyle = {
    completed: { bg: '#F0FFF4', color: '#16a34a', label: '✅ Completed' },
    rejected:  { bg: '#FFF0F0', color: '#CC0000', label: '❌ Rejected' },
    stuck:     { bg: '#FFF9E0', color: '#CC7700', label: '⏳ Stuck' },
    other:     { bg: '#F3F4F6', color: '#4b5563', label: '•' },
  }
```

In the recent-redemptions list, replace `const s = statusStyle[r.status] ?? statusStyle.pending` with:

```jsx
                const s = outcomeStyle[outcomeOf(r.status)]
```

- [ ] **Step 4: Lint and build**

Run: `npm run lint && npm run build`
Expected: clean lint, successful build.

- [ ] **Step 5: Manual check**

As an admin on `/admin`: the banner (when any `reserving`/`pending` exist) reads "N redemptions need attention"; the stat card reads "Needs attention"; recent redemptions show Completed/Rejected/Stuck labels.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/Dashboard.jsx
git commit -m "feat: retarget admin Dashboard redemption surfacing to needs-attention"
```

---

## Self-Review

**Spec coverage:**
- §1 page shell/naming → Task 4 (title "Redemptions", two tabs). ✓
- §2 Needs attention (severity, Refund/Reject/Retry) → Task 4 `AttentionList` + Task 3 retry. ✓
- §3 History (filter/search/summary, completed incl. collected) → Task 1 helpers + Task 4 `HistoryList`. ✓
- §4 remove dead code (Collected tab, markCollected/undoCollected) → Task 4 Step 3. ✓
- §5 Dashboard fixes → Task 5. ✓
- §6 backend Retry via shared core (extract core keyed to owner, thin customer callable, new admin callable, client wrapper) → Tasks 2 & 3. ✓
- Testing plan (unit core, integration callables+admin gate, money-path e2e) → Tasks 1–3 tests; UI e2e boundary noted below. ✓

**Placeholder scan:** No TBD/TODO. The one "keep existing JSX verbatim" reference (reject modal) points to concrete lines 289–322 of the current file and is a deliberate reuse, not a placeholder.

**Type consistency:** Helper names (`isNeedsAttention`, `outcomeOf`, `matchesHistoryFilter`, `matchesSearch`, `summarize`) are identical across Tasks 1, 4, 5. `redeemCore({ db, redemptionId, dispense })` and `makeDispenser(apiUrl, apiKey)` signatures match across Tasks 2 and 3. `assertAdmin(db, uid)` matches between its definition and test.

## Testing boundary note (read before execution)

Automated coverage: **unit** (Task 1 pure helpers; existing `rewardApi` classifier), **integration** (Task 2 `redeemCore` money paths and Task 3 `assertAdmin` gate, both against the Firebase emulator), and the **redemption-lifecycle end-to-end** through the emulator (reserve → dispense → finalize/refund/retry, exercising the exact code both callables run). This repo has **no browser/component test harness**, so the two admin pages themselves are verified by lint + build + a scripted manual click-through (Task 4 Step 7, Task 5 Step 5) rather than an automated UI e2e. If you want a true UI e2e layer, that is a separate decision — adding `@testing-library/react` + jsdom (or Playwright) — and should be its own plan; flag it to the user rather than bolting it on here.
