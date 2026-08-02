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
            {r.barcode && (
              <p className="text-[11px] text-gray-400 mt-0.5 font-mono break-all">🔖 {r.barcode}</p>
            )}
            {r.product?.name && (
              <p className="text-[11px] text-gray-500 mt-0.5">📦 {r.product.name}</p>
            )}
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
