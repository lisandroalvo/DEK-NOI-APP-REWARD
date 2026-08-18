import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { User, Mail, Phone, Camera, Save, LogOut, MessageCircle, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ImageUpload from '../../components/ImageUpload'
import lineChar from '../../assets/line-qr.png'
import { useT } from '../../i18n/LanguageContext'
import LanguageSwitcher from '../../components/LanguageSwitcher'

// Opening our LINE official account: chats for existing followers, and shows
// LINE's own add-friend screen for anyone who hasn't followed yet.
const LINE_URL = 'https://line.me/R/ti/p/@167fnbxs'

export default function Profile() {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useT()
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
      alert(t('profile.updateFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl w-full mx-auto">
      <h1 className="text-xl sm:text-2xl font-black text-gray-900 mb-4 sm:mb-6">{t('profile.title')}</h1>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border-2 overflow-hidden mb-4 sm:mb-6" style={{ borderColor: '#CC0000' }}>
        {/* Header with gradient */}
        <div className="h-24 sm:h-32 relative" style={{ background: 'linear-gradient(135deg, #CC0000 0%, #FF3333 100%)' }}>
          <div className="absolute -bottom-12 sm:-bottom-16 left-4 sm:left-6">
            <div className="relative">
              {/* Profile Photo */}
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white overflow-hidden bg-gray-100 shadow-xl">
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
        <div className="pt-16 sm:pt-20 p-4 sm:p-6">
          {editing ? (
            <div className="space-y-4 mb-6">
              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">{t('profile.profilePhoto')}</label>
                <ImageUpload
                  value={form.photoURL}
                  onChange={(url) => setForm(f => ({ ...f, photoURL: url }))}
                  label={t('profile.uploadPhoto')}
                  folder={`avatars/${user.uid}`}
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('profile.fullName')}</label>
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
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('profile.phoneNumber')}</label>
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
                <p className="text-sm text-gray-500">{profile?.role === 'admin' ? t('profile.administrator') : t('profile.customer')}</p>
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
                  {t('profile.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: '#CC0000' }}>
                  <Save size={16} />
                  {saving ? t('profile.saving') : t('profile.save')}
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex-1 py-3 rounded-xl text-sm font-black text-white"
                style={{ background: '#CC0000' }}>
                {t('profile.editProfile')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Card */}
      {profile?.role !== 'admin' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h3 className="font-black text-gray-900 mb-4">{t('profile.yourStats')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-xl" style={{ background: '#FFF0F0' }}>
              <p className="text-3xl font-black" style={{ color: '#CC0000' }}>{profile?.points || 0}</p>
              <p className="text-xs text-gray-500 font-semibold mt-1">{t('profile.totalPoints')}</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-gray-50">
              <p className="text-3xl font-black text-gray-900">-</p>
              <p className="text-xs text-gray-500 font-semibold mt-1">{t('profile.rewardsClaimed')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Contact Us - LINE */}
      <a
        href={LINE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 hover:shadow-md hover:border-gray-200 transition-all active:scale-[0.99]"
      >
        <h3 className="font-black text-gray-900 flex items-center gap-2 mb-4">
          <MessageCircle size={20} style={{ color: '#00B900' }} />
          {t('profile.contactLine')}
        </h3>
        <div className="flex items-center gap-4">
          <img src={lineChar} alt="" className="w-20 h-20 object-contain shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-700">{t('profile.tapToChat')}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('profile.getSupport')}</p>
          </div>
          <ChevronRight size={18} className="text-gray-400 shrink-0 ml-auto" />
        </div>
      </a>

      {/* Language */}
      <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <span className="text-sm font-bold text-gray-700">{t('profile.language')}</span>
        <LanguageSwitcher />
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-full py-3 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
        <LogOut size={16} />
        {t('nav.signOut')}
      </button>
    </div>
  )
}
