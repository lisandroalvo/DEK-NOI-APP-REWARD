# Barcode Redemption — Phase 2 (automation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate redemption end-to-end — a callable Cloud Function validates the scanned barcode against the store's inventory API and, on success, deducts the customer's points atomically and marks the redemption done; the customer sees the real outcome instantly.

**Architecture:** The client keeps creating the `pending` redemption (Phase 1), then calls `redeemReward({ redemptionId })`. The function (Firebase Functions v2, `asia-southeast1`, Node 20, firebase-admin) is the trusted server: it re-derives authoritative `maxValue`/`pointsCost` from the reward, checks affordability, `POST`s to the inventory API (idempotencyKey = the redemption doc id) with bounded retry on transient codes, then on success deducts points once (idempotent) and sets status `approved`; on a business rejection it sets `rejected` with the reason; transient exhaustion leaves it `pending` and asks the client to retry.

**Tech Stack:** Firebase Functions v2 (`onCall`), `firebase-admin`, Node 20 global `fetch`; React 19 client via `httpsCallable`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-28-barcode-redemption-design.md`. API contract: `docs/api/reward-redemptions.md`. Read both.
- Endpoint: `https://dek-noi-dashboard.vercel.app/api/reward-redemptions`. Auth: `REWARDS_API_KEY` is in Firebase Secret Manager; bind via `defineSecret('REWARDS_API_KEY')` and `.value()` at call time. NEVER put the key or endpoint auth in the client bundle.
- idempotencyKey = the Firestore redemption doc id (`^[A-Za-z0-9]{20}$`). Retries reuse the SAME key; a different barcode is a NEW redemption. Never mutate a redemption's barcode.
- Retryable API codes: `IN_PROGRESS`, `UPSTREAM_ERROR`, `INTERNAL_ERROR` (retry same key). All other error codes are terminal (reject). Non-retryable codes replay verbatim on the API side.
- **Testing / no-mocks:** the pure API-code→action classifier is unit-tested with vitest (Task 1). The function's Firestore transaction + live HTTP call are NOT mocked — they are verified by `npm --prefix functions run` lint/parse + a **real integration call against the staging endpoint** (Task 2's manual step) and careful review. Client UI is verified by `npm run lint && npm run build` + manual in-app check. Do NOT add a mock layer or a React component-test stack.
- New source files start with two `// ABOUTME:` lines. Match existing style. Region `asia-southeast1` (matches `functions/index.js` + `src/lib/firebase.js`). Points still change ONLY server-side.
- Do NOT change the Phase 1 barcode-capture UI or `points.js`. Success status is the existing `approved` (reuse existing status displays); business failures are `rejected` + a new `failureCode`/`failureMessage`.

---

### Task 1: Pure result classifier + HTTP client (+ firebase-admin dep, + unit test)

**Files:**
- Create: `functions/rewardApi.js`
- Modify: `functions/package.json` (add `firebase-admin`)
- Test: `test/rewardApi.test.js`

**Interfaces:**
- Produces: `classifyRedemptionResult(status, body) → { action: 'complete'|'reject'|'retry', ... }` (pure); `postRewardRedemption(url, apiKey, payload) → Promise<{ status, body }>` (thin fetch, network failure ⇒ `{ status: 0, body: { ok:false, code:'INTERNAL_ERROR' } }`).

- [ ] **Step 1: Write the failing classifier test**

Create `test/rewardApi.test.js`:

```js
// ABOUTME: Unit tests for the pure reward-redemption API result classifier.
import { describe, test, expect } from 'vitest'
import { classifyRedemptionResult } from '../functions/rewardApi.js'

describe('classifyRedemptionResult', () => {
  test('200 ok -> complete with product', () => {
    expect(classifyRedemptionResult(200, { ok: true, replayed: false, product: { name: 'Coke', price: 15 } }))
      .toEqual({ action: 'complete', product: { name: 'Coke', price: 15 }, replayed: false })
  })
  test('200 ok replayed -> complete replayed:true', () => {
    const r = classifyRedemptionResult(200, { ok: true, replayed: true, product: { name: 'Coke' } })
    expect(r.action).toBe('complete'); expect(r.replayed).toBe(true)
  })
  test.each([['IN_PROGRESS', 409], ['UPSTREAM_ERROR', 502], ['INTERNAL_ERROR', 500]])('%s -> retry', (code, status) => {
    expect(classifyRedemptionResult(status, { ok: false, code }).action).toBe('retry')
  })
  test.each([['PRODUCT_NOT_FOUND', 404], ['OUT_OF_STOCK', 409], ['EXCEEDS_MAX_VALUE', 422], ['BAD_REQUEST', 400], ['UNAUTHORIZED', 401]])('%s -> reject', (code, status) => {
    const r = classifyRedemptionResult(status, { ok: false, code, message: 'x' })
    expect(r.action).toBe('reject'); expect(r.code).toBe(code)
  })
  test('business rejection carries product (OUT_OF_STOCK)', () => {
    const r = classifyRedemptionResult(409, { ok: false, code: 'OUT_OF_STOCK', product: { name: 'Coke', remainingQty: 0 } })
    expect(r.product).toEqual({ name: 'Coke', remainingQty: 0 })
  })
  test('missing code -> reject (never an infinite retry)', () => {
    expect(classifyRedemptionResult(418, { ok: false }).action).toBe('reject')
  })
})
```

- [ ] **Step 2: Run it — expect failure**

Run: `npx vitest run test/rewardApi.test.js`
Expected: FAIL — `functions/rewardApi.js` doesn't exist yet.

- [ ] **Step 3: Create `functions/rewardApi.js`**

```js
// ABOUTME: Pure result classifier + thin HTTP client for the POS reward-redemptions API.
// ABOUTME: classifyRedemptionResult maps an HTTP status+body to an action; it has no side effects.

// Only these codes are safe to retry with the same idempotency key (see docs/api/reward-redemptions.md).
const RETRYABLE_CODES = new Set(['IN_PROGRESS', 'UPSTREAM_ERROR', 'INTERNAL_ERROR'])

// Map the API's HTTP status + parsed JSON body to exactly one action:
//   { action: 'complete', product, replayed }         — item redeemed; deduct points
//   { action: 'reject',   code, message, product }     — business rejection; no points
//   { action: 'retry',    code, message }              — transient; retry with the same key
// A missing/unknown code is treated as 'reject' so a malformed response can never loop forever.
export function classifyRedemptionResult(status, body) {
  if (status === 200 && body && body.ok === true) {
    return { action: 'complete', product: body.product ?? null, replayed: body.replayed === true }
  }
  const code = (body && body.code) || null
  if (code && RETRYABLE_CODES.has(code)) {
    return { action: 'retry', code, message: (body && body.message) ?? null }
  }
  return { action: 'reject', code: code || 'UNKNOWN', message: (body && body.message) ?? null, product: (body && body.product) ?? null }
}

// POST one redemption to the API. Returns { status, body }. A network/fetch failure is
// surfaced as a synthetic INTERNAL_ERROR (status 0) so the caller's retry logic — which
// keys off the classified action — handles it uniformly with the same idempotency key.
export async function postRewardRedemption(url, apiKey, payload) {
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    return { status: 0, body: { ok: false, code: 'INTERNAL_ERROR', message: String(err?.message || err) } }
  }
  let body = null
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body }
}
```

- [ ] **Step 4: Add `firebase-admin` to `functions/package.json`**

Add to the `dependencies` object (keep alphabetical-ish with the existing entries):
```json
    "firebase-admin": "^12.6.0",
```
Then install it: `npm --prefix functions install`.

- [ ] **Step 5: Run the test — expect pass**

Run: `npx vitest run test/rewardApi.test.js`
Expected: PASS (all classifier cases green).

- [ ] **Step 6: Commit**

```bash
git add functions/rewardApi.js functions/package.json functions/package-lock.json test/rewardApi.test.js
git commit -m "feat: add reward-redemption API result classifier + http client"
```

---

### Task 2: The `redeemReward` callable

**Files:**
- Create: `functions/redeemReward.js`
- Modify: `functions/index.js` (export the new callable)

**Interfaces:**
- Consumes: `classifyRedemptionResult`, `postRewardRedemption` (Task 1).
- Produces: callable `redeemReward({ redemptionId })` → on success `{ ok: true, status: 'approved', product }`; on business rejection `{ ok: false, status: 'rejected', code, message, product }`; throws `HttpsError('unavailable', …)` when transient failures persist after retries.

- [ ] **Step 1: Create `functions/redeemReward.js`**

```js
// ABOUTME: Callable that redeems one shelf item — validates the barcode via the POS API,
// ABOUTME: then deducts the customer's points once (atomic) and marks the redemption done.
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { classifyRedemptionResult, postRewardRedemption } from './rewardApi.js'

const REWARDS_API_KEY = defineSecret('REWARDS_API_KEY')
const REWARDS_API_URL = 'https://dek-noi-dashboard.vercel.app/api/reward-redemptions'

// Bounded retry for transient API codes (IN_PROGRESS / UPSTREAM_ERROR / INTERNAL_ERROR),
// always with the same idempotency key. Backoff per attempt, within the 60s call budget.
const BACKOFF_MS = [0, 1000, 2000, 4000]

if (getApps().length === 0) initializeApp()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
    const redemptionRef = db.collection('redemptions').doc(redemptionId)
    const snap = await redemptionRef.get()
    if (!snap.exists) throw new HttpsError('not-found', 'Redemption not found.')
    const redemption = snap.data()
    if (redemption.userId !== uid) throw new HttpsError('permission-denied', 'Not your redemption.')

    // Idempotent short-circuit: already resolved -> return the stored outcome.
    if (redemption.status === 'approved') {
      return { ok: true, status: 'approved', product: redemption.product ?? null }
    }
    if (redemption.status === 'rejected') {
      return { ok: false, status: 'rejected', code: redemption.failureCode ?? 'REJECTED', message: redemption.failureMessage ?? null, product: redemption.product ?? null }
    }
    if (redemption.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Redemption is not processable.')
    }

    const barcode = String(redemption.barcode ?? '').trim()
    if (!barcode) throw new HttpsError('failed-precondition', 'Redemption has no barcode.')

    // Authoritative reward values — never trust the client-written snapshot on the doc.
    const rewardSnap = await db.collection('rewards').doc(redemption.rewardId).get()
    if (!rewardSnap.exists) throw new HttpsError('failed-precondition', 'Reward no longer exists.')
    const reward = rewardSnap.data()
    const pointsCost = reward.pointsCost
    const maxValue = reward.maxValue
    if (!(pointsCost > 0) || !(maxValue > 0)) throw new HttpsError('failed-precondition', 'Reward is misconfigured.')

    // Affordability (authoritative). If short, reject without calling the API.
    const userRef = db.collection('users').doc(uid)
    const balance = (await userRef.get()).data()?.points ?? 0
    if (balance < pointsCost) {
      await redemptionRef.update({
        status: 'rejected', failureCode: 'INSUFFICIENT_POINTS', failureMessage: 'Not enough points.',
        reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system',
      })
      return { ok: false, status: 'rejected', code: 'INSUFFICIENT_POINTS', message: 'Not enough points.', product: null }
    }

    const payload = {
      idempotencyKey: redemptionId,
      barcode,
      maxValue,
      reward: { id: redemption.rewardId, name: reward.name },
      customer: { id: uid, name: redemption.userName ?? '' },
      requestedAt: new Date().toISOString(),
    }

    // Call the API, retrying transient codes with the same key.
    let result = null
    for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
      if (attempt > 0) await sleep(BACKOFF_MS[attempt])
      const { status, body } = await postRewardRedemption(REWARDS_API_URL, REWARDS_API_KEY.value(), payload)
      result = classifyRedemptionResult(status, body)
      if (result.action !== 'retry') break
    }

    if (result.action === 'complete') {
      const product = result.product ?? null
      // Deduct points exactly once, atomically. A replay/retry sees status 'approved' and no-ops.
      await db.runTransaction(async (tx) => {
        const rSnap = await tx.get(redemptionRef)
        if (rSnap.data()?.status === 'approved') return
        const current = (await tx.get(userRef)).data()?.points ?? 0
        tx.update(userRef, { points: Math.max(0, current - pointsCost) })
        tx.update(redemptionRef, {
          status: 'approved', product, reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system',
        })
        tx.set(db.collection('pointTransactions').doc(), {
          userId: uid, points: -pointsCost, reason: `Redeemed: ${reward.name}`,
          addedBy: 'system', createdAt: FieldValue.serverTimestamp(),
        })
      })
      return { ok: true, status: 'approved', product }
    }

    if (result.action === 'reject') {
      await redemptionRef.update({
        status: 'rejected', failureCode: result.code, failureMessage: result.message ?? null,
        product: result.product ?? null, reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system',
      })
      return { ok: false, status: 'rejected', code: result.code, message: result.message ?? null, product: result.product ?? null }
    }

    // Transient failures persisted — leave the redemption 'pending' (the API auto-reclaims
    // a stuck key after 5 min) and tell the client to try again.
    throw new HttpsError('unavailable', 'The store system is busy. Please try again in a moment.')
  },
)
```

- [ ] **Step 2: Export it from `functions/index.js`**

Add at the end of `functions/index.js`:
```js
export { redeemReward } from './redeemReward.js'
```

- [ ] **Step 3: Verify the functions build/parse + lint the repo**

Run: `node --check functions/redeemReward.js && node --check functions/index.js`
Expected: no syntax errors.
Run: `npm run lint`
Expected: PASS (eslint covers the repo).

- [ ] **Step 4: Manual integration verification (no mocks) — report the outcome**

Deploy the function (or run the Functions emulator with the secret available), then trigger a real redemption from a signed-in test customer against the **staging** inventory endpoint. Confirm from logs/Firestore:
- a valid in-stock barcode within `maxValue` → API `ok`, the user's `points` drop by exactly `pointsCost` once, redemption `status: 'approved'` with `product`, and a `pointTransactions` entry;
- calling again for the same `redemptionId` does NOT deduct a second time (idempotent);
- an over-value barcode → `status: 'rejected'`, `failureCode: 'EXCEEDS_MAX_VALUE'`, no points moved.
Record exactly what was run and observed in the report. If you cannot deploy in this environment, say so explicitly and leave this for the controller/user — do NOT fake it or add a mock.

- [ ] **Step 5: Commit**

```bash
git add functions/redeemReward.js functions/index.js
git commit -m "feat: add redeemReward callable (validate via inventory API, deduct points once)"
```

---

### Task 3: Client — call the function and show the real outcome

**Files:**
- Create: `src/lib/redeemReward.js`
- Modify: `src/pages/customer/Rewards.jsx`

**Interfaces:**
- Consumes: the `redeemReward` callable (Task 2).
- Produces: `redeemReward(redemptionId) → Promise<{ ok, status, product?, code?, message? }>` (throws on transient/unavailable).

- [ ] **Step 1: Create `src/lib/redeemReward.js`**

```js
// ABOUTME: Client helper to redeem a reward via the redeemReward Cloud Function.
// ABOUTME: Returns the function's result object; throws (transient/unavailable) for the UI to catch.
import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

// Processes an already-created pending redemption. Returns
// { ok, status, product?, code?, message? }. Business rejections come back as
// ok:false data; transient failures (function threw) reject this promise.
export async function redeemReward(redemptionId) {
  const call = httpsCallable(functions, 'redeemReward')
  const { data } = await call({ redemptionId })
  return data
}
```

- [ ] **Step 2: Import the helper + add result state in `Rewards.jsx`**

Add the import near the top:
```jsx
import { redeemReward as callRedeemReward } from '../../lib/redeemReward'
```
Add state next to the others:
```jsx
  const [result, setResult] = useState(null) // { ok, product?, code?, message?, retry?, reward }
```

- [ ] **Step 3: Rewrite `redeem` to create the pending doc, then call the function**

Replace the `redeem` function body with:
```jsx
  const CODE_MESSAGES = {
    OUT_OF_STOCK: 'That item is out of stock right now.',
    EXCEEDS_MAX_VALUE: "That item costs more than this reward allows. Please pick a lower-priced item.",
    PRODUCT_NOT_FOUND: "We couldn't find that barcode. Please scan again.",
    INSUFFICIENT_POINTS: "You don't have enough points for this reward.",
    BAD_REQUEST: 'That barcode looks invalid. Please scan again.',
  }

  const redeem = async (reward, barcode) => {
    setRedeeming(reward.id)
    setScanFor(null)
    try {
      const ref = await addDoc(collection(db, 'redemptions'), {
        userId: user.uid,
        userName: profile.name,
        userEmail: profile.email,
        rewardId: reward.id,
        rewardName: reward.name,
        rewardEmoji: reward.emoji || '🎁',
        pointsCost: reward.pointsCost,
        maxValue: reward.maxValue ?? null,
        barcode,
        status: 'pending',
        requestedAt: serverTimestamp(),
      })
      const res = await callRedeemReward(ref.id)
      if (res?.ok) {
        setResult({ ok: true, product: res.product ?? null, reward })
      } else {
        setResult({ ok: false, code: res?.code, message: CODE_MESSAGES[res?.code] || res?.message || 'This redemption could not be completed.', reward })
      }
    } catch {
      // Transient / unavailable — the redemption stays pending; the customer can retry.
      setResult({ ok: false, retry: true, message: 'The store system is busy. Please try again in a moment.', reward })
    } finally {
      setRedeeming(null)
    }
  }
```

- [ ] **Step 4: Render the result modal**

Just before the `{scanFor && (…)}` block near the end of the page, add:
```jsx
      {/* Redemption result */}
      {result && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setResult(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl mb-3">{result.ok ? '🎉' : result.retry ? '⏳' : '😕'}</div>
            <h2 className="text-xl font-black text-gray-900 mb-1">
              {result.ok ? 'Enjoy your reward!' : result.retry ? 'Almost there' : "Couldn't redeem"}
            </h2>
            {result.ok ? (
              <p className="text-sm text-gray-600 mb-5">
                Grab your <strong>{result.product?.name || result.reward.name}</strong>. {result.reward.pointsCost.toLocaleString()} points were used.
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-5">{result.message}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setResult(null)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600">Close</button>
              {!result.ok && (
                <button onClick={() => { const r = result.reward; setResult(null); setScanFor(r) }}
                  className="flex-1 py-3 rounded-xl text-sm font-black text-white" style={{ background: '#CC0000' }}>
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 6: Manual check**

`npm run dev` (with the function deployed/emulated): redeem a reward → scan a valid barcode → success modal shows the product and the balance drops; scan an over-value/out-of-stock barcode → the correct reason + Try again; kill the function to simulate transient → "store system is busy". Confirm no duplicate `redemptions` on retry.

- [ ] **Step 7: Commit**

```bash
git add src/lib/redeemReward.js src/pages/customer/Rewards.jsx
git commit -m "feat: call redeemReward and show the real redemption outcome"
```

---

### Task 4: Harden the redemption create rule (+ rules test)

**Files:**
- Modify: `firestore.rules`
- Test: `test/firestore.rules.test.js`

**Interfaces:**
- Consumes/Produces: nothing in code; tightens who can create a redemption.

- [ ] **Step 1: Add a failing rules test**

In `test/firestore.rules.test.js`, inside the redemptions describe block (or add one modeled on the existing ones), add:

```js
  test('a customer can create a pending redemption for themselves', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertSucceeds(setDoc(doc(db, 'redemptions', 'rdmA'), {
      userId: ALICE, rewardId: 'r1', rewardName: 'Soft Drink', pointsCost: 70, barcode: '885', status: 'pending',
    }))
  })

  test('a customer cannot create a redemption that is already approved', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(setDoc(doc(db, 'redemptions', 'rdmB'), {
      userId: ALICE, rewardId: 'r1', rewardName: 'Soft Drink', pointsCost: 70, barcode: '885', status: 'approved',
    }))
  })
```

Ensure the file imports `assertSucceeds, assertFails` from `@firebase/rules-unit-testing` and `setDoc, doc` from `firebase/firestore` (add to existing imports if missing). Use the same `ALICE`/`testEnv` setup the file already establishes.

- [ ] **Step 2: Run — expect the second test to fail**

Run: `npm run test:rules`
Expected: the "already approved" test FAILS (current rule allows any status).

- [ ] **Step 3: Tighten the create rule**

In `firestore.rules`, replace the redemptions `create` rule:
```
      allow create: if request.auth != null && 
                       request.resource.data.userId == request.auth.uid;
```
with:
```
      allow create: if request.auth != null
                       && request.resource.data.userId == request.auth.uid
                       && request.resource.data.status == 'pending';
```

- [ ] **Step 4: Run — expect pass**

Run: `npm run test:rules`
Expected: PASS (customer can create `pending`, cannot create `approved`; the rest of the suite stays green).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules test/firestore.rules.test.js
git commit -m "feat: restrict customer redemption creation to status pending"
```

---

### Task 5: Surface the product + rejection reason to admin and customer

**Files:**
- Modify: `src/pages/admin/Redemptions.jsx`
- Modify: `src/pages/customer/history/RewardsTab.jsx`

**Interfaces:**
- Consumes: redemption docs now carry `product` (on success) and `failureCode`/`failureMessage` (on rejection).

- [ ] **Step 1: Admin — show product + failure reason**

In `src/pages/admin/Redemptions.jsx`, inside the redemption card info block, after the existing barcode `<p>` (added in Phase 1), add:
```jsx
                  {r.product?.name && (
                    <p className="text-xs mt-0.5 text-gray-600">📦 {r.product.name}{r.product.price != null && <span className="text-gray-400"> · ฿{r.product.price}</span>}</p>
                  )}
                  {r.status === 'rejected' && r.failureCode && (
                    <p className="text-xs mt-0.5 font-bold" style={{ color: '#CC0000' }}>⚠ {r.failureCode}{r.failureMessage ? `: ${r.failureMessage}` : ''}</p>
                  )}
```

- [ ] **Step 2: Customer — show product on a completed redemption**

In `src/pages/customer/history/RewardsTab.jsx` `RedemptionCard`, after the barcode `<p>` (Phase 1), add:
```jsx
            {r.product?.name && (
              <p className="text-[11px] text-gray-500 mt-0.5">📦 {r.product.name}</p>
            )}
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual check**

`npm run dev`: an approved redemption shows its product to both admin and customer; a rejected one shows its `failureCode` to the admin.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/Redemptions.jsx src/pages/customer/history/RewardsTab.jsx
git commit -m "feat: show redeemed product and rejection reason in redemption views"
```

---

## Self-Review

**Spec coverage:**
- Callable validates via inventory API + deducts points once (idempotent) → Task 2. ✓
- API-code→action mapping, retryable vs terminal → Task 1 (tested). ✓
- idempotencyKey = redemption doc id; retries reuse key; bounded retry on transient → Task 2. ✓
- Authoritative maxValue/pointsCost re-derived server-side → Task 2. ✓
- Secret via `defineSecret`, endpoint constant, never in client → Task 2 + Global Constraints. ✓
- Client calls function + shows real outcome (success/reason/retry) → Task 3. ✓
- Harden client create to `pending` → Task 4 (tested). ✓
- Admin/customer surface product + rejection reason → Task 5. ✓
- Success status reuses existing `approved` display; no `points.js` change → Global Constraints. ✓

**Placeholder scan:** All code complete; the only non-automated step (Task 2 Step 4) is an explicit, honest real-integration verification with a "don't fake it / don't mock" instruction — not a placeholder.

**Type/name consistency:** `classifyRedemptionResult`/`postRewardRedemption` produced in Task 1, consumed in Task 2; callable name `redeemReward` exported (Task 2) and invoked by the same name (Task 3); `redeemReward(redemptionId)` client helper aliased `callRedeemReward` in Rewards.jsx to avoid shadowing; redemption fields `status`/`product`/`failureCode`/`failureMessage`/`barcode`/`maxValue` written in Task 2 and read in Task 5.
