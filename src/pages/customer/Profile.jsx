import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { User, Mail, Phone, Camera, Save, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ImageUploadSimple from '../../components/ImageUploadSimple'

export default function Profile() {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    photoURL: profile?.photoURL || null,
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: form.name,
        phone: form.phone,
        photoURL: form.photoURL,
      })
      setEditing(false)
      window.location.reload() // Refresh to update profile
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black text-gray-900 mb-6">My Profile</h1>

      {/* Profile Card */}
      <div className="bg-white rounded-3xl shadow-lg border-2 overflow-hidden mb-6" style={{ borderColor: '#CC0000' }}>
        {/* Header with gradient */}
        <div className="h-32 relative" style={{ background: 'linear-gradient(135deg, #CC0000 0%, #FF3333 100%)' }}>
          <div className="absolute -bottom-16 left-6">
            <div className="relative">
              {/* Profile Photo */}
              <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden bg-gray-100 shadow-xl">
                {form.photoURL ? (
                  <img src={form.photoURL} alt={form.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-100 to-red-200">
                    <User size={48} className="text-red-400" />
                  </div>
                )}
              </div>
              {editing && (
                <div className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center cursor-pointer"
                  style={{ border: '2px solid #CC0000' }}>
                  <Camera size={18} style={{ color: '#CC0000' }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pt-20 p-6">
          {editing ? (
            <div className="space-y-4 mb-6">
              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Profile Photo</label>
                <ImageUploadSimple
                  value={form.photoURL}
                  onChange={(url) => setForm(f => ({ ...f, photoURL: url }))}
                  label="Upload Photo"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"
                  onFocus={e => e.target.style.borderColor = '#CC0000'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"
                  onFocus={e => e.target.style.borderColor = '#CC0000'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900">{profile?.name}</h2>
                <p className="text-sm text-gray-500">{profile?.role === 'admin' ? 'Administrator' : 'Customer'}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-gray-600">
                  <Mail size={18} className="text-gray-400" />
                  <span className="text-sm">{user?.email}</span>
                </div>
                {profile?.phone && profile.phone !== '-' && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Phone size={18} className="text-gray-400" />
                    <span className="text-sm">{profile.phone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {editing ? (
              <>
                <button
                  onClick={() => {
                    setEditing(false)
                    setForm({
                      name: profile?.name || '',
                      phone: profile?.phone || '',
                      photoURL: profile?.photoURL || null,
                    })
                  }}
                  className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: '#CC0000' }}>
                  <Save size={16} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex-1 py-3 rounded-xl text-sm font-black text-white"
                style={{ background: '#CC0000' }}>
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Card */}
      {profile?.role !== 'admin' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h3 className="font-black text-gray-900 mb-4">Your Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-xl" style={{ background: '#FFF0F0' }}>
              <p className="text-3xl font-black" style={{ color: '#CC0000' }}>{profile?.points || 0}</p>
              <p className="text-xs text-gray-500 font-semibold mt-1">Total Points</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gray-50">
              <p className="text-3xl font-black text-gray-900">-</p>
              <p className="text-xs text-gray-500 font-semibold mt-1">Rewards Claimed</p>
            </div>
          </div>
        </div>
      )}

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-full py-3 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
        <LogOut size={16} />
        Sign Out
      </button>
    </div>
  )
}
