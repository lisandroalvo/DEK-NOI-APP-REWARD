import { useEffect, useState } from 'react'
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { redeemReward as callRedeemReward } from '../../lib/redeemReward'
import { Star, Lock } from 'lucide-react'
import charSitting from '../../assets/char-sitting.png'
import BarcodeScanner from '../../components/BarcodeScanner'

export default function CustomerRewards() {
  const { user, profile } = useAuth()
  const [rewards, setRewards] = useState([])
  const [redeeming, setRedeeming] = useState(null)
  const [showModal, setShowModal] = useState(null)
  const [detailsModal, setDetailsModal] = useState(null)
  const [scanFor, setScanFor] = useState(null)
  const [result, setResult] = useState(null) // { ok, product?, code?, message?, retry?, reward }

  useEffect(() => {
    getDocs(query(collection(db, 'rewards'), where('available', '==', true)))
      .then(snap => setRewards(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.pointsCost - b.pointsCost)))
  }, [])

  const CODE_MESSAGES = {
    OUT_OF_STOCK: 'That item is out of stock right now.',
    EXCEEDS_MAX_VALUE: "That item costs more than this reward allows. Please pick a lower-priced item.",
    PRODUCT_NOT_FOUND: "We couldn't find that barcode. Please scan again.",
    INSUFFICIENT_POINTS: "You don't have enough points for this reward.",
    BAD_REQUEST: 'That barcode looks invalid. Please scan again.',
  }

  const processRedemption = async (redemptionId, reward) => {
    setRedeeming(reward.id)
    try {
      const res = await callRedeemReward(redemptionId)
      if (res?.ok) {
        setResult({ ok: true, product: res.product ?? null, reward })
      } else {
        setResult({ ok: false, code: res?.code, message: CODE_MESSAGES[res?.code] || res?.message || 'This redemption could not be completed.', reward })
      }
    } catch {
      // Transient — keep the SAME redemptionId so Try again reuses this redemption (never a new key).
      setResult({ ok: false, retry: true, redemptionId, reward, message: 'The store system is busy. Please try again in a moment.' })
    } finally {
      setRedeeming(null)
    }
  }

  const redeem = async (reward, barcode) => {
    setRedeeming(reward.id)
    setScanFor(null)
    let ref
    try {
      ref = await addDoc(collection(db, 'redemptions'), {
        userId: user.uid,
        userName: profile.name,
        userEmail: profile.email,
        rewardId: reward.id,
        rewardName: reward.name,
        rewardEmoji: reward.emoji || '🎁',
        pointsCost: reward.pointsCost,
        maxValue: reward.maxValue ?? null,
        barcode,
        status: 'pending',
        requestedAt: serverTimestamp(),
      })
    } catch {
      setResult({ ok: false, message: 'Could not start the redemption. Please try again.', reward })
      setRedeeming(null)
      return
    }
    await processRedemption(ref.id, reward)
  }

  const pts = profile?.points ?? 0

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <h1 className="text-xl sm:text-2xl font-black text-gray-900">Rewards Store</h1>
        <div className="flex items-center gap-1 sm:gap-1.5 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 font-black text-xs sm:text-sm whitespace-nowrap" style={{ background: '#FFE600', color: '#CC0000' }}>
          <Star size={12} className="sm:hidden" fill="currentColor" />
          <Star size={14} className="hidden sm:block" fill="currentColor" />
          {pts.toLocaleString()} pts
        </div>
      </div>
      <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6">Redeem your points for great rewards!</p>

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
              <div key={r.id}
                onClick={() => setDetailsModal(r)}
                className="bg-white rounded-2xl shadow-sm overflow-hidden border-2 transition-all cursor-pointer hover:shadow-lg flex flex-col h-full"
                style={{ borderColor: canAfford ? '#CC0000' : '#e5e7eb' }}>
                <div className="h-40 shrink-0 flex flex-col items-center justify-center gap-1 relative overflow-hidden"
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
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-black text-gray-900">{r.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 mb-4 leading-relaxed">{r.description}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-1 font-black text-sm" style={{ color: '#CC0000' }}>
                      <Star size={13} fill="currentColor" /> {r.pointsCost.toLocaleString()} pts
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        canAfford && setShowModal(r)
                      }}
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
              Next, scan the barcode of the item you're taking. Points are deducted once the admin confirms it.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(null)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600">
                Cancel
              </button>
              <button onClick={() => { setScanFor(showModal); setShowModal(null) }} disabled={redeeming === showModal.id}
                className="flex-1 py-3 rounded-xl text-sm font-black text-white disabled:opacity-60"
                style={{ background: '#CC0000' }}>
                {redeeming === showModal.id ? 'Submitting…' : 'Confirm Redeem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details modal */}
      {detailsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setDetailsModal(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            {/* Image or Emoji */}
            <div className="mb-5 rounded-2xl overflow-hidden border-2" style={{ borderColor: '#CC0000' }}>
              {detailsModal.imageUrl ? (
                <img src={detailsModal.imageUrl} alt={detailsModal.name} className="w-full h-56 object-cover" />
              ) : (
                <div className="h-56 flex items-center justify-center" style={{ background: '#FFF0F0' }}>
                  <span className="text-8xl">{detailsModal.emoji || '🎁'}</span>
                </div>
              )}
            </div>
            
            {/* Details */}
            <div className="mb-5">
              <h2 className="text-2xl font-black text-gray-900 mb-2">{detailsModal.name}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{detailsModal.description}</p>
            </div>

            {/* Points Cost */}
            <div className="rounded-2xl p-4 mb-5" style={{ background: '#FFF0F0' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">Points Required</span>
                <div className="flex items-center gap-1 text-2xl font-black" style={{ color: '#CC0000' }}>
                  <Star size={20} fill="currentColor" /> {detailsModal.pointsCost.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Your Balance */}
            <div className="rounded-2xl p-4 mb-5 border-2 border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">Your Balance</span>
                <div className="flex items-center gap-1 text-xl font-black" style={{ color: pts >= detailsModal.pointsCost ? '#10b981' : '#ef4444' }}>
                  <Star size={16} fill="currentColor" /> {pts.toLocaleString()} pts
                </div>
              </div>
              {pts < detailsModal.pointsCost && (
                <p className="text-xs text-gray-500 mt-2">
                  You need <strong>{(detailsModal.pointsCost - pts).toLocaleString()} more points</strong> to redeem this reward
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => setDetailsModal(null)} 
                className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600">
                Close
              </button>
              {pts >= detailsModal.pointsCost && (
                <button 
                  onClick={() => {
                    setShowModal(detailsModal)
                    setDetailsModal(null)
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-black text-white"
                  style={{ background: '#CC0000' }}>
                  Redeem Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Redemption result */}
      {result && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4" onClick={() => setResult(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-5xl mb-3">{result.ok ? '🎉' : result.retry ? '⏳' : '😕'}</div>
            <h2 className="text-xl font-black text-gray-900 mb-1">
              {result.ok ? 'Enjoy your reward!' : result.retry ? 'Almost there' : "Couldn't redeem"}
            </h2>
            {result.ok ? (
              <p className="text-sm text-gray-600 mb-5">
                Grab your <strong>{result.product?.name || result.reward.name}</strong>. {result.reward.pointsCost.toLocaleString()} points were used.
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-5">{result.message}</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setResult(null)} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600">Close</button>
              {!result.ok && (
                <button onClick={() => {
                    if (result.retry && result.redemptionId) {
                      const { redemptionId, reward } = result
                      setResult(null)
                      processRedemption(redemptionId, reward)
                    } else {
                      const r = result.reward
                      setResult(null)
                      setScanFor(r)
                    }
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-black text-white" style={{ background: '#CC0000' }}>
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barcode capture */}
      {scanFor && (
        <BarcodeScanner
          onDetected={(barcode) => redeem(scanFor, barcode)}
          onCancel={() => setScanFor(null)}
        />
      )}
    </div>
  )
}
