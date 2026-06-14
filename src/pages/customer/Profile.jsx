import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { doc, updateDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { User, Mail, Phone, Camera, Save, LogOut, Receipt, CheckCircle, XCircle, Clock, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ImageUpload from '../../components/ImageUpload'
import lineQrCode from '../../assets/line-qr.png'

export default function Profile() {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bills, setBills] = useState([])
  const [selectedBill, setSelectedBill] = useState(null)
  const [form, setForm] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    photoURL: profile?.photoURL || null,
  })

  // Fetch user's bill submissions
  useEffect(() => {
    if (!user) return

    const q = query(
      collection(db, 'billSubmissions'),
      where('userId', '==', user.uid),
      orderBy('submittedAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const billsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setBills(billsData)
    }, (error) => {
      // A missing composite index or a rules change surfaces here; without this
      // handler the query fails silently and the history just looks empty.
      console.error('Failed to load bill history:', error)
    })

    return () => unsubscribe()
  }, [user])

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

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'approved': return 'bg-green-100 text-green-800 border-green-300'
      case 'rejected': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock size={14} />
      case 'approved': return <CheckCircle size={14} />
      case 'rejected': return <XCircle size={14} />
      default: return null
    }
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl w-full mx-auto">
      <h1 className="text-xl sm:text-2xl font-black text-gray-900 mb-4 sm:mb-6">My Profile</h1>

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
                <label className="block text-sm font-semibold text-gray-700 mb-2">Profile Photo</label>
                <ImageUpload
                  value={form.photoURL}
                  onChange={(url) => setForm(f => ({ ...f, photoURL: url }))}
                  label="Upload Photo"
                  folder={`avatars/${user.uid}`}
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

      {/* Bill History */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-gray-900 flex items-center gap-2">
            <Receipt size={20} style={{ color: '#CC0000' }} />
            Bill History
          </h3>
          <span className="text-sm font-bold text-gray-500">{bills.length} total</span>
        </div>

        {bills.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Receipt size={48} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No bills submitted yet</p>
            <p className="text-xs mt-1">Tap the 📄 button to upload your first bill!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bills.map((bill) => (
              <div
                key={bill.id}
                className="border-2 border-gray-200 rounded-xl p-3 hover:shadow-md transition-all cursor-pointer"
                onClick={() => setSelectedBill(bill)}
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <img
                    src={bill.imageData || bill.imageUrl}
                    alt="Bill"
                    className="w-16 h-16 object-cover rounded-lg border-2 border-gray-300"
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1 ${getStatusColor(bill.status)}`}>
                        {getStatusIcon(bill.status)}
                        {bill.status.toUpperCase()}
                      </span>
                      {bill.pointsAwarded > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
                          +{bill.pointsAwarded} pts
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">
                      {bill.submittedAt?.toDate().toLocaleDateString()} at {bill.submittedAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {bill.notes && (
                      <p className="text-xs text-gray-500 mt-1 italic truncate">{bill.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bill Detail Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedBill(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black">Bill Details</h2>
                <button
                  onClick={() => setSelectedBill(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ✕
                </button>
              </div>

              {/* Bill Image */}
              <img
                src={selectedBill.imageData || selectedBill.imageUrl}
                alt="Bill"
                className="w-full h-auto rounded-xl border-4 border-red-600 mb-4"
              />

              {/* Status */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-bold border-2 flex items-center gap-2 ${getStatusColor(selectedBill.status)}`}>
                    {getStatusIcon(selectedBill.status)}
                    {selectedBill.status.toUpperCase()}
                  </span>
                  {selectedBill.pointsAwarded > 0 && (
                    <span className="px-3 py-1 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800 border-2 border-yellow-300">
                      +{selectedBill.pointsAwarded} points
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  Submitted: {selectedBill.submittedAt?.toDate().toLocaleString()}
                </p>
                {selectedBill.reviewedAt && (
                  <p className="text-sm text-gray-600">
                    Reviewed: {selectedBill.reviewedAt?.toDate().toLocaleString()}
                  </p>
                )}
                {selectedBill.notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs font-bold text-gray-700 mb-1">Admin Notes:</p>
                    <p className="text-sm text-gray-600">{selectedBill.notes}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedBill(null)}
                className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Us - LINE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h3 className="font-black text-gray-900 flex items-center gap-2 mb-4">
          <MessageCircle size={20} style={{ color: '#00B900' }} />
          Contact Us on LINE
        </h3>
        <div className="text-center">
          <img 
            src={lineQrCode}
            alt="LINE QR Code" 
            className="w-48 h-48 mx-auto mb-3 rounded-xl border-2 border-gray-200"
          />
          <p className="text-sm text-gray-600 mb-2">Scan to add us on LINE</p>
          <p className="text-xs text-gray-500">Get support and updates!</p>
        </div>
      </div>

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
