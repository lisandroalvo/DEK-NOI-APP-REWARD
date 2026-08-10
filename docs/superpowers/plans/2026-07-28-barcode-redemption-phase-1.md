# Barcode Redemption — Phase 1 (app-side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer redeem a reward by scanning (or typing) the product barcode; capture the barcode + the reward's `maxValue` on the redemption, and surface both to the admin — without the Cloud Function / inventory API (that's Phase 2).

**Architecture:** Add a structured `maxValue` to rewards; add a reusable `BarcodeScanner` component (camera decode via `@zxing/browser` + manual-entry fallback); wire it into the customer redeem flow so the redemption doc carries `barcode` + `maxValue`; show both in the admin Redemptions list and the customer's Activity → Rewards tab. Points still deduct admin-side via the existing, unchanged `approveRedemption` (Phase 2 automates this).

**Tech Stack:** React 19, Vite 8, Firebase Firestore, lucide-react, Tailwind 4, `@zxing/browser` (new).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-28-barcode-redemption-design.md`. Phase 1 only — do NOT build the Cloud Function or call any inventory API here.
- Do NOT modify `src/lib/points.js` or `approveRedemption`. Phase 1 keeps the existing `pending → approved → collected` admin flow; barcode is captured + displayed only.
- No Firestore rules change: the `redemptions` create rule already allows extra fields (it only checks `userId`). Do NOT loosen rules.
- **Testing:** the repo has vitest for pure logic + the Firestore emulator, but **no React component test stack** (no jsdom/testing-library). Logic tasks (the rewards catalog) use vitest TDD. UI tasks (scanner, page wiring) are verified by `npm run lint` + `npm run build` + manual in-app check — the established decision for this app's UI work. Do NOT add a component-test framework.
- New source files start with two `// ABOUTME:` comment lines. Existing files that lack them are left as-is.
- `maxValue` is an integer number of baht. Brand palette: active `#CC0000`, accent `#FFE600`.
- Match existing style/formatting in each file touched. YAGNI: single-item redemption only (no bundle/multi-scan).

---

### Task 1: Add `maxValue` to the rewards catalog + validator

**Files:**
- Modify: `scripts/rewards-catalog.js`
- Test: `test/rewards-catalog.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: every `REWARDS_CATALOG` entry has `maxValue` (int ฿); `validateCatalog` rejects a missing/non-positive-integer `maxValue`.

- [ ] **Step 1: Update the catalog test to expect `maxValue` (failing test)**

In `test/rewards-catalog.test.js`, add this test inside the `describe('rewards catalog', …)` block:

```js
  test('every reward has a positive-integer maxValue (baht ceiling)', () => {
    const maxValues = Object.fromEntries(REWARDS_CATALOG.map(r => [r.name, r.maxValue]))
    expect(maxValues).toEqual({
      'Free bottled water': 10,
      'Free candy or small treat': 12,
      'Free bag of chips': 20,
      'Free cup noodles': 15,
      'Free soft drink': 20,
      'Free ice cream': 30,
      'Pick any 3 snacks': 55,
      'Snack + drink combo box': 75,
    })
  })

  test('validator rejects a non-integer maxValue', () => {
    expect(() => validateCatalog([{ name: 'x', description: 'y', pointsCost: 10, maxValue: 1.5, emoji: '💧' }])).toThrow()
  })
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run test/rewards-catalog.test.js`
Expected: FAIL — `maxValue` is `undefined` for every entry, and the validator doesn't check `maxValue`.

- [ ] **Step 3: Add `maxValue` to each catalog entry and the validator**

In `scripts/rewards-catalog.js`, add `maxValue` to each object (place it right after `pointsCost`) with these values, and update the file's first ABOUTME line to mention the ceiling:

```js
  { name: 'Free bottled water', description: 'One free bottle of water (up to ฿10).', pointsCost: 20, maxValue: 10, emoji: '💧' },
  { name: 'Free candy or small treat', description: 'One free candy or small treat (up to ฿12).', pointsCost: 30, maxValue: 12, emoji: '🍬' },
  { name: 'Free bag of chips', description: 'One free bag of chips or a snack (up to ฿20).', pointsCost: 50, maxValue: 20, emoji: '🍟' },
  { name: 'Free cup noodles', description: 'One free cup of instant noodles (up to ฿15).', pointsCost: 60, maxValue: 15, emoji: '🍜' },
  { name: 'Free soft drink', description: 'One free soft drink or soda (up to ฿20).', pointsCost: 70, maxValue: 20, emoji: '🥤' },
  { name: 'Free ice cream', description: 'One free ice cream (up to ฿30).', pointsCost: 80, maxValue: 30, emoji: '🍦' },
  { name: 'Pick any 3 snacks', description: 'Choose any 3 snacks, total up to ฿55.', pointsCost: 200, maxValue: 55, emoji: '🎉' },
  { name: 'Snack + drink combo box', description: 'A snack and drink combo box (up to ฿75).', pointsCost: 260, maxValue: 75, emoji: '📦' },
```

Then add this check inside the `for (const r of catalog)` loop in `validateCatalog`, after the `pointsCost` check:

```js
    if (!Number.isInteger(r.maxValue) || r.maxValue <= 0) throw new Error(`Reward maxValue must be a positive integer: ${r.name}`)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/rewards-catalog.test.js`
Expected: PASS (all rewards-catalog tests green).

- [ ] **Step 5: Commit**

```bash
git add scripts/rewards-catalog.js test/rewards-catalog.test.js
git commit -m "feat: add maxValue (baht ceiling) to rewards catalog + validator"
```

---

### Task 2: Add `maxValue` to the admin Rewards form

**Files:**
- Modify: `src/pages/admin/Rewards.jsx`

**Interfaces:**
- Consumes: nothing.
- Produces: admins can set/edit a reward's `maxValue`; it is saved to the `rewards` doc as an integer.

- [ ] **Step 1: Add `maxValue` to the form's empty state (line 7)**

Replace:
```js
const EMPTY = { name: '', description: '', pointsCost: '', emoji: '', available: true, imageUrl: null }
```
with:
```js
const EMPTY = { name: '', description: '', pointsCost: '', maxValue: '', emoji: '', available: true, imageUrl: null }
```

- [ ] **Step 2: Map `maxValue` when opening the edit form (line 20)**

In `open()`, replace the populated-form object:
```js
    setForm(r ? { name: r.name, description: r.description, pointsCost: String(r.pointsCost), emoji: r.emoji || '', available: r.available, imageUrl: r.imageUrl || null } : EMPTY)
```
with:
```js
    setForm(r ? { name: r.name, description: r.description, pointsCost: String(r.pointsCost), maxValue: r.maxValue != null ? String(r.maxValue) : '', emoji: r.emoji || '', available: r.available, imageUrl: r.imageUrl || null } : EMPTY)
```

- [ ] **Step 3: Parse `maxValue` to an int on save (line 26)**

In `save()`, replace:
```js
    const data = { ...form, pointsCost: parseInt(form.pointsCost) || 0, updatedAt: serverTimestamp() }
```
with:
```js
    const data = { ...form, pointsCost: parseInt(form.pointsCost) || 0, maxValue: parseInt(form.maxValue) || 0, updatedAt: serverTimestamp() }
```

- [ ] **Step 4: Add the `Max value (฿)` input to the form fields array**

Find the fields array (the `[{ label: 'Reward name', … }, …].map(…)` list, around line 104) and add this entry immediately after the `Points cost` entry:

```js
                { label: 'Max value (฿)', key: 'maxValue', placeholder: '20', type: 'number' },
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS, no errors.

- [ ] **Step 6: Manual check**

Run `npm run dev`, log in as admin → Rewards → New Reward (and Edit an existing one). Confirm the **Max value (฿)** field appears, saves, and reloads with the saved value.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/Rewards.jsx
git commit -m "feat: add Max value (baht) field to admin reward form"
```

---

### Task 3: BarcodeScanner component

**Files:**
- Create: `src/components/BarcodeScanner.jsx`
- Modify: `package.json` (new dependency)

**Interfaces:**
- Consumes: nothing.
- Produces: `export default function BarcodeScanner({ onDetected, onCancel })` — a modal that decodes a barcode from the camera OR takes manual entry, then calls `onDetected(barcodeString)`. `onCancel()` closes it.

- [ ] **Step 1: Install the scanner library**

Run: `npm install @zxing/browser`
Expected: adds `@zxing/browser` (and its `@zxing/library` dep) to `package.json` dependencies.

- [ ] **Step 2: Create the component**

```jsx
// ABOUTME: Modal that reads a product barcode from the device camera, with a manual-entry fallback.
// ABOUTME: Works cross-platform (iOS Safari + Android) via @zxing/browser; calls onDetected(barcode).
import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { X, Keyboard } from 'lucide-react'

export default function BarcodeScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null)
  // Keep the latest onDetected without re-running the camera effect on every render.
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected

  const [manual, setManual] = useState('')
  const [cameraError, setCameraError] = useState('')

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let controls
    let stopped = false

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, _err, ctrls) => {
        controls = ctrls
        if (stopped) return
        if (result) {
          stopped = true
          ctrls.stop()
          onDetectedRef.current(result.getText())
        }
      })
      .then((ctrls) => { controls = ctrls })
      .catch((e) => {
        // No camera / permission denied — the manual field below still works.
        console.warn('Barcode camera unavailable:', e)
        setCameraError('Camera unavailable — type the barcode number below.')
      })

    return () => {
      stopped = true
      try { controls?.stop() } catch { /* already stopped */ }
    }
  }, [])

  const submitManual = () => {
    const code = manual.trim()
    if (code) onDetected(code)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">Scan the product barcode</h2>
          <button onClick={onCancel}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="p-4">
          {cameraError ? (
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 mb-4 text-xs text-yellow-800">
              {cameraError}
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden border-2 mb-4 aspect-square bg-black" style={{ borderColor: '#CC0000' }}>
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            </div>
          )}

          <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Keyboard size={14} /> Or enter it manually
          </label>
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 8850999320005"
              className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              onFocus={e => e.target.style.borderColor = '#CC0000'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              onKeyDown={e => e.key === 'Enter' && submitManual()}
            />
            <button onClick={submitManual} disabled={!manual.trim()}
              className="px-4 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-50"
              style={{ background: '#CC0000' }}>
              Use
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

Note: `@zxing/browser`'s `decodeFromVideoDevice(deviceId, videoEl, callback)` returns a promise of scanner controls and invokes the callback with `(result, error, controls)`. If the installed version's signature differs, adjust in Step 4 while verifying — the manual-entry path is version-independent and must always work.

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS (the import resolves; no unused vars).

- [ ] **Step 4: Manual check**

Run `npm run dev` on an HTTPS/localhost origin, temporarily render `<BarcodeScanner onDetected={console.log} onCancel={() => {}} />` on a page (or wait for Task 4). Confirm: the camera preview appears and scanning a barcode logs its number; denying the camera shows the fallback message; typing a number + **Use** calls `onDetected`. Revert any temporary render.

- [ ] **Step 5: Commit**

```bash
git add src/components/BarcodeScanner.jsx package.json package-lock.json
git commit -m "feat: add BarcodeScanner component (camera + manual entry)"
```

---

### Task 4: Capture the barcode in the customer redeem flow

**Files:**
- Modify: `src/pages/customer/Rewards.jsx`

**Interfaces:**
- Consumes: `BarcodeScanner` (Task 3).
- Produces: submitting a redemption writes `barcode` (string) and `maxValue` (number) onto the `redemptions` doc, alongside the existing fields, status `pending`.

- [ ] **Step 1: Import the scanner and add scanner state**

At the top of `src/pages/customer/Rewards.jsx`, add the import:
```jsx
import BarcodeScanner from '../../components/BarcodeScanner'
```
Inside the component, add state next to the other `useState` hooks:
```jsx
  const [scanFor, setScanFor] = useState(null) // reward awaiting a barcode scan
```

- [ ] **Step 2: Change the confirm button to open the scanner instead of redeeming directly**

In the confirm modal, replace the confirm button's `onClick={() => redeem(showModal)}` handler so it opens the scanner for that reward:
```jsx
              <button onClick={() => { setScanFor(showModal); setShowModal(null) }} disabled={redeeming === showModal.id}
```
Also update the confirm-modal helper copy (the `<p>` that currently reads "Your request will be sent to the admin for approval. Points are deducted once approved.") to:
```jsx
            <p className="text-xs text-gray-400 text-center mb-5">
              Next, scan the barcode of the item you're taking. Points are deducted once the admin confirms it.
            </p>
```

- [ ] **Step 3: Make `redeem` accept a barcode and store it**

Replace the `redeem` function so it takes the scanned barcode and writes `barcode` + `maxValue`:
```jsx
  const redeem = async (reward, barcode) => {
    setRedeeming(reward.id)
    try {
      await addDoc(collection(db, 'redemptions'), {
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
      setScanFor(null)
      setSuccess(`Redemption for "${reward.name}" submitted! The admin will confirm it shortly.`)
      setTimeout(() => setSuccess(''), 6000)
    } finally {
      setRedeeming(null)
    }
  }
```

- [ ] **Step 4: Render the scanner when a reward is awaiting a barcode**

Just before the closing `</div>` of the page (after the Details modal block), add:
```jsx
      {/* Barcode capture */}
      {scanFor && (
        <BarcodeScanner
          onDetected={(barcode) => redeem(scanFor, barcode)}
          onCancel={() => setScanFor(null)}
        />
      )}
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 6: Manual check**

`npm run dev`, log in as a customer with enough points → Rewards → Redeem a reward → Confirm → the scanner opens → scan or type a barcode → success message shows. In Firestore, confirm the new `redemptions` doc has `barcode`, `maxValue`, and `status: 'pending'`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/customer/Rewards.jsx
git commit -m "feat: capture product barcode when redeeming a reward"
```

---

### Task 5: Surface the barcode + maxValue to admin and customer

**Files:**
- Modify: `src/pages/admin/Redemptions.jsx`
- Modify: `src/pages/customer/history/RewardsTab.jsx`

**Interfaces:**
- Consumes: `redemptions` docs now carry `barcode` + `maxValue` (Task 4).
- Produces: nothing new; read-only display.

- [ ] **Step 1: Show barcode + maxValue on the admin pending card**

In `src/pages/admin/Redemptions.jsx`, inside the redemption card's info block (the `<div className="min-w-0">` that renders `r.rewardName`, `r.userName`, etc.), add — right after the points/date `<p>`:
```jsx
                  {r.barcode && (
                    <p className="text-xs mt-1 font-mono text-gray-600 break-all">
                      🔖 {r.barcode}
                      {r.maxValue != null && <span className="text-gray-400"> · max ฿{r.maxValue}</span>}
                    </p>
                  )}
```

- [ ] **Step 2: Show the barcode on the customer's redemption card**

In `src/pages/customer/history/RewardsTab.jsx`, inside `RedemptionCard`, add the barcode under the existing date/points line. Find the `<p className="text-xs text-gray-400">` that shows the date + points inside the card body and add immediately after its closing `</p>`:
```jsx
            {r.barcode && (
              <p className="text-[11px] text-gray-400 mt-0.5 font-mono break-all">🔖 {r.barcode}</p>
            )}
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual check**

`npm run dev`: as admin → Redemptions → Pending shows the barcode + `max ฿X` on the redemption submitted in Task 4. As the customer → Activity → Rewards tab shows the barcode on that redemption.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/Redemptions.jsx src/pages/customer/history/RewardsTab.jsx
git commit -m "feat: show redemption barcode and max value to admin and customer"
```

---

## Self-Review

**Spec coverage (Phase 1 scope):**
- `maxValue` on reward model → Task 1 (catalog/validator) + Task 2 (admin form). ✓
- Barcode capture (scan + manual, cross-platform) → Task 3 (component) + Task 4 (wired into redeem). ✓
- Redemption doc gains `barcode` + `maxValue` → Task 4. ✓
- Admin sees barcode/maxValue → Task 5. ✓ Customer sees barcode → Task 5. ✓
- Points stay admin-side, `approveRedemption`/`points.js` untouched → enforced by Global Constraints; no task changes them. ✓
- No rules change (create already permits extra fields) → Global Constraints. ✓
- Phase 2 (Cloud Function + inventory API + `maxValue` enforcement + auto points) → explicitly out of Phase 1 scope. ✓

**Placeholder scan:** All steps carry concrete code/values; no TBD/TODO. The one version caveat (@zxing/browser callback signature) is a labeled verify-and-adjust note with a version-independent fallback, not a placeholder. ✓

**Type/name consistency:** `BarcodeScanner({ onDetected, onCancel })` produced in Task 3, consumed identically in Task 4; `redeem(reward, barcode)` defined and called consistently in Task 4; `scanFor` state used consistently; redemption fields `barcode`/`maxValue` written in Task 4 and read in Task 5. ✓
