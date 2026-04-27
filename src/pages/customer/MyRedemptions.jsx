import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import lineQr from '../../assets/line-qr.png'
import charSitting from '../../assets/char-sitting.png'

const STATUS = {
  pending:  { bg: '#FFF9E0', color: '#CC7700', label: '⏳ Pending Approval',   desc: 'Admin will review your request shortly.' },
  approved: { bg: '#F0FFF4', color: '#16a34a', label: '✅ Approved',            desc: 'Visit the store to collect your reward!' },
  rejected: { bg: '#FFF0F0', color: '#CC0000', label: '❌ Not Approved',        desc: 'Contact us on LINE if you have questions.' },
}


export default function MyRedemptions() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db, 'redemptions'), where('userId', '==', user.uid), orderBy('requestedAt', 'desc')))
      .then(snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) })
  }, [user])

  const pending = items.filter(i => i.status === 'pending')
  const done    = items.filter(i => i.status !== 'pending')

  return (
    <div className="p-6 md:p-8 max-w-lg">
      <h1 className="text-2xl font-black text-gray-900 mb-6">My Redemptions</h1>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <img src={charSitting} alt="" className="h-36 mx-auto mb-2" />
          <p className="font-medium mb-2">No redemptions yet</p>
          <Link to="/rewards" className="text-sm font-black hover:underline" style={{ color: '#CC0000' }}>Browse Rewards →</Link>
        </div>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Pending</p>
              <div className="space-y-3">
                {pending.map(r => <RedemptionCard key={r.id} r={r} />)}
              </div>
            </div>
          )}

          {/* History */}
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
