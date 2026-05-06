import { useState, useEffect } from 'react'
import { db } from '../../lib/firebase'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'
import { CheckCircle, XCircle, Clock, Eye } from 'lucide-react'

export default function BillReview() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBill, setSelectedBill] = useState(null)
  const [points, setPoints] = useState('')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    const q = query(
      collection(db, 'billSubmissions'),
      orderBy('submittedAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const billsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setBills(billsData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleApprove = async () => {
    if (!selectedBill || !points) return

    setProcessing(true)
    try {
      const pointsNum = parseInt(points)
      
      // Update bill submission
      await updateDoc(doc(db, 'billSubmissions', selectedBill.id), {
        status: 'approved',
        pointsAwarded: pointsNum,
        reviewedAt: serverTimestamp(),
        notes: notes || ''
      })

      // Add points to user
      await updateDoc(doc(db, 'users', selectedBill.userId), {
        points: increment(pointsNum)
      })

      // Reset form
      setSelectedBill(null)
      setPoints('')
      setNotes('')
    } catch (err) {
      console.error('Error approving bill:', err)
      alert('Failed to approve bill')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedBill) return

    setProcessing(true)
    try {
      await updateDoc(doc(db, 'billSubmissions', selectedBill.id), {
        status: 'rejected',
        pointsAwarded: 0,
        reviewedAt: serverTimestamp(),
        notes: notes || 'Bill rejected'
      })

      setSelectedBill(null)
      setPoints('')
      setNotes('')
    } catch (err) {
      console.error('Error rejecting bill:', err)
      alert('Failed to reject bill')
    } finally {
      setProcessing(false)
    }
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
      case 'pending': return <Clock size={16} />
      case 'approved': return <CheckCircle size={16} />
      case 'rejected': return <XCircle size={16} />
      default: return null
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto">
        <p className="text-center text-gray-500">Loading bills...</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto">
      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-6">📄 Bill Review</h1>

      {bills.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl">
          <p className="text-gray-500 text-lg">No bills submitted yet</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {bills.map((bill) => (
            <div
              key={bill.id}
              className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:shadow-lg transition-all"
            >
              <div className="flex items-start gap-4">
                {/* Bill Image Thumbnail */}
                <img
                  src={bill.imageUrl}
                  alt="Bill"
                  className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300 cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setSelectedBill(bill)}
                />

                {/* Bill Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border-2 flex items-center gap-1 ${getStatusColor(bill.status)}`}>
                      {getStatusIcon(bill.status)}
                      {bill.status.toUpperCase()}
                    </span>
                    {bill.pointsAwarded > 0 && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border-2 border-yellow-300">
                        +{bill.pointsAwarded} pts
                      </span>
                    )}
                  </div>
                  
                  <p className="font-bold text-gray-900">{bill.userName}</p>
                  <p className="text-sm text-gray-600">{bill.userEmail}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Submitted: {bill.submittedAt?.toDate().toLocaleString()}
                  </p>
                  {bill.notes && (
                    <p className="text-sm text-gray-700 mt-2 italic">Note: {bill.notes}</p>
                  )}
                </div>

                {/* Action Button */}
                {bill.status === 'pending' && (
                  <button
                    onClick={() => setSelectedBill(bill)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 flex items-center gap-2"
                  >
                    <Eye size={16} />
                    Review
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-black mb-4">Review Bill</h2>

              {/* Bill Image */}
              <img
                src={selectedBill.imageUrl}
                alt="Bill"
                className="w-full h-auto rounded-xl border-4 border-red-600 mb-4"
              />

              {/* User Info */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="font-bold text-gray-900">{selectedBill.userName}</p>
                <p className="text-sm text-gray-600">{selectedBill.userEmail}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Submitted: {selectedBill.submittedAt?.toDate().toLocaleString()}
                </p>
              </div>

              {/* Points Input */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Points to Award
                </label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="Enter points"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-red-500 focus:outline-none"
                />
              </div>

              {/* Notes Input */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-red-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={!points || processing}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle size={20} />
                  Approve
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <XCircle size={20} />
                  Reject
                </button>
                <button
                  onClick={() => {
                    setSelectedBill(null)
                    setPoints('')
                    setNotes('')
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
