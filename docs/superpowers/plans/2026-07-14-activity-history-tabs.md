# Activity Page with Receipts + Rewards Tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the customer "My Orders" tab with an **Activity** page that has two sub-tabs — **Receipts** (submitted bills) and **Rewards** (redemptions) — and move the bill list out of Profile into it.

**Architecture:** A thin tab-shell page (`History.jsx`) holds the active-tab state and renders one of two self-contained tab components (`ReceiptsTab`, `RewardsTab`), each owning its own Firestore fetch. The shared LINE help card lives once in the shell. Bill-history code moves out of `Profile.jsx`; `MyRedemptions.jsx` is deleted after its content moves into `RewardsTab.jsx`.

**Tech Stack:** React 19, react-router-dom 7, Firebase Firestore, lucide-react, Tailwind CSS 4, Vite 8.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-14-activity-history-tabs-design.md`.
- **No automated tests** for this change — user authorized manual verification (spec Testing section). Each task's check is `npm run lint` (must pass clean) plus, at the end, manual in-app verification.
- Every source file starts with two `// ABOUTME: ` comment lines (per user CLAUDE.md). Existing files in this repo do **not** currently follow this; match the surrounding files you touch — add ABOUTME lines only to the **new** files created here.
- Brand palette: active `#CC0000`, accent `#FFE600`; match existing Tailwind/style conventions in the files being moved.
- No data-model changes; Firestore collections `billSubmissions` and `redemptions` and their query shapes are untouched.
- Behavior-preserving move: copy existing JSX/logic verbatim except where this plan states otherwise.

---

### Task 1: Create RewardsTab component

Move the redemption list out of `MyRedemptions.jsx` into a self-contained tab body. Drops the outer page wrapper, the page `<h1>`, and the LINE help card (the shell provides padding + LINE card). Keeps the redemption-status notification toast.

**Files:**
- Create: `src/pages/customer/history/RewardsTab.jsx`
- Reference (do not modify yet): `src/pages/customer/MyRedemptions.jsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `export default function RewardsTab()` — no props; reads auth via `useAuth()` internally.

- [ ] **Step 1: Create the file**

```jsx
// ABOUTME: Rewards sub-tab of the customer Activity page — lists reward redemptions.
// ABOUTME: Pending and history sections plus a redemption-status notification toast.
import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { useAuth } from '../../../context/AuthContext'
import { Link } from 'react-router-dom'
import charSitting from '../../../assets/char-sitting.png'
import Toast from '../../../components/Toast'
import { useRedemptionNotifications } from '../../../hooks/useRedemptionNotifications'

const STATUS = {
  pending:   { bg: '#FFF9E0', color: '#CC7700', label: '⏳ Pending Approval', desc: 'Admin will review your request shortly.' },
  approved:  { bg: '#F0FFF4', color: '#16a34a', label: '✅ Approved',         desc: 'Visit the store to collect your reward!' },
  collected: { bg: '#EEF6FF', color: '#1d4ed8', label: '🛍️ Collected',       desc: 'Enjoy your reward — thanks for collecting!' },
  rejected:  { bg: '#FFF0F0', color: '#CC0000', label: '❌ Not Approved',     desc: 'Contact us on LINE if you have questions.' },
}

export default function RewardsTab() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { notification, clearNotification } = useRedemptionNotifications(user?.uid)

  useEffect(() => {
    if (!user) return

    const loadRedemptions = async () => {
      setLoading(true)
      setError(null)
      try {
        let snap
        try {
          snap = await getDocs(query(collection(db, 'redemptions'), where('userId', '==', user.uid), orderBy('requestedAt', 'desc')))
        } catch (indexError) {
          console.warn('Firestore index not found, using fallback query:', indexError.message)
          snap = await getDocs(query(collection(db, 'redemptions'), where('userId', '==', user.uid)))
        }

        let data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        data.sort((a, b) => {
          const aTime = a.requestedAt?.toMillis?.() || 0
          const bTime = b.requestedAt?.toMillis?.() || 0
          return bTime - aTime
        })

        setItems(data)
      } catch (err) {
        console.error('Error loading redemptions:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadRedemptions()
  }, [user])

  const pending = items.filter(i => i.status === 'pending')
  const done    = items.filter(i => i.status !== 'pending')

  return (
    <>
      {notification && (
        <Toast
          message={notification.message}
          type={notification.type}
          onClose={clearNotification}
          duration={8000}
        />
      )}

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-bold text-red-800">Error loading redemptions</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2" style={{ borderColor: '#CC0000' }} />
          <p className="text-gray-400 text-sm">Loading…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <img src={charSitting} alt="" className="h-36 mx-auto mb-2" />
          <p className="font-medium mb-2">No redemptions yet</p>
          <Link to="/rewards" className="text-sm font-black hover:underline" style={{ color: '#CC0000' }}>Browse Rewards →</Link>
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Pending</p>
              <div className="space-y-3">
                {pending.map(r => <RedemptionCard key={r.id} r={r} />)}
              </div>
            </div>
          )}

          {done.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">History</p>
              <div className="space-y-3">
                {done.map(r => <RedemptionCard key={r.id} r={r} />)}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

function RedemptionCard({ r }) {
  const s = STATUS[r.status] ?? STATUS.pending
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{r.rewardEmoji || '🎁'}</span>
          <div>
            <p className="font-black text-gray-900">{r.rewardName}</p>
            <p className="text-xs text-gray-400">
              {r.requestedAt?.toDate?.()?.toLocaleDateString() ?? '—'} · <span className="font-bold" style={{ color: '#CC0000' }}>⭐ {r.pointsCost} pts</span>
            </p>
          </div>
        </div>
        <span className="text-xs font-black px-3 py-1.5 rounded-full shrink-0" style={{ background: s.bg, color: s.color }}>
          {s.label}
        </span>
      </div>
      <div className="px-4 pb-3">
        <p className="text-xs rounded-xl px-3 py-2 font-medium" style={{ background: s.bg, color: s.color }}>
          {r.status === 'rejected' && r.rejectNote ? `❝ ${r.rejectNote}` : s.desc}
        </p>
      </div>
    </div>
  )
}
```

Note: import paths use `../../../` because the file sits one level deeper (`pages/customer/history/`) than `MyRedemptions.jsx` (`pages/customer/`). The console.log of loaded redemptions is intentionally dropped.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS with no new errors. (`MyRedemptions.jsx` still exists and is still routed at this point, so nothing is broken.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/customer/history/RewardsTab.jsx
git commit -m "feat: add RewardsTab redemption list for Activity page"
```

---

### Task 2: Create ReceiptsTab component

Move the bill-history list + detail modal out of `Profile.jsx` into a self-contained tab body.

**Files:**
- Create: `src/pages/customer/history/ReceiptsTab.jsx`
- Reference (do not modify yet): `src/pages/customer/Profile.jsx:23-46, 71-87, 236-358`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `export default function ReceiptsTab()` — no props; reads auth via `useAuth()` internally.

- [ ] **Step 1: Create the file**

```jsx
// ABOUTME: Receipts sub-tab of the customer Activity page — lists submitted bills.
// ABOUTME: Realtime bill feed with status badges and a bill-detail modal.
import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { useAuth } from '../../../context/AuthContext'
import { Receipt, CheckCircle, XCircle, Clock } from 'lucide-react'

export default function ReceiptsTab() {
  const { user } = useAuth()
  const [bills, setBills] = useState([])
  const [selectedBill, setSelectedBill] = useState(null)

  // Fetch user's bill submissions
  useEffect(() => {
    if (!user) return

    const q = query(
      collection(db, 'billSubmissions'),
      where('userId', '==', user.uid),
      orderBy('submittedAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const billsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setBills(billsData)
    }, (error) => {
      // A missing composite index or a rules change surfaces here; without this
      // handler the query fails silently and the history just looks empty.
      console.error('Failed to load bill history:', error)
    })

    return () => unsubscribe()
  }, [user])

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'approved': return 'bg-green-100 text-green-800 border-green-300'
      case 'rejected': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock size={14} />
      case 'approved': return <CheckCircle size={14} />
      case 'rejected': return <XCircle size={14} />
      default: return null
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-gray-900 flex items-center gap-2">
          <Receipt size={20} style={{ color: '#CC0000' }} />
          Bill History
        </h3>
        <span className="text-sm font-bold text-gray-500">{bills.length} total</span>
      </div>

      {bills.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Receipt size={48} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No bills submitted yet</p>
          <p className="text-xs mt-1">Tap the 📄 button to upload your first bill!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => (
            <div
              key={bill.id}
              className="bg-white border-2 border-gray-200 rounded-xl p-3 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedBill(bill)}
            >
              <div className="flex items-start gap-3">
                <img
                  src={bill.imageData || bill.imageUrl}
                  alt="Bill"
                  className="w-16 h-16 object-cover rounded-lg border-2 border-gray-300"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${getStatusColor(bill.status)}`}>
                      {getStatusIcon(bill.status)}
                      {bill.status.toUpperCase()}
                    </span>
                    {bill.pointsAwarded > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
                        +{bill.pointsAwarded} pts
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300">
                      ฿{bill.amount != null ? bill.amount : '—'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {bill.submittedAt?.toDate().toLocaleDateString()} at {bill.submittedAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  {bill.notes && (
                    <p className="text-xs text-gray-500 mt-1 italic truncate">{bill.notes}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bill Detail Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedBill(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black">Bill Details</h2>
                <button
                  onClick={() => setSelectedBill(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <img
                src={selectedBill.imageData || selectedBill.imageUrl}
                alt="Bill"
                className="w-full h-auto rounded-xl border-4 border-red-600 mb-4"
              />

              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold border-2 flex items-center gap-2 ${getStatusColor(selectedBill.status)}`}>
                    {getStatusIcon(selectedBill.status)}
                    {selectedBill.status.toUpperCase()}
                  </span>
                  {selectedBill.pointsAwarded > 0 && (
                    <span className="px-3 py-1 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800 border-2 border-yellow-300">
                      +{selectedBill.pointsAwarded} points
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  Submitted: {selectedBill.submittedAt?.toDate().toLocaleString()}
                </p>
                {selectedBill.reviewedAt && (
                  <p className="text-sm text-gray-600">
                    Reviewed: {selectedBill.reviewedAt?.toDate().toLocaleString()}
                  </p>
                )}
                {selectedBill.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-bold text-gray-700 mb-1">Admin Notes:</p>
                    <p className="text-sm text-gray-600">{selectedBill.notes}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedBill(null)}
                className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

Note: the header row (`Bill History` + `N total`) and the `bg-white` on each card were previously provided by Profile's wrapping card; they are folded into the tab body here so the list still reads well on the Activity page's gray background.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS with no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/customer/history/ReceiptsTab.jsx
git commit -m "feat: add ReceiptsTab bill list for Activity page"
```

---

### Task 3: Create History shell and wire routing + nav

Create the Activity page shell that switches between the two tabs and carries the shared LINE card. Point the route and nav at it, and delete `MyRedemptions.jsx`.

**Files:**
- Create: `src/pages/customer/History.jsx`
- Modify: `src/App.jsx:15` (import), `src/App.jsx:76` (route)
- Modify: `src/components/Layout.jsx:4` (icon import), `src/components/Layout.jsx:106` (nav item)
- Delete: `src/pages/customer/MyRedemptions.jsx`

**Interfaces:**
- Consumes: `RewardsTab` (Task 1), `ReceiptsTab` (Task 2) — both default exports, no props.
- Produces: `export default function History()` — the page rendered at `/activity`.

- [ ] **Step 1: Create the shell file**

```jsx
// ABOUTME: Customer Activity page — a two-tab history of Receipts (bills) and Rewards (redemptions).
// ABOUTME: Holds the active-tab state and renders one tab body plus a shared LINE help card.
import { useState } from 'react'
import ReceiptsTab from './history/ReceiptsTab'
import RewardsTab from './history/RewardsTab'
import lineQr from '../../assets/line-qr.png'

const TABS = [
  { key: 'receipts', label: 'Receipts' },
  { key: 'rewards',  label: 'Rewards' },
]

export default function History() {
  const [tab, setTab] = useState('receipts')

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-lg">
      <h1 className="text-2xl font-black text-gray-900 mb-4">Activity</h1>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 bg-gray-100 rounded-xl p-1">
        {TABS.map(({ key, label }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 py-2.5 rounded-lg text-sm font-black transition-all"
              style={active ? { background: '#CC0000', color: '#fff' } : { color: '#666' }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {tab === 'receipts' ? <ReceiptsTab /> : <RewardsTab />}

      {/* LINE help */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
        <img src={lineQr} alt="LINE QR" className="w-16 h-16 object-contain rounded-xl shrink-0" />
        <div>
          <p className="font-black text-gray-900 text-sm mb-0.5">Have a question?</p>
          <p className="text-xs text-gray-500 leading-relaxed">Scan to contact us on <strong>LINE</strong> for help with your rewards.</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/App.jsx` import (line 15)**

Replace:
```jsx
import MyRedemptions from './pages/customer/MyRedemptions'
```
with:
```jsx
import History from './pages/customer/History'
```

- [ ] **Step 3: Update `src/App.jsx` route (line 76)**

Replace:
```jsx
      <Route path="/my-redemptions" element={<RequireAuth><Layout><MyRedemptions /></Layout></RequireAuth>} />
```
with:
```jsx
      <Route path="/activity" element={<RequireAuth><Layout><History /></Layout></RequireAuth>} />
```

- [ ] **Step 4: Update `src/components/Layout.jsx` icon import (line 4)**

In the `lucide-react` import, remove `ShoppingBag` if it is unused elsewhere and ensure `Receipt` is imported. `Receipt` is already imported on line 4; `ShoppingBag` is still used by `adminLinks` (line 99), so **leave `ShoppingBag` in place**. No change needed to the import line — verify `Receipt` is present (it is).

- [ ] **Step 5: Update `src/components/Layout.jsx` nav item (line 106)**

Replace:
```jsx
    { to: '/my-redemptions', icon: <ShoppingBag size={22} />, label: 'My Orders' },
```
with:
```jsx
    { to: '/activity',       icon: <Receipt size={22} />,     label: 'Activity' },
```

- [ ] **Step 6: Delete the old page**

```bash
git rm src/pages/customer/MyRedemptions.jsx
```

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: PASS with no errors (no dangling `MyRedemptions` import, no unused-var errors).

- [ ] **Step 8: Commit**

```bash
git add src/pages/customer/History.jsx src/App.jsx src/components/Layout.jsx
git commit -m "feat: add Activity page shell, route /activity, update nav"
```

---

### Task 4: Remove bill history from Profile

Strip the bill-history card, detail modal, and their supporting state/imports from `Profile.jsx`. Keep profile card, stats, LINE card, logout.

**Files:**
- Modify: `src/pages/customer/Profile.jsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing new; `Profile` keeps its default export and route.

- [ ] **Step 1: Trim imports (line 3)**

Replace:
```jsx
import { doc, updateDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
```
with:
```jsx
import { doc, updateDoc } from 'firebase/firestore'
```

- [ ] **Step 2: Trim icon imports (line 5)**

Replace:
```jsx
import { User, Mail, Phone, Camera, Save, LogOut, Receipt, CheckCircle, XCircle, Clock, MessageCircle } from 'lucide-react'
```
with:
```jsx
import { User, Mail, Phone, Camera, Save, LogOut, MessageCircle } from 'lucide-react'
```

- [ ] **Step 3: Remove bills state (lines 15-16)**

Delete these two lines:
```jsx
  const [bills, setBills] = useState([])
  const [selectedBill, setSelectedBill] = useState(null)
```

- [ ] **Step 4: Remove the bills fetch effect (lines 23-46)**

Delete the entire `// Fetch user's bill submissions` `useEffect` block (from the comment through its closing `}, [user])`).

- [ ] **Step 5: Remove status helpers (lines 71-87)**

Delete the `getStatusColor` and `getStatusIcon` functions.

- [ ] **Step 6: Remove the Bill History card (lines 236-296)**

Delete the entire `{/* Bill History */}` `<div>...</div>` block.

- [ ] **Step 7: Remove the Bill Detail Modal (lines 298-358)**

Delete the entire `{/* Bill Detail Modal */}` block (the `{selectedBill && ( ... )}` expression).

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: PASS. Specifically no `no-unused-vars` for `Receipt`, `CheckCircle`, `XCircle`, `Clock`, `collection`, `query`, `where`, `orderBy`, `onSnapshot`, `bills`, `selectedBill`.

- [ ] **Step 9: Commit**

```bash
git add src/pages/customer/Profile.jsx
git commit -m "refactor: remove bill history from Profile (moved to Activity page)"
```

---

### Task 5: Manual verification

No automated tests (user-authorized). Verify the change end-to-end in the running app.

**Files:** none.

- [ ] **Step 1: Build check**

Run: `npm run build`
Expected: PASS — build completes with no import/resolve errors.

- [ ] **Step 2: Run the app**

Run: `npm run dev`, open the app, log in as a customer.

- [ ] **Step 3: Verify against the spec's checklist**

Confirm each:
- Nav shows **Activity** with the **Receipt** icon, in the same slot the old "My Orders" occupied (bottom tab bar on mobile, sidebar on desktop).
- Tapping Activity loads `/activity` with the **Receipts** tab active by default; submitted bills list, and tapping a bill opens the detail modal.
- Switching to **Rewards** shows redemptions (Pending / History sections) and the empty state / notification toast still behave.
- The **LINE help card** appears once, below both tabs.
- **Profile** no longer shows any Bill History card or bill modal and still renders the profile card, stats, LINE card, and logout without console errors.
- Navigating to the old `/my-redemptions` URL lands on the `Root` redirect (dashboard), not a crash.

- [ ] **Step 4: Report results**

Report pass/fail per checklist item with any console output. If all pass, the feature is complete.

---

### Task 6: Deep-link Activity tabs via `?tab=` (added post-review)

Added after the final whole-branch review flagged that the two redemption-oriented Dashboard entry points now land on the default Receipts tab. Make the Activity page's active tab driven by a `?tab=` query param, and point those two Dashboard links at `/activity?tab=rewards`.

**Files:**
- Modify: `src/pages/customer/History.jsx`
- Modify: `src/pages/customer/Dashboard.jsx:189` (pending-redemptions alert), `:215` ("My Redemptions" card)

**Interfaces:**
- Consumes: `History` (Task 3), react-router-dom `useSearchParams`.
- Produces: `/activity` reads `?tab=receipts|rewards` (default `receipts` when absent/invalid); switcher updates the param.

- [ ] **Step 1: Drive the active tab from the query param in `History.jsx`**

Replace the `useState` import + tab state with `useSearchParams`. Change the top of the file:

```jsx
import { useSearchParams } from 'react-router-dom'
import ReceiptsTab from './history/ReceiptsTab'
import RewardsTab from './history/RewardsTab'
import lineQr from '../../assets/line-qr.png'

const TABS = [
  { key: 'receipts', label: 'Receipts' },
  { key: 'rewards',  label: 'Rewards' },
]

export default function History() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'rewards' ? 'rewards' : 'receipts'
  // Receipts is the default, so clear the param for a clean URL; keep ?tab=rewards otherwise.
  const setTab = (key) => setSearchParams(key === 'rewards' ? { tab: 'rewards' } : {}, { replace: true })
```

The `useState` import line (`import { useState } from 'react'`) is removed. The rest of the component body is unchanged — the switcher already calls `setTab(key)` and reads `tab`.

- [ ] **Step 2: Point the two Dashboard links at the Rewards tab**

In `src/pages/customer/Dashboard.jsx`, change both redemption-oriented links from `to="/activity"` to `to="/activity?tab=rewards"`:
- The pending-redemptions alert `<Link>` (the `⏳ ... redemptions pending approval` one).
- The "My Redemptions" quick-action card `<Link>`.

Change only the `to` attribute value on those two links. Do not touch the "Rewards Store" link (`to="/rewards"`) or anything else.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS, no unused-var error for the removed `useState` import.

- [ ] **Step 4: Commit**

```bash
git add src/pages/customer/History.jsx src/pages/customer/Dashboard.jsx
git commit -m "feat: deep-link Activity tabs via ?tab and point Dashboard redemption links at Rewards"
```

---

## Self-Review

**Spec coverage:**
- Nav label/icon/route → Task 3 (Layout + App). ✓
- History shell with default Receipts tab → Task 3. ✓
- ReceiptsTab (bills moved from Profile) → Task 2. ✓
- RewardsTab (redemptions from MyRedemptions) → Task 1. ✓
- Delete MyRedemptions → Task 3. ✓
- Profile cleanup → Task 4. ✓
- Shared LINE card in shell → Task 3. ✓
- Manual verification decision → Task 5. ✓

**Placeholder scan:** No TBD/TODO; all code shown in full. ✓

**Type/name consistency:** `History` (default export) rendered in App route and imported from `./pages/customer/History`; `ReceiptsTab` / `RewardsTab` default exports imported by `History.jsx` from `./history/...`; tab keys `'receipts'`/`'rewards'` consistent between `TABS` and the render switch. ✓
