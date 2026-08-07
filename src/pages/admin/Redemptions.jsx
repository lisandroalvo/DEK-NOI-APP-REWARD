// ABOUTME: Admin Redemptions page — a "Needs attention" tab for reserving/pending redemptions
// ABOUTME: (Retry/Refund/Reject) and a "History" tab with filter chips, search, and a summary.
import { useCallback, useEffect, useState } from 'react'
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

  const sortByRequestedDesc = (data) =>
    [...data].sort((a, b) => (b.requestedAt?.toMillis?.() || 0) - (a.requestedAt?.toMillis?.() || 0))

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [reserving, pending, recent] = await Promise.all([
        getDocs(query(collection(db, 'redemptions'), where('status', '==', 'reserving'))),
        getDocs(query(collection(db, 'redemptions'), where('status', '==', 'pending'))),
        (async () => {
          try {
            return await getDocs(query(collection(db, 'redemptions'), orderBy('requestedAt', 'desc')))
          } catch (indexError) {
            // If index doesn't exist, fall back to query without orderBy
            console.warn('Firestore index not found, using fallback query:', indexError.message)
            return await getDocs(collection(db, 'redemptions'))
          }
        })(),
      ])
      const map = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setAttentionItems(sortByRequestedDesc([...map(reserving), ...map(pending)]))
      setHistoryItems(sortByRequestedDesc(map(recent)))
    } catch (err) {
      console.error('Error loading redemptions:', err)
      setError(err.message || 'Failed to load redemptions')
      setAttentionItems([]); setHistoryItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  // loadAll() is an async fetch; its synchronous setLoading(true) is the intended
  // loading indicator, not a cascading-render bug.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll() }, [loadAll])

  // Refund a redemption stuck in 'reserving' (points deducted but the API call never
  // resolved, e.g. it went down and the customer never retried). Credits back exactly
  // what was reserved and closes the redemption as rejected.
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

  const openReject = (r) => { setRejectModal(r); setRejectNote('') }

  const confirmReject = async () => {
    if (!rejectModal) return
    setWorking(rejectModal.id)
    try {
      await updateDoc(doc(db, 'redemptions', rejectModal.id), {
        status: 'rejected',
        rejectNote: rejectNote.trim() || null,
        reviewedAt: serverTimestamp(),
        reviewedBy: user.uid,
      })
      setRejectModal(null)
      await loadAll()
    } finally { setWorking(null) }
  }

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

      {/* Reject modal with reason */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-gray-900">Reject Request</h2>
              <button onClick={() => setRejectModal(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="rounded-xl p-3 mb-4" style={{ background: '#FFF0F0' }}>
              <p className="text-sm font-bold text-gray-800">{rejectModal.rewardName}</p>
              <p className="text-xs text-gray-500">{rejectModal.userName} · ⭐ {rejectModal.pointsCost} pts</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason (optional)</label>
              <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3}
                placeholder="e.g. Out of stock, please try again next week"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none"
                onFocus={e => e.target.style.borderColor = '#CC0000'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600">
                Cancel
              </button>
              <button onClick={confirmReject} disabled={working === rejectModal.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-60"
                style={{ background: '#CC0000' }}>
                {working === rejectModal.id ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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
