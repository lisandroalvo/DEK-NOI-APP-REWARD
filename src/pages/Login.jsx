import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PageTransition from '../components/PageTransition'
import logo from '../assets/logo.png'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
    </svg>
  )
}

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    setGLoading(true)
    try {
      await loginWithGoogle()
      navigate('/')
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setError('Google sign-in failed. Please try again.')
    } finally {
      setGLoading(false)
    }
  }

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white overflow-x-hidden">
        <div className="fixed top-0 left-0 right-0 z-10">
          <div className="h-2 sm:h-3" style={{ background: '#CC0000' }} />
          <div className="h-2 sm:h-3" style={{ background: '#FFE600' }} />
        </div>

        <div className="w-full max-w-sm">
        <div className="flex justify-center mb-4">
          <img src={logo} alt="DEK NOI" className="h-28 sm:h-36 w-auto object-contain" />
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8">
          <h2 className="text-xl font-black text-gray-900 mb-1">Welcome back!</h2>
          <p className="text-sm text-gray-500 mb-6">Sign in to your Rewards account</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
          )}

          {/* Google button */}
          <button onClick={handleGoogle} disabled={gLoading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors mb-4 disabled:opacity-60">
            <GoogleIcon />
            {gLoading ? 'Signing in…' : 'Continue with Google'}
          </button>

          <p className="text-[11px] text-gray-400 text-center mb-4 -mt-1 leading-snug">
            By continuing with Google, you agree to our{' '}
            <Link to="/privacy" target="_blank" className="font-bold hover:underline" style={{ color: '#CC0000' }}>
              Privacy Policy
            </Link>
            {' '}/ เมื่อดำเนินการต่อ ถือว่าคุณยอมรับนโยบายความเป็นส่วนตัว
          </p>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@email.com"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                onFocus={e => e.target.style.borderColor = '#CC0000'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none transition-colors"
                onFocus={e => e.target.style.borderColor = '#CC0000'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-black text-white disabled:opacity-60"
              style={{ background: '#CC0000' }}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            New member?{' '}
            <Link to="/register" className="font-black hover:underline" style={{ color: '#CC0000' }}>
              Join for free!
            </Link>
          </p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0">
        <div className="h-3" style={{ background: '#CC0000' }} />
        <div className="h-3" style={{ background: '#FFE600' }} />
      </div>
      </div>
    </PageTransition>
  )
}
