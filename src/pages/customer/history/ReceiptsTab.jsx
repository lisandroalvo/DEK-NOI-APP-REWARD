// ABOUTME: Receipts sub-tab of the customer Activity page — lists submitted bills.
// ABOUTME: Realtime bill feed with status badges and a bill-detail modal.
import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../../lib/firebase'
import { useAuth } from '../../../context/AuthContext'
import { Receipt, CheckCircle, XCircle, Clock } from 'lucide-react'

export default function ReceiptsTab() {
  const { user } = useAuth()
  const [bills, setBills] = useState([])
  const [selectedBill, setSelectedBill] = useState(null)

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
    <>
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
              className="bg-white border-2 border-gray-200 rounded-xl p-3 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedBill(bill)}
            >
              <div className="flex items-start gap-3">
                <img
                  src={bill.imageData || bill.imageUrl}
                  alt="Bill"
                  className="w-16 h-16 object-cover rounded-lg border-2 border-gray-300"
                />

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
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300">
                      ฿{bill.amount != null ? bill.amount : '—'}
                    </span>
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

              <img
                src={selectedBill.imageData || selectedBill.imageUrl}
                alt="Bill"
                className="w-full h-auto rounded-xl border-4 border-red-600 mb-4"
              />

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
    </>
  )
}
