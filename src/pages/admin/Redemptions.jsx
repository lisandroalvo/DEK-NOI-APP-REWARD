import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy, doc, updateDoc, serverTimestamp, addDoc, increment } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { CheckCircle, XCircle, Clock, X } from 'lucide-react'

const STATUS_STYLE = {
  approved: { bg: '#F0FFF4', color: '#16a34a', label: '✅ Approved' },
  rejected: { bg: '#FFF0F0', color: '#CC0000', label: '❌ Rejected' },
}

export default function AdminRedemptions() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 })
  const [tab, setTab] = useState('pending')
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectNote, setRejectNote] = useState('')
  const [working, setWorking] = useState(null)

  const load = async (status) => {
    const snap = await getDocs(query(collection(db, 'redemptions'), where('status', '==', status), orderBy('requestedAt', 'desc')))
    setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  const loadCounts = async () => {
    const [p, a, r] = await Promise.all([
      getDocs(query(collection(db, 'redemptions'), where('status', '==', 'pending'))),
      getDocs(query(collection(db, 'redemptions'), where('status', '==', 'approved'))),
      getDocs(query(collection(db, 'redemptions'), where('status', '==', 'rejected'))),
    ])
    setCounts({ pending: p.size, approved: a.size, rejected: r.size })
  }

  useEffect(() => { load(tab) }, [tab])
  useEffect(() => { loadCounts() }, [])

  const approve = async (r) => {
    if (!confirm(`Approve "${r.rewardName}" for ${r.userName}?\nThis will deduct ${r.pointsCost} points from their account.`)) return
    setWorking(r.id)
    try {
      await updateDoc(doc(db, 'redemptions', r.id), { status: 'approved', reviewedAt: serverTimestamp(), reviewedBy: user.uid })
      await updateDoc(doc(db, 'users', r.userId), { points: increment(-r.pointsCost) })
      await addDoc(collection(db, 'pointTransactions'), {
        userId: r.userId,
        points: -r.pointsCost,
        reason: `Redeemed: ${r.rewardName}`,
        addedBy: user.uid,
        createdAt: serverTimestamp(),
      })
      await load(tab)
      await loadCounts()
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
    { key: 'rejected', label: 'Rejected', count: counts.rejected },
  ]

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Redemption Requests</h1>

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
        {items.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Clock size={40} className="mx-auto mb-2 opacity-20" />
            <p>No {tab} requests.</p>
          </div>
        )}
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
                <div className="shrink-0 text-right">
                  <span className="text-xs font-black px-3 py-1.5 rounded-full"
                    style={STATUS_STYLE[r.status] ? { background: STATUS_STYLE[r.status].bg, color: STATUS_STYLE[r.status].color } : {}}>
                    {STATUS_STYLE[r.status]?.label}
                  </span>
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
