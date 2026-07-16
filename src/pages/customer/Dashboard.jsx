import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { BAHT_PER_POINT } from '../../lib/points'
import { useAuth } from '../../context/AuthContext'
import { Star, TrendingUp, Gift, Clock, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import SupportButton from '../../components/SupportButton'
import charHappy from '../../assets/char-happy.png'
import Toast from '../../components/Toast'
import { useRedemptionNotifications } from '../../hooks/useRedemptionNotifications'
import WelcomeBanner from '../../components/WelcomeBanner'

export default function CustomerDashboard() {
  const { user, profile } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [txError, setTxError] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [rewards, setRewards] = useState([])
  const { notification, clearNotification } = useRedemptionNotifications(user?.uid)

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db, 'pointTransactions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')))
      .then(snap => { setTxError(false); setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))) })
      .catch(err => {
        // Surface the failure instead of silently rendering zeros — a failed query
        // here (e.g. a missing composite index) must not look like "no activity".
        console.error('Failed to load point transactions:', err)
        setTxError(true)
      })
    getDocs(query(collection(db, 'redemptions'), where('userId', '==', user.uid), where('status', '==', 'pending')))
      .then(snap => setPendingCount(snap.size))
    getDocs(query(collection(db, 'rewards'), where('available', '==', true)))
      .then(snap => setRewards(snap.docs.map(d => d.data()).sort((a, b) => a.pointsCost - b.pointsCost)))
  }, [user])

  const pts = profile?.points ?? 0
  const earned = transactions.filter(t => t.points > 0).reduce((a, t) => a + t.points, 0)
  const redeemed = Math.abs(transactions.filter(t => t.points < 0).reduce((a, t) => a + t.points, 0))

  // Progress toward the next point from carried-over spend (spendCarry is 0..BAHT_PER_POINT-1).
  const carry = profile?.spendCarry ?? 0
  const toNextPoint = BAHT_PER_POINT - carry
  const carryPct = (carry / BAHT_PER_POINT) * 100

  // Next reward to unlock: the cheapest available reward the customer can't yet
  // afford. The bar runs from the last reward they've cleared to that next one, so
  // earning always moves it forward and redeeming never pushes it backward.
  const affordable = rewards.filter(r => r.pointsCost <= pts)
  const nextReward = rewards.find(r => r.pointsCost > pts) || null
  const prevThreshold = affordable.length ? affordable[affordable.length - 1].pointsCost : 0
  const rewardPct = rewards.length === 0
    ? 0
    : nextReward
      ? Math.min(((pts - prevThreshold) / (nextReward.pointsCost - prevThreshold)) * 100, 100)
      : 100

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl w-full mx-auto">
      {notification && (
        <Toast
          message={notification.message}
          type={notification.type}
          onClose={clearNotification}
          duration={8000}
        />
      )}
      
      {/* Profile Picture + Greeting */}
      <div className="flex items-center gap-4 mb-4 sm:mb-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-4 border-red-600 shrink-0 shadow-lg">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt={profile.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-100 to-red-200">
              <span className="text-3xl sm:text-4xl">👤</span>
            </div>
          )}
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-gray-900">Hi, {profile?.name?.split(' ')[0]} 👋</h1>
      </div>

      {/* Welcome banner (promos carousel hidden pre-MVP) */}
      <WelcomeBanner />

      {/* Game-like Points Card */}
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white mb-4 sm:mb-6 shadow-2xl relative overflow-hidden" 
        style={{ 
          background: 'linear-gradient(135deg, #CC0000 0%, #FF3333 100%)',
          boxShadow: '0 20px 60px rgba(204, 0, 0, 0.3)'
        }}>
        {/* Animated background elements */}
        <div className="absolute -top-6 -right-6 w-24 sm:w-32 h-24 sm:h-32 rounded-full opacity-20 animate-pulse" style={{ background: '#FFE600' }} />
        <div className="absolute -bottom-4 -left-4 w-20 sm:w-24 h-20 sm:h-24 rounded-full opacity-10 animate-pulse" style={{ background: '#FFE600', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-32 sm:w-40 h-32 sm:h-40 rounded-full opacity-5" style={{ background: '#FFE600', transform: 'translate(-50%, -50%)' }} />
        
        {/* Character */}
        <img src={charHappy} alt="" className="absolute -bottom-2 right-2 sm:right-3 h-24 sm:h-32 w-auto object-contain pointer-events-none drop-shadow-lg" />
        
        {/* Points Display */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Star size={18} fill="#FFE600" className="text-yellow-400 animate-pulse" />
            <p className="text-white/90 text-sm font-bold tracking-wide">POINTS BALANCE</p>
          </div>
          
          {/* Big Points Number */}
          <div className="flex items-baseline gap-2 sm:gap-3 mb-3 sm:mb-4">
            <span className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight drop-shadow-lg"
              style={{
                textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                animation: 'pulse 2s ease-in-out infinite'
              }}>
              {pts.toLocaleString()}
            </span>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black" style={{ color: '#FFE600' }}>PTS</span>
              <span className="text-xs text-white/70 font-bold">Available</span>
            </div>
          </div>
          
          {/* Level/Progress Bar */}
          <div className="bg-white/20 rounded-full h-3 mb-3 overflow-hidden backdrop-blur-sm">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
              style={{
                width: `${rewardPct}%`,
                background: 'linear-gradient(90deg, #FFE600 0%, #FFF200 100%)',
                boxShadow: '0 0 10px rgba(255, 230, 0, 0.5)'
              }}>
              <div className="absolute inset-0 opacity-50"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
                  animation: 'shimmer 2s infinite'
                }} />
            </div>
          </div>
          
          {/* Progress toward the next reward the customer can unlock */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-white/80">
              {rewards.length === 0
                ? 'Earn points to unlock rewards'
                : nextReward
                  ? `${(nextReward.pointsCost - pts).toLocaleString()} pts to unlock ${nextReward.emoji || '🎁'} ${nextReward.name}`
                  : 'You can redeem any reward! 🎉'}
            </span>
            {affordable.length > 0 && (
              <span className="font-black px-2 py-0.5 rounded-full text-xs whitespace-nowrap" style={{ background: '#FFE600', color: '#CC0000' }}>
                ⭐ {affordable.length} reward{affordable.length > 1 ? 's' : ''} ready
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress toward the next point (spend-based) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-black text-gray-900">🎯 ฿{toNextPoint} to your next point</p>
          <span className="text-xs font-bold text-gray-400">{carry}/{BAHT_PER_POINT}฿</span>
        </div>
        <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${carryPct}%`, background: 'linear-gradient(90deg, #CC0000 0%, #FF3333 100%)' }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">Every ฿{BAHT_PER_POINT} you spend earns 1 point — keep going!</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4" style={{ borderColor: '#CC0000' }}>
          <TrendingUp size={20} className="mb-2" style={{ color: '#CC0000' }} />
          <p className="text-2xl font-black text-gray-900">{txError ? '—' : earned.toLocaleString()}</p>
          <p className="text-xs text-gray-500 font-medium">Points Earned</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4" style={{ borderColor: '#FFE600' }}>
          <Gift size={20} className="mb-2" style={{ color: '#CC7700' }} />
          <p className="text-2xl font-black text-gray-900">{txError ? '—' : redeemed.toLocaleString()}</p>
          <p className="text-xs text-gray-500 font-medium">Points Redeemed</p>
        </div>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <Link to="/activity" className="flex items-center justify-between mb-5 p-4 rounded-2xl border-2" style={{ background: '#FFF9E0', borderColor: '#FFE600' }}>
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
        <Link to="/activity" className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F0FFF4' }}>
              <Gift size={20} style={{ color: '#16a34a' }} />
            </div>
            <div>
              <p className="font-black text-gray-900 text-sm">My Redemptions</p>
              <p className="text-xs text-gray-500">View your reward requests</p>
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
        {txError ? (
          <div className="p-8 text-center text-gray-400">
            <Star size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Couldn't load your activity right now. Please try again later.</p>
          </div>
        ) : transactions.length === 0 ? (
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

      {/* Support Button */}
      <SupportButton className="mt-8" />
    </div>
  )
}
