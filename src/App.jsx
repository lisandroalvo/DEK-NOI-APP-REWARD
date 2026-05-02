import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import SplashScreen from './components/SplashScreen'
import Login from './pages/Login'
import Register from './pages/Register'

// Customer pages
import CustomerDashboard from './pages/customer/Dashboard'
import CustomerRewards from './pages/customer/Rewards'
import MyRedemptions from './pages/customer/MyRedemptions'
import CustomerPromos from './pages/customer/Promos'

// Admin pages
import AdminDashboard from './pages/admin/Dashboard'
import AdminCustomers from './pages/admin/Customers'
import AdminRewards from './pages/admin/Rewards'
import AdminRedemptions from './pages/admin/Redemptions'
import AdminPromos from './pages/admin/Promos'
import AdminActivity from './pages/admin/Activity'

import './index.css'

function RequireAuth({ children, adminOnly = false }) {
  const { user, profile } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && profile?.role !== 'admin') return <Navigate to="/dashboard" replace />
  if (!adminOnly && profile?.role === 'admin') return <Navigate to="/admin" replace />
  return children
}

function Root() {
  const { user, profile } = useAuth()
  const [showSplash, setShowSplash] = useState(false)

  useEffect(() => {
    console.log('🎬 Root useEffect - user:', !!user, 'hasSeenSplash:', sessionStorage.getItem('hasSeenSplash'))
    // Show splash screen when user just logged in
    if (user && !sessionStorage.getItem('hasSeenSplash')) {
      console.log('✅ Showing splash screen!')
      setShowSplash(true)
    }
  }, [user])

  const handleSplashComplete = () => {
    console.log('🎉 Splash complete!')
    sessionStorage.setItem('hasSeenSplash', 'true')
    setShowSplash(false)
  }

  if (!user) {
    console.log('❌ No user, redirecting to login')
    return <Navigate to="/login" replace />
  }
  
  if (showSplash) {
    console.log('🎪 Rendering splash screen')
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  console.log('➡️ Redirecting to dashboard/admin')
  return <Navigate to={profile?.role === 'admin' ? '/admin' : '/dashboard'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Customer routes */}
          <Route path="/dashboard" element={<RequireAuth><Layout><CustomerDashboard /></Layout></RequireAuth>} />
          <Route path="/rewards" element={<RequireAuth><Layout><CustomerRewards /></Layout></RequireAuth>} />
          <Route path="/my-redemptions" element={<RequireAuth><Layout><MyRedemptions /></Layout></RequireAuth>} />
          <Route path="/promos" element={<RequireAuth><Layout><CustomerPromos /></Layout></RequireAuth>} />

          {/* Admin routes */}
          <Route path="/admin" element={<RequireAuth adminOnly><Layout><AdminDashboard /></Layout></RequireAuth>} />
          <Route path="/admin/customers" element={<RequireAuth adminOnly><Layout><AdminCustomers /></Layout></RequireAuth>} />
          <Route path="/admin/rewards" element={<RequireAuth adminOnly><Layout><AdminRewards /></Layout></RequireAuth>} />
          <Route path="/admin/redemptions" element={<RequireAuth adminOnly><Layout><AdminRedemptions /></Layout></RequireAuth>} />
          <Route path="/admin/promos" element={<RequireAuth adminOnly><Layout><AdminPromos /></Layout></RequireAuth>} />
          <Route path="/admin/activity" element={<RequireAuth adminOnly><Layout><AdminActivity /></Layout></RequireAuth>} />

          <Route path="*" element={<Root />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
