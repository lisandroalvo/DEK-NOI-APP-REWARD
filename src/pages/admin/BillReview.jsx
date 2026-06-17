import { useState, useEffect } from 'react'
import { db } from '../../lib/firebase'
import { approveBill, BAHT_PER_POINT } from '../../lib/points'
import { useAuth } from '../../context/AuthContext'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { CheckCircle, XCircle, Clock, Eye } from 'lucide-react'

export default function BillReview() {
  const { user } = useAuth()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBill, setSelectedBill] = useState(null)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [filter, setFilter] = useState('pending') // pending, approved, rejected, all

  // Open the review modal for a bill, pre-filling the amount with the customer's
  // claimed value so the admin only has to confirm or correct it.
  const openReview = (bill) => {
    setSelectedBill(bill)
    setAmount(bill.amount != null ? String(bill.amount) : '')
    setNotes('')
  }

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
    }, (error) => {
      // A permission failure (e.g. the account isn't really an admin) surfaces here;
      // without this handler the page just sits on "Loading bills…" with no clue why.
      console.error('Failed to load bills:', error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleApprove = async () => {
    if (!selectedBill) return

    const amountNum = parseFloat(amount)
    if (!(amountNum > 0)) {
      alert('Please enter the bill amount (฿).')
      return
    }

    setProcessing(true)
    try {
      // Convert spend to points and record the review atomically.
      await approveBill(db, selectedBill, amountNum, notes, user.uid)

      // Reset form
      setSelectedBill(null)
      setAmount('')
      setNotes('')
    } catch (err) {
      if (err.message === 'ALREADY_REVIEWED') {
        alert('This bill has already been reviewed. Refresh to see its current status.')
        setSelectedBill(null)
      } else {
        console.error('Error approving bill:', err)
        alert('Failed to approve bill')
      }
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
      setAmount('')
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

  // Filter bills
  const filteredBills = filter === 'all' 
    ? bills 
    : bills.filter(b => b.status === filter)

  // Statistics
  const stats = {
    pending: bills.filter(b => b.status === 'pending').length,
    approved: bills.filter(b => b.status === 'approved').length,
    rejected: bills.filter(b => b.status === 'rejected').length,
    total: bills.length
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">📄 Bill Review</h1>
        <p className="text-gray-600">Review customer bill submissions and award points</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={18} className="text-yellow-600" />
            <p className="text-xs font-bold text-yellow-800">PENDING</p>
          </div>
          <p className="text-3xl font-black text-yellow-600">{stats.pending}</p>
        </div>
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={18} className="text-green-600" />
            <p className="text-xs font-bold text-green-800">APPROVED</p>
          </div>
          <p className="text-3xl font-black text-green-600">{stats.approved}</p>
        </div>
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={18} className="text-red-600" />
            <p className="text-xs font-bold text-red-800">REJECTED</p>
          </div>
          <p className="text-3xl font-black text-red-600">{stats.rejected}</p>
        </div>
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Eye size={18} className="text-gray-600" />
            <p className="text-xs font-bold text-gray-800">TOTAL</p>
          </div>
          <p className="text-3xl font-black text-gray-600">{stats.total}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'pending', label: 'Pending', count: stats.pending, color: 'yellow' },
          { id: 'approved', label: 'Approved', count: stats.approved, color: 'green' },
          { id: 'rejected', label: 'Rejected', count: stats.rejected, color: 'red' },
          { id: 'all', label: 'All Bills', count: stats.total, color: 'gray' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
              filter === tab.id
                ? `bg-${tab.color}-600 text-white shadow-lg`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={filter === tab.id ? {
              backgroundColor: tab.color === 'yellow' ? '#CA8A04' : 
                              tab.color === 'green' ? '#16A34A' :
                              tab.color === 'red' ? '#DC2626' : '#4B5563'
            } : {}}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Bills List */}
      {filteredBills.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl">
          <p className="text-gray-500 text-lg">No {filter !== 'all' ? filter : ''} bills</p>
          <p className="text-sm text-gray-400 mt-1">
            {filter === 'pending' ? 'Waiting for customer submissions' : 'Try selecting a different filter'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBills.map((bill) => (
            <div
              key={bill.id}
              className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:shadow-lg transition-all"
            >
              <div className="flex items-start gap-4">
                {/* Bill Image Thumbnail */}
                <img
                  src={bill.imageData || bill.imageUrl}
                  alt="Bill"
                  className="w-24 h-24 object-cover rounded-lg border-2 border-gray-300 cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => openReview(bill)}
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
                    onClick={() => openReview(bill)}
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
                src={selectedBill.imageData || selectedBill.imageUrl}
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

              {/* Amount Input */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Bill Amount (฿)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter the total"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-red-500 focus:outline-none text-lg font-bold"
                />
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  {selectedBill.ocrAmount != null && (
                    <span className="text-gray-400">Scanned: ฿{selectedBill.ocrAmount}</span>
                  )}
                  {parseFloat(amount) > 0 && (
                    <span className="font-bold text-yellow-700">
                      ≈ {Math.floor(parseFloat(amount) / BAHT_PER_POINT)} points
                    </span>
                  )}
                </div>
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
                  disabled={!amount || processing}
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
                    setAmount('')
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
