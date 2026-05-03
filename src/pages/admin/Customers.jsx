import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy, doc, updateDoc, addDoc, increment, serverTimestamp } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { Search, Plus, Minus, Star, X, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'

export default function AdminCustomers() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [sortDesc, setSortDesc] = useState(true)
  const [modal, setModal] = useState(null)        // { customer, mode: 'add'|'subtract' }
  const [detailModal, setDetailModal] = useState(null) // customer
  const [detailTx, setDetailTx] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const load = () =>
    getDocs(query(collection(db, 'users'), where('role', '==', 'customer')))
      .then(snap => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() }))))

  useEffect(() => { load() }, [])

  const filtered = customers
    .filter(c =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
    )
    .sort((a, b) => sortDesc ? (b.points ?? 0) - (a.points ?? 0) : (a.points ?? 0) - (b.points ?? 0))

  const openPoints = (c, mode) => {
    setModal({ customer: c, mode })
    setPoints('')
    setReason('')
  }

  const submitPoints = async () => {
    if (!points || isNaN(points) || parseInt(points) <= 0) return
    setSaving(true)
    const pts = parseInt(points) * (modal.mode === 'subtract' ? -1 : 1)
    try {
      await updateDoc(doc(db, 'users', modal.customer.id), { points: increment(pts) })
      await addDoc(collection(db, 'pointTransactions'), {
        userId: modal.customer.id,
        points: pts,
        reason: reason.trim() || (pts > 0 ? 'Points added by admin' : 'Points deducted by admin'),
        addedBy: user.uid,
        createdAt: serverTimestamp(),
      })
      showToast(`${pts > 0 ? '+' : ''}${pts} pts ${pts > 0 ? 'added to' : 'removed from'} ${modal.customer.name}`)
      setModal(null)
      load()
    } finally { setSaving(false) }
  }

  const openDetail = async (c) => {
    setDetailModal(c)
    setLoadingDetail(true)
    const snap = await getDocs(query(
      collection(db, 'pointTransactions'),
      where('userId', '==', c.id),
      orderBy('createdAt', 'desc')
    ))
    setDetailTx(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setLoadingDetail(false)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000) }

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-6xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-black text-gray-900 mb-4 sm:mb-6">Customers</h1>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-400 mt-0.5">{customers.length} total member{customers.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {toast && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle size={16} /> {toast}
        </div>
      )}

      {/* Search + sort */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email or phone…"
            className="w-full pl-9 pr-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none"
            onFocus={e => e.target.style.borderColor = '#CC0000'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
        </div>
        <button onClick={() => setSortDesc(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-red-300">
          <Star size={13} style={{ color: '#CC0000' }} />
          Points {sortDesc ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: '#FFF0F0' }}>
            <tr>
              {['Member', 'Email', 'Phone', 'Points', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide" style={{ color: '#CC0000' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-red-50 transition-colors">
                <td className="px-4 py-3">
                  <button onClick={() => openDetail(c)} className="font-black text-gray-800 hover:underline text-left">
                    {c.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{c.email}</td>
                <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 font-black text-sm" style={{ color: '#CC0000' }}>
                    <Star size={13} fill="currentColor" /> {(c.points ?? 0).toLocaleString()}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openPoints(c, 'add')}
                      className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-xl"
                      style={{ background: '#FFE600', color: '#CC0000' }}>
                      <Plus size={12} /> Add
                    </button>
                    <button onClick={() => openPoints(c, 'subtract')}
                      className="flex items-center gap-1 text-xs font-black px-3 py-1.5 rounded-xl"
                      style={{ background: '#FFF0F0', color: '#CC0000' }}>
                      <Minus size={12} /> Deduct
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No members found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Subtract points modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-black text-gray-900">
                {modal.mode === 'add' ? 'Add Points' : 'Deduct Points'} — {modal.customer.name}
              </h2>
              <button onClick={() => setModal(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="rounded-xl p-3 mb-4 flex items-center gap-2" style={{ background: '#FFF0F0' }}>
              <Star size={14} fill="currentColor" style={{ color: '#CC0000' }} />
              <span className="text-sm font-black" style={{ color: '#CC0000' }}>
                Current balance: {(modal.customer.points ?? 0).toLocaleString()} pts
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Points to {modal.mode === 'add' ? 'add' : 'deduct'}
                </label>
                <input type="number" value={points} onChange={e => setPoints(e.target.value)} min="1" placeholder="e.g. 100"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"
                  onFocus={e => e.target.style.borderColor = '#CC0000'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason (optional)</label>
                <input value={reason} onChange={e => setReason(e.target.value)}
                  placeholder={modal.mode === 'add' ? 'e.g. Purchase ฿500' : 'e.g. Correction'}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none"
                  onFocus={e => e.target.style.borderColor = '#CC0000'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'}
                />
              </div>
              {points && !isNaN(points) && parseInt(points) > 0 && (
                <p className="text-xs text-center text-gray-500">
                  New balance: <strong style={{ color: '#CC0000' }}>
                    {((modal.customer.points ?? 0) + parseInt(points) * (modal.mode === 'subtract' ? -1 : 1)).toLocaleString()} pts
                  </strong>
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setModal(null)}
                  className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600">Cancel</button>
                <button onClick={submitPoints} disabled={saving}
                  className="flex-1 py-3 rounded-xl text-sm font-black text-white disabled:opacity-60"
                  style={{ background: '#CC0000' }}>
                  {saving ? 'Saving…' : modal.mode === 'add' ? 'Add Points' : 'Deduct Points'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer detail modal */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start mb-4 shrink-0">
              <div>
                <h2 className="font-black text-gray-900 text-lg">{detailModal.name}</h2>
                <p className="text-xs text-gray-400">{detailModal.email}</p>
                {detailModal.phone && <p className="text-xs text-gray-400">{detailModal.phone}</p>}
              </div>
              <button onClick={() => setDetailModal(null)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="rounded-2xl p-4 mb-4 shrink-0" style={{ background: '#CC0000' }}>
              <p className="text-red-200 text-xs mb-0.5">Points Balance</p>
              <div className="flex items-center gap-2">
                <Star size={18} fill="white" className="text-white" />
                <span className="text-3xl font-black text-white">{(detailModal.points ?? 0).toLocaleString()}</span>
                <span className="text-red-200">pts</span>
              </div>
            </div>

            <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3 shrink-0">Transaction History</p>
            <div className="overflow-y-auto flex-1">
              {loadingDetail ? (
                <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
              ) : detailTx.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Clock size={28} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No transactions yet</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {detailTx.map(t => (
                    <li key={t.id} className="py-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">{t.reason || 'Points adjustment'}</p>
                        <p className="text-xs text-gray-400">{t.createdAt?.toDate?.()?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—'}</p>
                      </div>
                      <span className="font-black text-sm" style={{ color: t.points > 0 ? '#CC0000' : '#888' }}>
                        {t.points > 0 ? '+' : ''}{t.points} pts
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex gap-2 pt-4 shrink-0 border-t border-gray-100 mt-4">
              <button onClick={() => { setDetailModal(null); openPoints(detailModal, 'add') }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-black"
                style={{ background: '#FFE600', color: '#CC0000' }}>
                <Plus size={14} /> Add Points
              </button>
              <button onClick={() => { setDetailModal(null); openPoints(detailModal, 'subtract') }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-black border-2"
                style={{ borderColor: '#CC0000', color: '#CC0000' }}>
                <Minus size={14} /> Deduct
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
