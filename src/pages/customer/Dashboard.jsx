import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { Star, TrendingUp, Gift, Clock, ChevronRight, Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import lineQr from '../../assets/line-qr.png'
import charHappy from '../../assets/char-happy.png'

export default function CustomerDashboard() {
  const { user, profile } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db, 'pointTransactions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')))
      .then(snap => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    getDocs(query(collection(db, 'redemptions'), where('userId', '==', user.uid), where('status', '==', 'pending')))
      .then(snap => setPendingCount(snap.size))
  }, [user])

  const pts = profile?.points ?? 0
  const earned = transactions.filter(t => t.points > 0).reduce((a, t) => a + t.points, 0)
  const redeemed = Math.abs(transactions.filter(t => t.points < 0).reduce((a, t) => a + t.points, 0))

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <h1 className="text-2xl font-black text-gray-900 mb-6">Hi, {profile?.name?.split(' ')[0]} 👋</h1>

      {/* Points card */}
      <div className="rounded-3xl p-6 text-white mb-6 shadow-lg relative overflow-hidden" style={{ background: '#CC0000' }}>
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-20" style={{ background: '#FFE600' }} />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full opacity-10" style={{ background: '#FFE600' }} />
        <img src={charHappy} alt="" className="absolute -bottom-2 right-3 h-28 w-auto object-contain pointer-events-none" />
        <p className="text-red-200 text-sm mb-1 font-medium">Your Points Balance</p>
        <div className="flex items-end gap-2 mb-4">
          <span className="text-6xl font-black">{pts.toLocaleString()}</span>
          <span className="text-red-200 text-lg mb-2">pts</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: '#FFE600' }}>
          <Star size={14} fill="currentColor" /> DEK NOI Rewards Member
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4" style={{ borderColor: '#CC0000' }}>
          <TrendingUp size={20} className="mb-2" style={{ color: '#CC0000' }} />
          <p className="text-2xl font-black text-gray-900">{earned.toLocaleString()}</p>
          <p className="text-xs text-gray-500 font-medium">Points Earned</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4" style={{ borderColor: '#FFE600' }}>
          <Gift size={20} className="mb-2" style={{ color: '#CC7700' }} />
          <p className="text-2xl font-black text-gray-900">{redeemed.toLocaleString()}</p>
          <p className="text-xs text-gray-500 font-medium">Points Redeemed</p>
        </div>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <Link to="/my-redemptions" className="flex items-center justify-between mb-5 p-4 rounded-2xl border-2" style={{ background: '#FFF9E0', borderColor: '#FFE600' }}>
          <div className="flex items-center gap-3">
            <span className="text-xl">⏳</span>
            <div>
              <p className="font-black text-sm" style={{ color: '#CC7700' }}>
                {pendingCount} redemption{pendingCount > 1 ? 's' : ''} pending approval
              </p>
              <p className="text-xs text-gray-500">Tap to check status</p>
            </div>
          </div>
          <ChevronRight size={16} style={{ color: '#CC7700' }} />
        </Link>
      )}

      {/* Quick actions */}
      <div className="space-y-3 mb-6">
        <Link to="/rewards" className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#FFE600' }}>🎁</div>
            <div>
              <p className="font-black text-gray-900 text-sm">Rewards Store</p>
              <p className="text-xs text-gray-500">Redeem your points for gifts</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-400" />
        </Link>
        <Link to="/promos" className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#FFF0F0' }}>
              <Megaphone size={20} style={{ color: '#CC0000' }} />
            </div>
            <div>
              <p className="font-black text-gray-900 text-sm">Monthly Promos</p>
              <p className="text-xs text-gray-500">Earn bonus points this month</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-400" />
        </Link>
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Clock size={16} className="text-gray-400" />
          <h2 className="font-black text-gray-700">Recent Activity</h2>
        </div>
        {transactions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Star size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">No activity yet. Start shopping to earn points!</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {transactions.slice(0, 10).map(t => (
              <li key={t.id} className="px-4 py-3 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-gray-700">{t.reason || 'Points added'}</p>
                  <p className="text-xs text-gray-400">{t.createdAt?.toDate?.()?.toLocaleDateString() ?? '—'}</p>
                </div>
                <span className="font-black text-sm" style={{ color: t.points > 0 ? '#CC0000' : '#888' }}>
                  {t.points > 0 ? '+' : ''}{t.points} pts
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* LINE Help */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-5">
        <img src={lineQr} alt="LINE QR" className="w-20 h-20 object-contain rounded-xl" />
        <div>
          <p className="font-black text-gray-900 text-sm mb-0.5">Need help?</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Scan the QR code to contact us on <strong>LINE</strong> for any questions about your points or rewards.
          </p>
        </div>
      </div>
    </div>
  )
}
