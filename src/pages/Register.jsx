import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authErrorMessage, passwordError } from '../lib/authForm'
import logo from '../assets/logo.png'
import charHappy from '../assets/char-happy.png'

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

export default function Register() {
  const [form, setForm]         = useState({ name: '', phone: '', email: '', password: '' })
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const pwError = passwordError(form.password)
    if (pwError) { setError(pwError); return }
    setLoading(true)
    try {
      await register(form.email, form.password, form.name, form.phone)
      navigate('/dashboard')
    } catch (err) {
      setError(authErrorMessage(err.code, 'Registration failed.'))
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

  const fields = [
    { label: 'Full Name',       key: 'name',     type: 'text',     placeholder: 'John Doe' },
    { label: 'Phone Number',    key: 'phone',    type: 'tel',      placeholder: '+66 00 000 0000' },
    { label: 'Email Address',   key: 'email',    type: 'email',    placeholder: 'you@email.com' },
    { label: 'Password',        key: 'password', type: 'password', placeholder: '8+ characters' },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-white">
      <div className="fixed top-0 left-0 right-0">
        <div className="h-3" style={{ background: '#CC0000' }} />
        <div className="h-3" style={{ background: '#FFE600' }} />
      </div>

      <div className="w-full max-w-sm">
        <div className="flex items-end justify-center gap-2 mb-4">
          <img src={logo} alt="DEK NOI" className="h-24 w-auto object-contain" />
          <img src={charHappy} alt="" className="h-28 w-auto object-contain" />
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          <h2 className="text-xl font-black text-gray-900 mb-1">Join Rewards Club</h2>
          <p className="text-sm text-gray-500 mb-5">Earn points with every purchase!</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>
          )}

          {/* Google button */}
          <button onClick={handleGoogle} disabled={gLoading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors mb-4 disabled:opacity-60">
            <GoogleIcon />
            {gLoading ? 'Signing up…' : 'Sign up with Google'}
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or fill in manually</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {fields.map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
                <input type={type} value={form[key]} onChange={set(key)} required placeholder={placeholder}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
                  onFocus={e => e.target.style.borderColor = '#CC0000'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
            ))}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-black text-white disabled:opacity-60 mt-1"
              style={{ background: '#CC0000' }}>
              {loading ? 'Creating account…' : 'Create My Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            Already a member?{' '}
            <Link to="/login" className="font-black hover:underline" style={{ color: '#CC0000' }}>Sign In</Link>
          </p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0">
        <div className="h-3" style={{ background: '#CC0000' }} />
        <div className="h-3" style={{ background: '#FFE600' }} />
      </div>
    </div>
  )
}
