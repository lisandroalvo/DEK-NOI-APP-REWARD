import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut, Star, Gift, Users, LayoutDashboard, ShoppingBag, TrendingUp, Menu, X, User, Receipt } from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { usePointsNotification } from '../hooks/usePointsNotification'
import { useBillNotifications } from '../hooks/useBillNotifications'
import { usePendingBillCount } from '../hooks/usePendingBillCount'
import { initAudio } from '../utils/soundEffects'
import BillNotificationToast from './BillNotificationToast'
import logo from '../assets/logo.png'

function CompleteProfileModal({ userId }) {
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!phone.trim()) return
    setSaving(true)
    await updateDoc(doc(db, 'users', userId), { phone: phone.trim() })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">📱</div>
          <h2 className="text-lg font-black text-gray-900">One more thing!</h2>
          <p className="text-sm text-gray-500 mt-1">Add your phone number so we can reach you about your rewards.</p>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
          <input
            type="tel" value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="+66 00 000 0000" autoFocus
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"
            onFocus={e => e.target.style.borderColor = '#CC0000'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            onKeyDown={e => e.key === 'Enter' && save()}
          />
        </div>
        <button onClick={save} disabled={saving || !phone.trim()}
          className="w-full py-3 rounded-xl text-sm font-black text-white disabled:opacity-50"
          style={{ background: '#CC0000' }}>
          {saving ? 'Saving…' : 'Save & Continue'}
        </button>
        <button onClick={() => updateDoc(doc(db, 'users', userId), { phone: '-' })}
          className="w-full mt-2 py-2 text-xs text-gray-400 hover:text-gray-600">
          Skip for now
        </button>
      </div>
    </div>
  )
}

export default function Layout({ children }) {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isAdmin = profile?.role === 'admin'
  const [mobileOpen, setMobileOpen] = useState(false)

  // Initialize audio on first interaction
  useEffect(() => {
    const handleInteraction = () => {
      initAudio()
      // Remove listeners after first interaction
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('touchstart', handleInteraction)
    }
    
    document.addEventListener('click', handleInteraction)
    document.addEventListener('touchstart', handleInteraction)
    
    return () => {
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('touchstart', handleInteraction)
    }
  }, [])

  // Enable points notification sound for customers
  usePointsNotification(!isAdmin ? user?.uid : null)

  // Enable bill status notifications for customers
  const { notification: billNotification, clearNotification: clearBillNotification } = useBillNotifications(!isAdmin ? user?.uid : null)

  // Live count of bills awaiting review — badge on the admin Bill Review nav item.
  const pendingBills = usePendingBillCount(isAdmin)

  const needsPhone = !isAdmin && profile && !profile.phone

  const adminLinks = [
    { to: '/admin',              icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/admin/bills',        icon: <Receipt size={18} />,         label: 'Bill Review', badge: pendingBills },
    { to: '/admin/customers',    icon: <Users size={18} />,           label: 'Customers' },
    { to: '/admin/rewards',      icon: <Gift size={18} />,            label: 'Rewards' },
    { to: '/admin/redemptions',  icon: <ShoppingBag size={18} />,     label: 'Redemptions' },
    { to: '/admin/activity',     icon: <TrendingUp size={18} />,      label: 'Activity Log' },
  ]

  const customerLinks = [
    { to: '/dashboard',      icon: <Star size={22} />,        label: 'My Points' },
    { to: '/rewards',        icon: <Gift size={22} />,        label: 'Rewards' },
    { to: '/my-redemptions', icon: <ShoppingBag size={22} />, label: 'My Orders' },
    { to: '/profile',        icon: <User size={22} />,        label: 'Profile' },
  ]

  const links = isAdmin ? adminLinks : customerLinks

  const doLogout = async () => { await logout(); navigate('/login') }

  // A render helper rather than a nested component: called inline below so React
  // doesn't remount it (and reset any future state) on every Layout render.
  const renderSidebar = (onLinkClick) => (
    <>
      {/* Logo + Profile */}
      <div className="p-4 border-b-2 shrink-0" style={{ borderColor: '#FFE600' }}>
        {/* Profile Picture */}
        <div className="flex justify-center mb-3">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-red-600">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-100 to-red-200">
                <User size={28} className="text-red-600" />
              </div>
            )}
          </div>
        </div>
        
        <img src={logo} alt="DEK NOI" className="h-16 w-auto mx-auto object-contain" />
        <p className="text-center text-xs font-bold mt-1" style={{ color: '#CC0000' }}>
          {isAdmin ? '— Admin Panel —' : '— Rewards Club —'}
        </p>
        {!isAdmin && (
          <div className="flex items-center justify-center gap-1.5 mt-2 rounded-full px-3 py-1" style={{ background: '#FFE600' }}>
            <Star size={12} style={{ color: '#CC0000' }} fill="currentColor" />
            <span className="text-xs font-black" style={{ color: '#CC0000' }}>{(profile?.points ?? 0).toLocaleString()} pts</span>
          </div>
        )}
        <p className="text-center text-xs text-gray-400 mt-1 truncate">{profile?.name}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {links.map(({ to, icon, label, badge }) => {
          const active = pathname === to
          return (
            <Link key={to} to={to} onClick={onLinkClick}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={active ? { background: '#CC0000', color: '#fff' } : { color: '#444' }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#FFF0F0' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
              {icon}
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-black flex items-center justify-center"
                  style={active ? { background: '#fff', color: '#CC0000' } : {}}>
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom stripe + logout */}
      <div className="shrink-0">
        <div className="h-2 w-full" style={{ background: '#CC0000' }} />
        <div className="h-2 w-full" style={{ background: '#FFE600' }} />
        <div className="p-3">
          <button onClick={doLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 transition-all">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-60 flex-col shrink-0 bg-white border-r-4" style={{ borderColor: '#CC0000' }}>
        {renderSidebar(() => {})}
      </aside>

      {/* ── Mobile header bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b-2 flex items-center justify-between px-4 py-2.5"
        style={{ borderColor: '#CC0000' }}>
        <img src={logo} alt="DEK NOI" className="h-10 w-auto object-contain" />
        <div className="flex items-center gap-3">
          {!isAdmin && (
            <div className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black" style={{ background: '#FFE600', color: '#CC0000' }}>
              <Star size={11} fill="currentColor" /> {(profile?.points ?? 0).toLocaleString()}
            </div>
          )}
          <button onClick={() => setMobileOpen(true)} className="p-1">
            <Menu size={24} style={{ color: '#CC0000' }} />
          </button>
        </div>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-white flex flex-col border-r-4 h-full" style={{ borderColor: '#CC0000' }}>
            <button onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-1 rounded-lg hover:bg-gray-100">
              <X size={20} className="text-gray-500" />
            </button>
            {renderSidebar(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      {/* ── Bottom tab bar (mobile only) with floating center button ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 shadow-2xl" style={{ background: '#CC0000', height: '75px' }}>
        <div className="relative flex h-full">
          {/* Left side buttons */}
          <div className="flex-1 flex">
            {links.slice(0, 2).map(({ to, icon, label, badge }) => {
              const active = pathname === to
              return (
                <Link key={to} to={to}
                  className="relative flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all"
                  style={{ color: active ? '#FFE600' : 'rgba(255, 255, 255, 0.7)' }}>
                  <span style={{ transform: active ? 'scale(1.2)' : 'scale(1)' }}>
                    {icon}
                  </span>
                  <span className="truncate px-1">{label}</span>
                  {badge > 0 && (
                    <span className="absolute top-1 right-1/4 min-w-4 h-4 px-1 rounded-full bg-yellow-400 text-red-800 text-[10px] font-black flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Center floating button */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-6">
            <Link to="/scan-bill"
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95"
              style={{ 
                background: 'linear-gradient(135deg, #FFE600 0%, #FFA500 100%)',
                border: '4px solid #CC0000'
              }}>
              <span className="text-3xl">📄</span>
            </Link>
          </div>

          {/* Right side buttons */}
          <div className="flex-1 flex">
            {links.slice(2, 4).map(({ to, icon, label }) => {
              const active = pathname === to
              return (
                <Link key={to} to={to}
                  className="flex-1 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all"
                  style={{ 
                    color: active ? '#FFE600' : 'rgba(255, 255, 255, 0.7)',
                  }}>
                  <span style={{ transform: active ? 'scale(1.2)' : 'scale(1)' }}>
                    {icon}
                  </span>
                  <span className="truncate px-1">{label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 pt-14 sm:pt-16 pb-28 md:pt-0 md:pb-0">
        {children}
      </main>

      {/* ── Bill notification toast ── */}
      <BillNotificationToast 
        notification={billNotification} 
        onClose={clearBillNotification} 
      />

      {/* ── Phone number collection for Google sign-in ── */}
      {needsPhone && <CompleteProfileModal userId={user.uid} />}
    </div>
  )
}
