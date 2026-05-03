import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { Gift, Star, CheckCircle, Lock } from 'lucide-react'
import charSitting from '../../assets/char-sitting.png'

export default function CustomerRewards() {
  const { user, profile } = useAuth()
  const [rewards, setRewards] = useState([])
  const [success, setSuccess] = useState('')
  const [redeeming, setRedeeming] = useState(null)
  const [showModal, setShowModal] = useState(null)

  useEffect(() => {
    getDocs(query(collection(db, 'rewards'), where('available', '==', true)))
      .then(snap => setRewards(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.pointsCost - b.pointsCost)))
  }, [])

  const redeem = async (reward) => {
    setRedeeming(reward.id)
    try {
      await addDoc(collection(db, 'redemptions'), {
        userId: user.uid,
        userName: profile.name,
        userEmail: profile.email,
        rewardId: reward.id,
        rewardName: reward.name,
        rewardEmoji: reward.emoji || '🎁',
        pointsCost: reward.pointsCost,
        status: 'pending',
        requestedAt: serverTimestamp(),
      })
      setShowModal(null)
      setSuccess(`Request for "${reward.name}" submitted! The admin will approve it shortly.`)
      setTimeout(() => setSuccess(''), 6000)
    } finally {
      setRedeeming(null)
    }
  }

  const pts = profile?.points ?? 0

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-black text-gray-900">Rewards Store</h1>
        <div className="flex items-center gap-1.5 rounded-full px-4 py-2 font-black text-sm" style={{ background: '#FFE600', color: '#CC0000' }}>
          <Star size={14} fill="currentColor" /> {pts.toLocaleString()} pts
        </div>
      </div>
      <p className="text-gray-400 text-sm mb-6">Redeem your points for great rewards!</p>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-start gap-3 text-green-700">
          <CheckCircle size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Request Submitted!</p>
            <p className="text-xs mt-0.5">{success}</p>
          </div>
        </div>
      )}

      {rewards.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <img src={charSitting} alt="" className="h-36 mx-auto mb-3" />
          <p>No rewards available right now. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rewards.map(r => {
            const canAfford = pts >= r.pointsCost
            const ptsNeeded = r.pointsCost - pts
            return (
              <div key={r.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border-2 transition-all"
                style={{ borderColor: canAfford ? '#CC0000' : '#e5e7eb' }}>
                <div className="h-40 flex flex-col items-center justify-center gap-1 relative overflow-hidden" 
                  style={{ background: canAfford ? '#FFF0F0' : '#f9fafb' }}>
                  {r.imageUrl ? (
                    <img 
                      src={r.imageUrl} 
                      alt={r.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl">{r.emoji || '🎁'}</span>
                  )}
                  {!canAfford && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-xs font-bold text-white flex items-center gap-1 bg-black/60 px-3 py-1.5 rounded-full">
                        <Lock size={12} /> Need {ptsNeeded.toLocaleString()} more pts
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-black text-gray-900">{r.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 mb-4 leading-relaxed">{r.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 font-black text-sm" style={{ color: '#CC0000' }}>
                      <Star size={13} fill="currentColor" /> {r.pointsCost.toLocaleString()} pts
                    </div>
                    <button
                      onClick={() => canAfford && setShowModal(r)}
                      disabled={!canAfford}
                      className="px-4 py-1.5 rounded-xl text-sm font-black transition-all"
                      style={canAfford ? { background: '#CC0000', color: '#fff' } : { background: '#f3f4f6', color: '#bbb', cursor: 'not-allowed' }}>
                      {canAfford ? 'Redeem' : 'Locked 🔒'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirm modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            {/* Image or Emoji */}
            <div className="mb-5 rounded-2xl overflow-hidden border-2" style={{ borderColor: '#CC0000' }}>
              {showModal.imageUrl ? (
                <img src={showModal.imageUrl} alt={showModal.name} className="w-full h-48 object-cover" />
              ) : (
                <div className="h-48 flex items-center justify-center" style={{ background: '#FFF0F0' }}>
                  <span className="text-7xl">{showModal.emoji || '🎁'}</span>
                </div>
              )}
            </div>
            
            <div className="text-center mb-5">
              <h2 className="text-xl font-black text-gray-900">{showModal.name}</h2>
              <p className="text-sm text-gray-500 mt-1">{showModal.description}</p>
            </div>
            <div className="rounded-2xl p-4 mb-5 text-center" style={{ background: '#FFF0F0' }}>
              <p className="text-sm text-gray-600">This will use</p>
              <p className="text-2xl font-black" style={{ color: '#CC0000' }}>⭐ {showModal.pointsCost.toLocaleString()} points</p>
              <p className="text-xs text-gray-400 mt-1">
                You'll have <strong>{(pts - showModal.pointsCost).toLocaleString()} pts</strong> remaining after approval
              </p>
            </div>
            <p className="text-xs text-gray-400 text-center mb-5">
              Your request will be sent to the admin for approval. Points are deducted once approved.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(null)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600">
                Cancel
              </button>
              <button onClick={() => redeem(showModal)} disabled={redeeming === showModal.id}
                className="flex-1 py-3 rounded-xl text-sm font-black text-white disabled:opacity-60"
                style={{ background: '#CC0000' }}>
                {redeeming === showModal.id ? 'Submitting…' : 'Confirm Redeem'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
