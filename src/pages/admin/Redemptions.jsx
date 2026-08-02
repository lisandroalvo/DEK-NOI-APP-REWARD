import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { approveRedemption } from '../../lib/points'
import { useAuth } from '../../context/AuthContext'
import { CheckCircle, XCircle, Clock, X, RotateCcw } from 'lucide-react'

const STATUS_STYLE = {
  approved:  { bg: '#F0FFF4', color: '#16a34a', label: '✅ Approved' },
  collected: { bg: '#EEF6FF', color: '#1d4ed8', label: '🛍️ Collected' },
  rejected:  { bg: '#FFF0F0', color: '#CC0000', label: '❌ Rejected' },
}

export default function AdminRedemptions() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState({ pending: 0, approved: 0, collected: 0, rejected: 0 })
  const [tab, setTab] = useState('pending')
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectNote, setRejectNote] = useState('')
  const [working, setWorking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async (status) => {
    setLoading(true)
    setError(null)
    try {
      // Try with orderBy first (requires index)
      let snap
      try {
        snap = await getDocs(query(collection(db, 'redemptions'), where('status', '==', status), orderBy('requestedAt', 'desc')))
      } catch (indexError) {
        // If index doesn't exist, fall back to query without orderBy
        console.warn('Firestore index not found, using fallback query:', indexError.message)
        snap = await getDocs(query(collection(db, 'redemptions'), where('status', '==', status)))
      }
      
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      // Sort in memory if we couldn't use orderBy
      data.sort((a, b) => {
        const aTime = a.requestedAt?.toMillis?.() || 0
        const bTime = b.requestedAt?.toMillis?.() || 0
        return bTime - aTime
      })
      
      console.log(`Loaded ${data.length} ${status} redemptions:`, data)
      setItems(data)
    } catch (error) {
      console.error('Error loading redemptions:', error)
      setError(error.message || 'Failed to load redemptions')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const loadCounts = async () => {
    try {
      const [p, a, c, r] = await Promise.all([
        getDocs(query(collection(db, 'redemptions'), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'redemptions'), where('status', '==', 'approved'))),
        getDocs(query(collection(db, 'redemptions'), where('status', '==', 'collected'))),
        getDocs(query(collection(db, 'redemptions'), where('status', '==', 'rejected'))),
      ])
      setCounts({ pending: p.size, approved: a.size, collected: c.size, rejected: r.size })
    } catch (error) {
      console.error('Error loading counts:', error)
    }
  }

  useEffect(() => {
    // load()/loadCounts() are async data fetches; load()'s synchronous setLoading(true)
    // is the intended per-tab loading indicator, not a cascading-render bug.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(tab)
    loadCounts()
  }, [tab])

  const approve = async (r) => {
    if (!confirm(`Approve "${r.rewardName}" for ${r.userName}?\nThis will deduct ${r.pointsCost} points from their account.`)) return
    setWorking(r.id)
    try {
      await approveRedemption(db, r, user.uid)
      await load(tab)
      await loadCounts()
    } catch (err) {
      if (err.message === 'INSUFFICIENT_POINTS') {
        alert(`${r.userName} no longer has enough points for this reward. Their balance may have changed since the request.`)
      } else if (err.message === 'ALREADY_REVIEWED') {
        alert('This redemption has already been reviewed. The list will refresh.')
        await load(tab)
        await loadCounts()
      } else {
        console.error('Error approving redemption:', err)
        alert('Failed to approve redemption. Please try again.')
      }
    } finally { setWorking(null) }
  }

  // Mark an already-approved redemption as handed over to the customer. This closes
  // the loop so a customer can't present the same approved reward twice — points were
  // already deducted at approval, so this only advances the status.
  const markCollected = async (r) => {
    if (!confirm(`Mark "${r.rewardName}" as collected by ${r.userName}?`)) return
    setWorking(r.id)
    try {
      await updateDoc(doc(db, 'redemptions', r.id), {
        status: 'collected',
        collectedAt: serverTimestamp(),
        collectedBy: user.uid,
      })
      await load(tab)
      await loadCounts()
    } catch (err) {
      console.error('Error marking redemption collected:', err)
      alert('Failed to mark as collected. Please try again.')
    } finally { setWorking(null) }
  }

  // Reverse an accidental "mark collected": move the redemption back to approved and
  // clear the collection stamps. Points were never touched at collection, so there is
  // nothing to refund here.
  const undoCollected = async (r) => {
    if (!confirm(`Undo collection of "${r.rewardName}"? This moves it back to Approved.`)) return
    setWorking(r.id)
    try {
      await updateDoc(doc(db, 'redemptions', r.id), {
        status: 'approved',
        collectedAt: null,
        collectedBy: null,
      })
      await load(tab)
      await loadCounts()
    } catch (err) {
      console.error('Error undoing collection:', err)
      alert('Failed to undo. Please try again.')
    } finally { setWorking(null) }
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
      await load(tab)
      await loadCounts()
    } finally { setWorking(null) }
  }

  const tabs = [
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'approved', label: 'Approved', count: counts.approved },
    { key: 'collected', label: 'Collected', count: counts.collected },
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
  ]

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-6xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-black text-gray-900 mb-1">Redemption Requests</h1>

      {/* Tabs with counts */}
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black capitalize transition-all"
            style={tab === t.key
              ? { background: '#CC0000', color: '#fff' }
              : { background: '#fff', color: '#666', border: '2px solid #e5e7eb' }}>
            {t.label}
            {t.count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-black"
                style={tab === t.key
                  ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                  : { background: t.key === 'pending' ? '#FFE600' : '#f3f4f6', color: t.key === 'pending' ? '#CC0000' : '#666' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3 max-w-2xl">
        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-bold text-red-800">Error loading redemptions</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        )}
        
        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <Clock size={40} className="mx-auto mb-2 opacity-20 animate-spin" />
            <p>Loading...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Clock size={40} className="mx-auto mb-2 opacity-20" />
            <p>No {tab} requests.</p>
          </div>
        ) : null}
        {items.map(r => (
          <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
                    <p className="text-xs mt-1 font-mono text-gray-600 break-all">
                      🔖 {r.barcode}
                      {r.maxValue != null && <span className="text-gray-400"> · max ฿{r.maxValue}</span>}
                    </p>
                  )}
                  {r.product?.name && (
                    <p className="text-xs mt-0.5 text-gray-600">📦 {r.product.name}{r.product.price != null && <span className="text-gray-400"> · ฿{r.product.price}</span>}</p>
                  )}
                  {r.status === 'rejected' && r.failureCode && (
                    <p className="text-xs mt-0.5 font-bold" style={{ color: '#CC0000' }}>⚠ {r.failureCode}{r.failureMessage ? `: ${r.failureMessage}` : ''}</p>
                  )}
                </div>
              </div>

              {tab === 'pending' ? (
                <div className="flex flex-col gap-2 shrink-0">
                  <button onClick={() => approve(r)} disabled={working === r.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black transition-colors disabled:opacity-50"
                    style={{ background: '#F0FFF4', color: '#16a34a' }}>
                    <CheckCircle size={15} /> Approve
                  </button>
                  <button onClick={() => openReject(r)} disabled={working === r.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black transition-colors disabled:opacity-50"
                    style={{ background: '#FFF0F0', color: '#CC0000' }}>
                    <XCircle size={15} /> Reject
                  </button>
                </div>
              ) : (
                <div className="shrink-0 text-right flex flex-col items-end gap-2">
                  <span className="text-xs font-black px-3 py-1.5 rounded-full"
                    style={STATUS_STYLE[r.status] ? { background: STATUS_STYLE[r.status].bg, color: STATUS_STYLE[r.status].color } : {}}>
                    {STATUS_STYLE[r.status]?.label}
                  </span>
                  {r.status === 'approved' && (
                    <button onClick={() => markCollected(r)} disabled={working === r.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black transition-colors disabled:opacity-50"
                      style={{ background: '#EEF6FF', color: '#1d4ed8' }}>
                      <CheckCircle size={15} /> Mark collected
                    </button>
                  )}
                  {r.status === 'collected' && (
                    <button onClick={() => undoCollected(r)} disabled={working === r.id}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-black transition-colors disabled:opacity-50"
                      style={{ background: '#F3F4F6', color: '#4b5563' }}>
                      <RotateCcw size={15} /> Undo
                    </button>
                  )}
                  {r.rejectNote && (
                    <p className="text-xs text-gray-400 mt-1 max-w-32">Note: {r.rejectNote}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

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
