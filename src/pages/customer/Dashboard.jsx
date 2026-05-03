import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { Star, TrendingUp, Gift, Clock, ChevronRight, Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import lineQr from '../../assets/line-qr.png'
import charHappy from '../../assets/char-happy.png'
import Toast from '../../components/Toast'
import { useRedemptionNotifications } from '../../hooks/useRedemptionNotifications'
import PromoCarousel from '../../components/PromoCarousel'

export default function CustomerDashboard() {
  const { user, profile } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [promos, setPromos] = useState([])
  const { notification, clearNotification } = useRedemptionNotifications(user?.uid)

  useEffect(() => {
    if (!user) return
    getDocs(query(collection(db, 'pointTransactions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc')))
      .then(snap => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    getDocs(query(collection(db, 'redemptions'), where('userId', '==', user.uid), where('status', '==', 'pending')))
      .then(snap => setPendingCount(snap.size))
    // Load active promos (without orderBy to avoid index requirement)
    getDocs(query(collection(db, 'promos'), where('active', '==', true)))
      .then(snap => {
        const promosData = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            // Sort by createdAt in memory (newest first)
            const aTime = a.createdAt?.toMillis?.() || 0
            const bTime = b.createdAt?.toMillis?.() || 0
            return bTime - aTime
          })
        console.log('📢 Loaded promos for carousel:', promosData)
        console.log('📢 Number of active promos:', promosData.length)
        setPromos(promosData)
      })
      .catch(error => {
        console.error('❌ Error loading promos:', error)
        // Fallback: try loading all promos without filter
        getDocs(collection(db, 'promos'))
          .then(snap => {
            const allPromos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            console.log('📢 Loaded all promos (fallback):', allPromos)
            setPromos(allPromos)
          })
      })
  }, [user])

  const pts = profile?.points ?? 0
  const earned = transactions.filter(t => t.points > 0).reduce((a, t) => a + t.points, 0)
  const redeemed = Math.abs(transactions.filter(t => t.points < 0).reduce((a, t) => a + t.points, 0))

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      {notification && (
        <Toast
          message={notification.message}
          type={notification.type}
          onClose={clearNotification}
          duration={8000}
        />
      )}
      
      <h1 className="text-2xl font-black text-gray-900 mb-6">Hi, {profile?.name?.split(' ')[0]} 👋</h1>

      {/* Promo Carousel */}
      <PromoCarousel promos={promos} />

      {/* Game-like Points Card */}
      <div className="rounded-3xl p-6 text-white mb-6 shadow-2xl relative overflow-hidden" 
        style={{ 
          background: 'linear-gradient(135deg, #CC0000 0%, #FF3333 100%)',
          boxShadow: '0 20px 60px rgba(204, 0, 0, 0.3)'
        }}>
        {/* Animated background elements */}
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-20 animate-pulse" style={{ background: '#FFE600' }} />
        <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-10 animate-pulse" style={{ background: '#FFE600', animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-40 h-40 rounded-full opacity-5" style={{ background: '#FFE600', transform: 'translate(-50%, -50%)' }} />
        
        {/* Character */}
        <img src={charHappy} alt="" className="absolute -bottom-2 right-3 h-32 w-auto object-contain pointer-events-none drop-shadow-lg" />
        
        {/* Points Display */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Star size={18} fill="#FFE600" className="text-yellow-400 animate-pulse" />
            <p className="text-white/90 text-sm font-bold tracking-wide">POINTS BALANCE</p>
          </div>
          
          {/* Big Points Number */}
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-7xl font-black tracking-tight drop-shadow-lg"
              style={{
                textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                animation: 'pulse 2s ease-in-out infinite'
              }}>
              {pts.toLocaleString()}
            </span>
            <div className="flex flex-col">
              <span className="text-2xl font-black" style={{ color: '#FFE600' }}>PTS</span>
              <span className="text-xs text-white/70 font-bold">Available</span>
            </div>
          </div>
          
          {/* Level/Progress Bar */}
          <div className="bg-white/20 rounded-full h-3 mb-3 overflow-hidden backdrop-blur-sm">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
              style={{ 
                width: `${Math.min((pts % 1000) / 10, 100)}%`,
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
          
          {/* Next Milestone */}
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white/80">
              {pts < 1000 ? `${1000 - pts} pts to next milestone` : 'Milestone reached! 🎉'}
            </span>
            <span className="font-black px-2 py-0.5 rounded-full text-xs" style={{ background: '#FFE600', color: '#CC0000' }}>
              ⭐ VIP Member
            </span>
          </div>
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
        <Link to="/my-redemptions" className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
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
