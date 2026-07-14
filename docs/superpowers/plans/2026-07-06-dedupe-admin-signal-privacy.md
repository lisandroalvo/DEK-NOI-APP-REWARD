# Pre-Launch Safety Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add duplicate-receipt detection, an admin pending-bill signal, and a PDPA privacy policy + consent gate to the DEK NOI rewards PWA before launch.

**Architecture:** Dedup uses a client-computed SHA-256 `imageHash` stored on each bill: a same-account submit-time guard, an atomic cross-account hard-block via a `receiptHashes/{hash}` lock doc inside the existing `approveBill` transaction, and an in-memory admin soft-flag. The admin signal is a live `onSnapshot` count rendered as a nav badge. Privacy is a public bilingual page plus a required consent checkbox recorded on the user profile.

**Tech Stack:** React 19, Vite, Firebase (Firestore, Auth, Storage), react-router-dom 7, vitest + `@firebase/rules-unit-testing` (emulator).

## Global Constraints

- All new code files start with two `// ABOUTME: ` comment lines.
- Match surrounding file style (no semicolons are used in JSX files here; keep 2-space indent).
- TDD: write the failing test first where a test is possible (pure helpers, `points.js`, rules). UI-only wiring is verified by `npm run build` + manual check.
- Full test suite runs in the emulator: `npm run test:rules`. Pure (non-Firebase) tests can run standalone with `npx vitest run <file>`.
- Earning rate constant is `BAHT_PER_POINT = 50` (do not change).
- Customer-legal-facing copy is bilingual (Thai + English); admin-facing copy stays English.
- Data controller name in the privacy policy: **Dek Noi (เด็กน้อย)**. Support contact: LINE **@167fnbxs**.
- Never delete bills. Bills without an `imageHash` (legacy) must keep working — the dedup lock only applies when `imageHash` is present.

---

## File Structure

**Create:**
- `src/lib/billDedup.js` — pure helpers: `hashImageBytes`, `hashImageFile`, `duplicateFlagsFor`.
- `test/billDedup.test.js` — unit tests for the pure helpers.
- `src/hooks/usePendingBillCount.js` — admin-only live count of pending bills.
- `src/lib/privacy.js` — `PRIVACY_POLICY_VERSION` constant.
- `src/pages/Privacy.jsx` — public bilingual privacy policy page.

**Modify:**
- `src/lib/points.js` — add the `receiptHashes` lock to `approveBill`.
- `firestore.rules` — add the `receiptHashes` match block.
- `firestore.indexes.json` — add `billSubmissions (userId, imageHash)`.
- `test/points.test.js` — dedup approval tests.
- `test/firestore.rules.test.js` — `receiptHashes` + consent-field rules tests.
- `src/pages/customer/ScanBill.jsx` — compute `imageHash`, same-account guard, store the field.
- `src/pages/admin/BillReview.jsx` — soft-flag badge + `DUPLICATE_RECEIPT` handling.
- `src/components/Layout.jsx` — pending-count badge on the Bill Review nav item.
- `src/pages/Register.jsx` — consent checkbox gate.
- `src/context/AuthContext.jsx` — record consent fields in `register()`.
- `src/App.jsx` — public `/privacy` route.

---

## Task 1: Pure dedup helpers (`billDedup.js`)

**Files:**
- Create: `src/lib/billDedup.js`
- Test: `test/billDedup.test.js`

**Interfaces:**
- Produces:
  - `hashImageBytes(arrayBuffer: ArrayBuffer): Promise<string>` — lowercase hex SHA-256.
  - `hashImageFile(file: File|Blob): Promise<string>` — wrapper over `hashImageBytes`.
  - `duplicateFlagsFor(bill, allBills): { exactImage: boolean, sameAmountDay: boolean }`.

- [ ] **Step 1: Write the failing test**

Create `test/billDedup.test.js`:

```js
// ABOUTME: Unit tests for the pure duplicate-receipt helpers (hashing + soft-flags).
// ABOUTME: No Firebase/emulator needed — runs under plain vitest.
import { describe, test, expect } from 'vitest'
import { hashImageBytes, duplicateFlagsFor } from '../src/lib/billDedup.js'

const ts = (isoDate) => ({ toDate: () => new Date(isoDate) })

describe('hashImageBytes', () => {
  test('same bytes hash to the same hex string', async () => {
    const a = new TextEncoder().encode('hello').buffer
    const b = new TextEncoder().encode('hello').buffer
    expect(await hashImageBytes(a)).toBe(await hashImageBytes(b))
  })
  test('different bytes hash differently', async () => {
    const a = new TextEncoder().encode('hello').buffer
    const b = new TextEncoder().encode('world').buffer
    expect(await hashImageBytes(a)).not.toBe(await hashImageBytes(b))
  })
})

describe('duplicateFlagsFor', () => {
  const bills = [
    { id: '1', imageHash: 'aaa', amount: 50, submittedAt: ts('2026-07-06T10:00:00') },
    { id: '2', imageHash: 'aaa', amount: 99, submittedAt: ts('2026-07-01T10:00:00') },
    { id: '3', imageHash: 'bbb', amount: 50, submittedAt: ts('2026-07-06T18:00:00') },
  ]
  test('flags an exact image match on another bill', () => {
    expect(duplicateFlagsFor(bills[0], bills).exactImage).toBe(true)
  })
  test('flags same amount and same calendar day', () => {
    expect(duplicateFlagsFor(bills[0], bills).sameAmountDay).toBe(true)
  })
  test('no flags when nothing matches', () => {
    const lone = { id: '9', imageHash: 'zzz', amount: 12, submittedAt: ts('2026-07-06T10:00:00') }
    const f = duplicateFlagsFor(lone, [...bills, lone])
    expect(f.exactImage).toBe(false)
    expect(f.sameAmountDay).toBe(false)
  })
  test('never flags a bill against itself', () => {
    const f = duplicateFlagsFor(bills[1], [bills[1]])
    expect(f.exactImage).toBe(false)
    expect(f.sameAmountDay).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/billDedup.test.js`
Expected: FAIL — cannot resolve `../src/lib/billDedup.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/billDedup.js`:

```js
// ABOUTME: Pure helpers for duplicate-receipt detection: image hashing and admin soft-flags.
// ABOUTME: No Firebase imports so they can be unit-tested without the emulator.

// SHA-256 of raw image bytes, returned as a lowercase hex string. Used as a stable
// fingerprint so the same image file is recognized across submissions and accounts.
export async function hashImageBytes(arrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Convenience wrapper for a File/Blob selected in the browser.
export async function hashImageFile(file) {
  return hashImageBytes(await file.arrayBuffer())
}

// Given one bill and the full list of bills, decide which non-blocking duplicate
// warnings apply. Never considers the bill itself. exactImage is a strong signal;
// sameAmountDay is a weak heuristic (two real same-price buys on one day trip it).
export function duplicateFlagsFor(bill, allBills) {
  const others = allBills.filter(b => b.id !== bill.id)
  const exactImage = !!bill.imageHash && others.some(b => b.imageHash === bill.imageHash)
  const sameAmountDay = bill.amount != null && others.some(b =>
    b.amount === bill.amount && sameCalendarDay(b.submittedAt, bill.submittedAt))
  return { exactImage, sameAmountDay }
}

// Firestore Timestamps (anything with toDate()) → true when both fall on the same
// local calendar day. A missing/unparseable value never matches.
function sameCalendarDay(a, b) {
  const da = a?.toDate?.()
  const db = b?.toDate?.()
  if (!da || !db) return false
  return da.getFullYear() === db.getFullYear() &&
         da.getMonth() === db.getMonth() &&
         da.getDate() === db.getDate()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/billDedup.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/billDedup.js test/billDedup.test.js
git commit -m "feat: pure helpers for receipt hashing and duplicate soft-flags"
```

---

## Task 2: Approval-time hard block + `receiptHashes` rules

**Files:**
- Modify: `src/lib/points.js` (`approveBill`, lines 92-140)
- Modify: `firestore.rules` (add match block before the closing braces at lines 79-81)
- Test: `test/points.test.js`, `test/firestore.rules.test.js`

**Interfaces:**
- Consumes: bills may carry `imageHash: string` (from Task 3; may be absent on legacy bills).
- Produces: `approveBill` throws `Error('DUPLICATE_RECEIPT')` when another bill already claimed the same `imageHash`; writes a `receiptHashes/{imageHash}` doc `{ billId, userId, createdAt }` on success.

- [ ] **Step 1: Write the failing tests**

Add to `test/points.test.js` (new `describe` block, after the existing `approveBill` tests). It reuses the file's existing `testEnv`, `ALICE`, `ADMIN`, `adminDb()`, and `points()` helpers:

```js
describe('approveBill duplicate-receipt guard', () => {
  async function seedBill(id, { imageHash = null, status = 'pending' } = {}) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'billSubmissions', id), {
        userId: ALICE, status, amount: 100, pointsAwarded: 0, imageHash,
      })
    })
  }

  async function lockCount() {
    let n = 0
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await getDocs(collection(ctx.firestore(), 'receiptHashes'))
      n = snap.size
    })
    return n
  }

  test('rejects a second bill that shares an image hash and awards no points', async () => {
    await seedBill('b1', { imageHash: 'hash-xyz' })
    await seedBill('b2', { imageHash: 'hash-xyz' })
    await approveBill(adminDb(), { id: 'b1', userId: ALICE, imageHash: 'hash-xyz' }, 100, '', ADMIN)
    const afterFirst = await points(ALICE)
    await expect(
      approveBill(adminDb(), { id: 'b2', userId: ALICE, imageHash: 'hash-xyz' }, 100, '', ADMIN)
    ).rejects.toThrow('DUPLICATE_RECEIPT')
    expect(await points(ALICE)).toBe(afterFirst)
  })

  test('allows two bills with different image hashes', async () => {
    await seedBill('b1', { imageHash: 'hash-a' })
    await seedBill('b2', { imageHash: 'hash-b' })
    await approveBill(adminDb(), { id: 'b1', userId: ALICE, imageHash: 'hash-a' }, 100, '', ADMIN)
    await approveBill(adminDb(), { id: 'b2', userId: ALICE, imageHash: 'hash-b' }, 100, '', ADMIN)
    expect(await lockCount()).toBe(2)
  })

  test('a bill with no image hash approves and writes no lock', async () => {
    await seedBill('b1', { imageHash: null })
    await approveBill(adminDb(), { id: 'b1', userId: ALICE, imageHash: null }, 100, '', ADMIN)
    expect(await lockCount()).toBe(0)
  })
})
```

Add to `test/firestore.rules.test.js` (new `describe`, reusing `testEnv`, `ALICE`, `ADMIN`):

```js
describe('receiptHashes lock collection', () => {
  test('an admin may create and read a lock doc', async () => {
    const db = testEnv.authenticatedContext(ADMIN).firestore()
    await assertSucceeds(setDoc(doc(db, 'receiptHashes', 'h1'), { billId: 'b1', userId: ALICE }))
    await assertSucceeds(getDoc(doc(db, 'receiptHashes', 'h1')))
  })

  test('a customer may neither read nor write a lock doc', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'receiptHashes', 'h1'), { billId: 'b1', userId: ALICE })
    })
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(getDoc(doc(db, 'receiptHashes', 'h1')))
    await assertFails(setDoc(doc(db, 'receiptHashes', 'h2'), { billId: 'b2', userId: ALICE }))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:rules`
Expected: FAIL — the second same-hash approval currently succeeds (no `DUPLICATE_RECEIPT`), and the customer `receiptHashes` writes currently succeed (no rule yet).

- [ ] **Step 3: Add the `receiptHashes` rule**

In `firestore.rules`, add this block immediately after the `pointTransactions` block (after line 79, before the two closing braces):

```
    // Receipt-image dedup locks: one doc per approved receipt hash, written by the
    // admin approval transaction. Customers never touch this collection.
    match /receiptHashes/{hash} {
      allow read, write: if isAdmin();
    }
```

- [ ] **Step 4: Add the lock to `approveBill`**

In `src/lib/points.js`, replace the body of `approveBill` (lines 92-140) with:

```js
export async function approveBill(db, bill, amount, notes, adminUid) {
  if (!(amount > 0)) throw new Error('INVALID_AMOUNT')
  const amt = toSatang(amount)

  await runTransaction(db, async (tx) => {
    const userRef = doc(db, 'users', bill.userId)
    const billRef = doc(db, 'billSubmissions', bill.id)
    // A receipt image can be turned into points exactly once. The lock doc is keyed
    // by the image hash; if a different bill already claimed it, refuse this approval.
    // Legacy bills without an imageHash skip the lock entirely.
    const lockRef = bill.imageHash ? doc(db, 'receiptHashes', bill.imageHash) : null

    // Re-read the bill inside the transaction so a stale list or a double-click
    // can't approve (and award points for) the same bill twice.
    const billSnap = await tx.get(billRef)
    if (!billSnap.exists()) throw new Error('Bill not found')
    if (billSnap.data().status !== 'pending') throw new Error('ALREADY_REVIEWED')

    const lockSnap = lockRef ? await tx.get(lockRef) : null
    if (lockSnap?.exists() && lockSnap.data().billId !== bill.id) throw new Error('DUPLICATE_RECEIPT')

    const userSnap = await tx.get(userRef)
    if (!userSnap.exists()) throw new Error('User not found')

    const data = userSnap.data()
    const currentPoints = data.points || 0
    const carryBefore = data.spendCarry || 0
    const totalSpentBefore = data.totalSpent || 0

    const pool = carryBefore + amt
    const earned = Math.floor(pool / BAHT_PER_POINT)
    const carry = toSatang(pool % BAHT_PER_POINT)

    tx.update(billRef, {
      status: 'approved',
      amount: amt,
      pointsAwarded: earned,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
      notes: notes || '',
    })
    tx.update(userRef, {
      points: currentPoints + earned,
      spendCarry: carry,
      totalSpent: toSatang(totalSpentBefore + amt),
    })
    tx.set(doc(collection(db, 'pointTransactions')), {
      userId: bill.userId,
      points: earned,
      amount: amt,
      reason: 'Bill approved',
      addedBy: adminUid,
      createdAt: serverTimestamp(),
    })
    if (lockRef) tx.set(lockRef, { billId: bill.id, userId: bill.userId, createdAt: serverTimestamp() })
  })
}
```

(All `tx.get` reads stay before any `tx.update`/`tx.set` — Firestore requires reads-before-writes.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:rules`
Expected: PASS — all prior tests plus the 3 new dedup tests and 2 new rules tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/points.js firestore.rules test/points.test.js test/firestore.rules.test.js
git commit -m "feat: hard-block duplicate receipts in approveBill via receiptHashes lock"
```

---

## Task 3: Submit-time hash + same-account guard (`ScanBill.jsx`)

**Files:**
- Modify: `src/pages/customer/ScanBill.jsx`
- Modify: `firestore.indexes.json`

**Interfaces:**
- Consumes: `hashImageFile` from `src/lib/billDedup.js` (Task 1).
- Produces: every new `billSubmissions` doc carries `imageHash: string`.

- [ ] **Step 1: Add the composite index**

In `firestore.indexes.json`, add this object to the `indexes` array (after the existing `billSubmissions (userId, submittedAt)` entry, before the redemptions entries):

```json
    {
      "collectionGroup": "billSubmissions",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "userId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "imageHash",
          "order": "ASCENDING"
        }
      ]
    },
```

- [ ] **Step 2: Update imports in `ScanBill.jsx`**

Replace line 7:

```js
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
```

with:

```js
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore'
```

And add after line 5 (`import { recognizeReceiptTotal } ...`):

```js
import { hashImageFile } from '../../lib/billDedup'
```

- [ ] **Step 3: Add the hash + guard in `handleUpload`**

In `src/pages/customer/ScanBill.jsx`, inside `handleUpload`, replace the block that starts at `setUploading(true)` (line 60) down to the `uploadImageFile` call, so it reads:

```js
    setUploading(true)
    setError('')

    try {
      // Fingerprint the image so the same receipt can't be turned into points twice.
      const imageHash = await hashImageFile(selectedFile)

      // Block re-submitting a receipt the customer already has pending or approved.
      // A previously rejected one is allowed through so a mistaken rejection can be fixed.
      const dupSnap = await getDocs(query(
        collection(db, 'billSubmissions'),
        where('userId', '==', user.uid),
        where('imageHash', '==', imageHash),
      ))
      const alreadyActive = dupSnap.docs.some(d => ['pending', 'approved'].includes(d.data().status))
      if (alreadyActive) {
        setError('คุณส่งใบเสร็จนี้ไปแล้ว / You have already submitted this receipt.')
        setUploading(false)
        return
      }

      // Upload the receipt to Storage; Firestore keeps only the download URL.
      // Bills are kept permanently so customers always see their history.
      const imageUrl = await uploadImageFile(storage, selectedFile, `bills/${user.uid}`)
```

- [ ] **Step 4: Store `imageHash` on the bill doc**

In the same `try`, add `imageHash` to the `addDoc` payload. Change the `imageUrl,` line inside the `addDoc(collection(db, 'billSubmissions'), { ... })` object to:

```js
        imageUrl,
        imageHash,
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build completes (only the known chunk-size warning).

- [ ] **Step 6: Commit**

```bash
git add src/pages/customer/ScanBill.jsx firestore.indexes.json
git commit -m "feat: fingerprint receipts on submit and block same-account resubmits"
```

---

## Task 4: Admin soft-flag + duplicate error (`BillReview.jsx`)

**Files:**
- Modify: `src/pages/admin/BillReview.jsx`

**Interfaces:**
- Consumes: `duplicateFlagsFor` from `src/lib/billDedup.js` (Task 1); `bills` array already in component state.

- [ ] **Step 1: Import the helper**

In `src/pages/admin/BillReview.jsx`, add after the existing `approveBill` import (line 3):

```js
import { duplicateFlagsFor } from '../../lib/billDedup'
```

- [ ] **Step 2: Handle `DUPLICATE_RECEIPT` on approve**

In `handleApprove`'s `catch` (lines 67-74), add a branch before the `ALREADY_REVIEWED` check:

```js
    } catch (err) {
      if (err.message === 'DUPLICATE_RECEIPT') {
        alert('This receipt image was already approved on another bill. No points were awarded.')
        setSelectedBill(null)
      } else if (err.message === 'ALREADY_REVIEWED') {
        alert('This bill has already been reviewed. Refresh to see its current status.')
        setSelectedBill(null)
      } else {
        console.error('Error approving bill:', err)
        alert('Failed to approve bill')
      }
    } finally {
```

- [ ] **Step 3: Render the soft-flag badge**

In the bills list `map` (starting line 219), compute flags at the top of the callback. Change:

```js
          {filteredBills.map((bill) => (
            <div
              key={bill.id}
              className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:shadow-lg transition-all"
            >
```

to:

```js
          {filteredBills.map((bill) => {
            const flags = duplicateFlagsFor(bill, bills)
            const flagged = bill.status === 'pending' && (flags.exactImage || flags.sameAmountDay)
            return (
            <div
              key={bill.id}
              className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:shadow-lg transition-all"
            >
```

Then inside the status-badge row, after the `bill.pointsAwarded > 0` block (line 244), add:

```js
                    {flagged && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border-2 border-orange-300">
                        ⚠️ {flags.exactImage ? 'Duplicate image' : 'Same amount & day'}
                      </span>
                    )}
```

Finally, close the new arrow-function body. Find the map's closing `))}` for this block and change it to `)})}`. (The `map` callback now uses `{ ... return (...) }` instead of `( ... )`, so its closing must be `)` then `})}`.)

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build completes with no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/BillReview.jsx
git commit -m "feat: flag likely-duplicate bills and surface duplicate-receipt errors in review"
```

---

## Task 5: Admin pending-bill count badge

**Files:**
- Create: `src/hooks/usePendingBillCount.js`
- Modify: `src/components/Layout.jsx`

**Interfaces:**
- Produces: `usePendingBillCount(enabled: boolean): number` — live count of `billSubmissions` with `status === 'pending'`; `0` when disabled or on error.

- [ ] **Step 1: Create the hook**

Create `src/hooks/usePendingBillCount.js`:

```js
// ABOUTME: Live count of bill submissions awaiting admin review.
// ABOUTME: Admin-only; drives the pending badge on the Bill Review nav item.
import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function usePendingBillCount(enabled) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setCount(0)
      return
    }
    const q = query(collection(db, 'billSubmissions'), where('status', '==', 'pending'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => setCount(snap.size),
      (err) => {
        // A permission failure shouldn't break the nav — just hide the badge.
        console.error('Failed to count pending bills:', err)
        setCount(0)
      },
    )
    return () => unsubscribe()
  }, [enabled])

  return count
}
```

- [ ] **Step 2: Wire the badge into `Layout.jsx`**

In `src/components/Layout.jsx`, add the import after line 8 (`import { useBillNotifications } ...`):

```js
import { usePendingBillCount } from '../hooks/usePendingBillCount'
```

After line 86 (the `useBillNotifications(...)` call), add:

```js
  // Live count of bills awaiting review — badge on the admin Bill Review nav item.
  const pendingBills = usePendingBillCount(isAdmin)
```

In `adminLinks` (lines 90-97), give the Bill Review item a badge:

```js
    { to: '/admin/bills',        icon: <Receipt size={18} />,         label: 'Bill Review', badge: pendingBills },
```

- [ ] **Step 3: Render the badge in the sidebar nav**

In `renderSidebar`, update the `links.map` (lines 144-156) to destructure `badge` and render it. Replace the `<Link ...>{icon}{label}</Link>` body with:

```js
        {links.map(({ to, icon, label, badge }) => {
          const active = pathname === to
          return (
            <Link key={to} to={to} onClick={onLinkClick}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={active ? { background: '#CC0000', color: '#fff' } : { color: '#444' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#FFF0F0' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
              {icon}
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-black flex items-center justify-center"
                  style={active ? { background: '#fff', color: '#CC0000' } : {}}>
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
```

- [ ] **Step 4: Render the badge on the mobile bottom bar**

In the mobile bottom tab bar, the left-side buttons render `links.slice(0, 2)` (lines 216-230) — for admins this includes Bill Review. Update that `map` to show a small dot-count. Replace the `links.slice(0, 2).map(({ to, icon, label }) => {` block's returned `<Link>` with one that adds a badge:

```js
            {links.slice(0, 2).map(({ to, icon, label, badge }) => {
              const active = pathname === to
              return (
                <Link key={to} to={to}
                  className="relative flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all"
                  style={{ color: active ? '#FFE600' : 'rgba(255, 255, 255, 0.7)' }}>
                  <span style={{ transform: active ? 'scale(1.2)' : 'scale(1)' }}>
                    {icon}
                  </span>
                  <span className="truncate px-1">{label}</span>
                  {badge > 0 && (
                    <span className="absolute top-1 right-1/4 min-w-4 h-4 px-1 rounded-full bg-yellow-400 text-red-800 text-[10px] font-black flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </Link>
              )
            })}
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build completes with no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/usePendingBillCount.js src/components/Layout.jsx
git commit -m "feat: live pending-bill count badge on the admin Bill Review nav"
```

---

## Task 6: Bilingual privacy policy page + route

**Files:**
- Create: `src/lib/privacy.js`
- Create: `src/pages/Privacy.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: `PRIVACY_POLICY_VERSION: number` from `src/lib/privacy.js`; a `Privacy` default-export page mounted at public route `/privacy`.

- [ ] **Step 1: Create the version constant**

Create `src/lib/privacy.js`:

```js
// ABOUTME: Privacy-policy version constant, stored on a user's profile at consent time.
// ABOUTME: Bump when the policy text materially changes so consent can be re-collected later.
export const PRIVACY_POLICY_VERSION = 1
```

- [ ] **Step 2: Create the page**

Create `src/pages/Privacy.jsx`:

```jsx
// ABOUTME: Public bilingual (Thai/English) privacy policy page for the DEK NOI rewards app.
// ABOUTME: Draft PDPA-oriented template — must be reviewed by legal counsel before launch.
import { useState } from 'react'
import { Link } from 'react-router-dom'

const CONTENT = {
  th: {
    switch: 'English',
    title: 'นโยบายความเป็นส่วนตัว',
    draft: 'ฉบับร่าง — ต้องได้รับการตรวจสอบจากที่ปรึกษากฎหมายก่อนเปิดใช้งานจริง',
    sections: [
      ['ผู้ควบคุมข้อมูล', 'เด็กน้อย (Dek Noi) เป็นผู้ควบคุมข้อมูลส่วนบุคคลของคุณสำหรับโปรแกรมสะสมคะแนนนี้'],
      ['ข้อมูลที่เราเก็บ', 'ชื่อ อีเมล เบอร์โทรศัพท์ รูปภาพใบเสร็จที่คุณส่ง และประวัติคะแนน/ยอดใช้จ่ายของคุณ'],
      ['วัตถุประสงค์', 'เพื่อให้บริการโปรแกรมสะสมคะแนน ได้แก่ การให้คะแนน การแลกของรางวัล และการติดต่อคุณเกี่ยวกับสิทธิประโยชน์'],
      ['ฐานทางกฎหมาย', 'เราประมวลผลข้อมูลของคุณบนพื้นฐานของความยินยอมที่คุณให้ไว้ตอนสมัครสมาชิก'],
      ['ระยะเวลาการเก็บรักษา', 'รูปใบเสร็จจะถูกเก็บไว้อย่างถาวรเพื่อให้คุณตรวจสอบประวัติได้ตลอดเวลา (อยู่ระหว่างการตรวจสอบตามหลัก PDPA)'],
      ['การเปิดเผยข้อมูล', 'ข้อมูลถูกจัดเก็บและประมวลผลผ่าน Firebase / Google Cloud ในฐานะผู้ประมวลผลข้อมูลของเรา'],
      ['สิทธิของคุณ', 'ภายใต้ PDPA คุณมีสิทธิเข้าถึง แก้ไข ลบข้อมูล และถอนความยินยอมได้'],
      ['ติดต่อเรา', 'สอบถามหรือใช้สิทธิของคุณได้ทาง LINE: @167fnbxs'],
    ],
    back: 'กลับ',
  },
  en: {
    switch: 'ภาษาไทย',
    title: 'Privacy Policy',
    draft: 'Draft — must be reviewed by legal counsel before launch.',
    sections: [
      ['Data controller', 'Dek Noi (เด็กน้อย) is the controller of your personal data for this loyalty program.'],
      ['What we collect', 'Your name, email, phone number, the receipt images you submit, and your points/spend history.'],
      ['Why we use it', 'To run the loyalty program: awarding points, processing redemptions, and contacting you about rewards.'],
      ['Legal basis', 'We process your data on the basis of the consent you give at registration.'],
      ['How long we keep it', 'Receipt images are kept permanently so you can always review your history (under review for PDPA alignment).'],
      ['Who we share with', 'Data is stored and processed via Firebase / Google Cloud, acting as our data processors.'],
      ['Your rights', 'Under Thailand’s PDPA you may access, correct, or delete your data and withdraw consent.'],
      ['Contact us', 'For any request or to exercise your rights, reach us on LINE: @167fnbxs.'],
    ],
    back: 'Back',
  },
}

export default function Privacy() {
  const [lang, setLang] = useState('th')
  const t = CONTENT[lang]

  return (
    <div className="min-h-screen bg-white">
      <div className="fixed top-0 left-0 right-0">
        <div className="h-2" style={{ background: '#CC0000' }} />
        <div className="h-2" style={{ background: '#FFE600' }} />
      </div>

      <div className="max-w-2xl mx-auto px-5 py-10">
        <div className="flex items-center justify-between mb-4">
          <Link to="/register" className="text-sm font-bold" style={{ color: '#CC0000' }}>← {t.back}</Link>
          <button onClick={() => setLang(lang === 'th' ? 'en' : 'th')}
            className="text-sm font-bold px-3 py-1.5 rounded-lg border-2 border-gray-200 hover:bg-gray-50">
            {t.switch}
          </button>
        </div>

        <h1 className="text-2xl font-black text-gray-900 mb-2">{t.title}</h1>

        <div className="mb-6 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-xl text-sm font-bold text-yellow-900">
          ⚠️ {t.draft}
        </div>

        <div className="space-y-5">
          {t.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-base font-black text-gray-900 mb-1">{heading}</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add the public route**

In `src/App.jsx`, add the import after line 8 (`import Register ...`):

```js
import Privacy from './pages/Privacy'
```

Add the route after the `/register` route (line 69):

```jsx
      <Route path="/privacy" element={<Privacy />} />
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: build completes with no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/privacy.js src/pages/Privacy.jsx src/App.jsx
git commit -m "feat: bilingual PDPA privacy policy page at public /privacy route"
```

---

## Task 7: Registration consent gate

**Files:**
- Modify: `src/pages/Register.jsx`
- Modify: `src/context/AuthContext.jsx`
- Test: `test/firestore.rules.test.js`

**Interfaces:**
- Consumes: `PRIVACY_POLICY_VERSION` from `src/lib/privacy.js` (Task 6).
- Produces: `register()` writes `privacyConsentAt` (serverTimestamp) and `privacyConsentVersion` (number) on the new user profile.

- [ ] **Step 1: Write the failing rules test**

Add to `test/firestore.rules.test.js` (new `describe`, reusing `testEnv`, `ALICE`):

```js
describe('privacy consent fields', () => {
  test('an owner may create their profile with consent fields', async () => {
    const db = testEnv.authenticatedContext('carol').firestore()
    await assertSucceeds(setDoc(doc(db, 'users', 'carol'), {
      name: 'Carol', phone: '', email: 'carol@example.com', role: 'customer',
      points: 0, totalSpent: 0, spendCarry: 0,
      privacyConsentAt: new Date(), privacyConsentVersion: 1,
    }))
  })

  test('an owner may add consent fields to their own profile via update', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertSucceeds(updateDoc(doc(db, 'users', ALICE), {
      privacyConsentAt: new Date(), privacyConsentVersion: 1,
    }))
  })
})
```

- [ ] **Step 2: Run test to verify it passes or fails**

Run: `npm run test:rules`
Expected: These two should PASS already — the `users` create rule allows an owner to write any fields, and the owner `update` rule only pins `points`/`role`/`totalSpent`/`spendCarry` (all unchanged here). If either FAILS, extend the `users` `update` allow-list in `firestore.rules` to permit `privacyConsentAt`/`privacyConsentVersion`, then re-run. (This step locks the behavior in a test regardless.)

- [ ] **Step 3: Record consent in `register()`**

In `src/context/AuthContext.jsx`, add the import after line 5 (`import { ensureUserProfile } ...`):

```js
import { PRIVACY_POLICY_VERSION } from '../lib/privacy'
```

In `register()` (lines 70-81), change the `data` object (line 72) to include consent:

```js
    const data = {
      name, phone, email, role: 'customer', points: 0, totalSpent: 0, spendCarry: 0,
      privacyConsentAt: serverTimestamp(), privacyConsentVersion: PRIVACY_POLICY_VERSION,
      createdAt: serverTimestamp(),
    }
```

- [ ] **Step 4: Add the consent checkbox to `Register.jsx`**

In `src/pages/Register.jsx`, add after line 23 (`const [gLoading, setGLoading] = useState(false)`):

```js
  const [agreed, setAgreed] = useState(false)
```

In `handleSubmit`, after `setError('')` (line 31), add the gate:

```js
    if (!agreed) { setError('Please agree to the Privacy Policy to continue. / กรุณายอมรับนโยบายความเป็นส่วนตัว'); return }
```

Add the checkbox inside the `<form>`, immediately before the submit `<button type="submit" ...>` (line 110):

```jsx
            <label className="flex items-start gap-2 text-xs text-gray-600 pt-1">
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 shrink-0" />
              <span>
                I agree to the{' '}
                <Link to="/privacy" target="_blank" className="font-bold hover:underline" style={{ color: '#CC0000' }}>
                  Privacy Policy
                </Link>{' '}
                / ฉันยอมรับนโยบายความเป็นส่วนตัว
              </span>
            </label>
```

Disable the submit button until agreed — change the submit button's `disabled={loading}` (line 110) to:

```jsx
            <button type="submit" disabled={loading || !agreed}
```

Also gate the Google sign-up button on the register page — change its `disabled={gLoading}` (line 87) to:

```jsx
          <button onClick={handleGoogle} disabled={gLoading || !agreed}
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build completes with no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Register.jsx src/context/AuthContext.jsx test/firestore.rules.test.js
git commit -m "feat: require privacy-policy consent at registration and record it"
```

---

## Task 8: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test:rules`
Expected: all tests PASS (67 existing + 7 billDedup + 3 approveBill dedup + 2 receiptHashes rules + 2 consent rules = 81).

- [ ] **Step 2: Clean build**

Run: `npm run build`
Expected: build completes (only the known chunk-size warning).

- [ ] **Step 3: Lint check (no new errors)**

Run: `npm run lint`
Expected: no *new* errors beyond the pre-existing ones noted in the repo. Fix any introduced by this work.

- [ ] **Step 4: Update the pre-prod checklist**

In `PRE_PROD_TASKS.md`, under section 4 (Ops / security), add:

```
- [ ] **Deploy the new index** — `firebase deploy --only firestore:indexes`
      (adds `billSubmissions (userId, imageHash)` for duplicate-receipt lookup).
- [ ] **Deploy updated rules** — `firebase deploy --only firestore:rules`
      (adds the `receiptHashes` dedup-lock collection).
- [ ] **Legal review of the privacy policy** (`/privacy`) — confirm the permanent
      receipt-retention clause and fill in Dek Noi's registered legal entity name.
```

- [ ] **Step 5: Commit**

```bash
git add PRE_PROD_TASKS.md
git commit -m "docs: add dedup index/rules deploy + privacy legal review to pre-prod tasks"
```

---

## Out of scope (per spec)

Re-prompting existing users on a policy-version bump; recording consent for accounts created via Google sign-in from the Login page; OCR receipt-number extraction for dedup; broader app localization; password reset.
