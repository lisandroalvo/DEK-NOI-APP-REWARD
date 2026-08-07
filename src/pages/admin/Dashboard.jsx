import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { Users, Gift, ShoppingBag, Star, TrendingUp, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { outcomeOf } from '../../lib/redemptions'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ customers: 0, rewards: 0, attention: 0, totalPoints: 0 })
  const [recentRedemptions, setRecentRedemptions] = useState([])
  const [recentTx, setRecentTx] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [customers, rewards, reserving, pending, redemptions, transactions] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('role', '==', 'customer'))),
        getDocs(query(collection(db, 'rewards'), where('available', '==', true))),
        getDocs(query(collection(db, 'redemptions'), where('status', '==', 'reserving'))),
        getDocs(query(collection(db, 'redemptions'), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'redemptions'), orderBy('requestedAt', 'desc'), limit(5))),
        getDocs(query(collection(db, 'pointTransactions'), orderBy('createdAt', 'desc'), limit(5))),
      ])
      setStats({
        customers: customers.size,
        rewards: rewards.size,
        attention: reserving.size + pending.size,
        totalPoints: customers.docs.reduce((a, d) => a + (d.data().points || 0), 0),
      })
      setRecentRedemptions(redemptions.docs.map(d => ({ id: d.id, ...d.data() })))
      setRecentTx(transactions.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    load()
  }, [])

  const statCards = [
    { label: 'Total Members', value: stats.customers, icon: <Users size={20} />, accent: '#CC0000', to: '/admin/customers' },
    { label: 'Active Rewards', value: stats.rewards, icon: <Gift size={20} />, accent: '#CC7700', to: '/admin/rewards' },
    { label: 'Needs attention', value: stats.attention, icon: <ShoppingBag size={20} />, accent: stats.attention > 0 ? '#CC0000' : '#888', to: '/admin/redemptions' },
    { label: 'Points Distributed', value: stats.totalPoints.toLocaleString(), icon: <Star size={20} />, accent: '#CC7700', to: null },
  ]

  const outcomeStyle = {
    completed: { bg: '#F0FFF4', color: '#16a34a', label: '✅ Completed' },
    rejected:  { bg: '#FFF0F0', color: '#CC0000', label: '❌ Rejected' },
    stuck:     { bg: '#FFF9E0', color: '#CC7700', label: '⏳ Stuck' },
    other:     { bg: '#F3F4F6', color: '#4b5563', label: '•' },
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-6xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-black text-gray-900 mb-1">Admin Dashboard</h1>
      <p className="text-gray-400 text-sm mb-6">DEK NOI Rewards — overview</p>

      {stats.attention > 0 && (
        <Link to="/admin/redemptions"
          className="flex items-center justify-between mb-6 p-4 rounded-2xl border-2"
          style={{ background: '#FFF9E0', borderColor: '#FFE600' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-black text-sm" style={{ color: '#CC7700' }}>
                {stats.attention} redemption{stats.attention > 1 ? 's' : ''} need{stats.attention > 1 ? '' : 's'} attention
              </p>
              <p className="text-xs text-gray-500">Tap to review stuck or unprocessed redemptions</p>
            </div>
          </div>
          <ChevronRight size={18} style={{ color: '#CC7700' }} />
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(c => {
          const card = (
            <div className="bg-white rounded-2xl shadow-sm border-t-4 p-5 hover:shadow-md transition-shadow"
              style={{ borderColor: c.accent }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white mb-3" style={{ background: c.accent }}>
                {c.icon}
              </div>
              <p className="text-2xl font-black text-gray-900">{loading ? '…' : c.value}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{c.label}</p>
            </div>
          )
          return c.to
            ? <Link key={c.label} to={c.to}>{card}</Link>
            : <div key={c.label}>{card}</div>
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent redemptions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag size={16} className="text-gray-400" />
              <h2 className="font-black text-gray-700">Recent Redemptions</h2>
            </div>
            <Link to="/admin/redemptions" className="text-xs font-black hover:underline" style={{ color: '#CC0000' }}>View all →</Link>
          </div>
          {recentRedemptions.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">No redemptions yet</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentRedemptions.map(r => {
                const s = outcomeStyle[outcomeOf(r.status)]
                return (
                  <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{r.rewardName}</p>
                      <p className="text-xs text-gray-400">{r.userName} · ⭐ {r.pointsCost} pts</p>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-full shrink-0" style={{ background: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Recent transactions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-gray-400" />
              <h2 className="font-black text-gray-700">Recent Point Activity</h2>
            </div>
            <Link to="/admin/activity" className="text-xs font-black hover:underline" style={{ color: '#CC0000' }}>View all →</Link>
          </div>
          {recentTx.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">No transactions yet</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentTx.map(t => (
                <li key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{t.reason || 'Points added'}</p>
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
      </div>
    </div>
  )
}
