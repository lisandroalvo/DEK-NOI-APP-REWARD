import { useEffect, useState, useCallback } from 'react'
import { collection, query, getDocs, orderBy, limit, startAfter } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { TrendingUp, Search } from 'lucide-react'

const PAGE_SIZE = 25

export default function AdminActivity() {
  const [allTx, setAllTx] = useState([])
  const [search, setSearch] = useState('')
  const [lastDoc, setLastDoc] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)

  const loadPage = useCallback(async (after = null) => {
    setLoading(true)
    const q = after
      ? query(collection(db, 'pointTransactions'), orderBy('createdAt', 'desc'), startAfter(after), limit(PAGE_SIZE))
      : query(collection(db, 'pointTransactions'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
    const snap = await getDocs(q)
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    setAllTx(prev => after ? [...prev, ...docs] : docs)
    setLastDoc(snap.docs[snap.docs.length - 1] ?? null)
    setHasMore(snap.docs.length === PAGE_SIZE)
    setLoading(false)
  }, [])

  useEffect(() => { loadPage() }, [loadPage])

  const filtered = allTx.filter(t =>
    !search ||
    t.reason?.toLowerCase().includes(search.toLowerCase()) ||
    t.userId?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-black text-gray-900 mb-1">Activity Log</h1>
      <p className="text-sm text-gray-400 mb-6">All point transactions across all members</p>

      <div className="relative mb-5 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by reason…"
          className="w-full pl-9 pr-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none"
          onFocus={e => e.target.style.borderColor = '#CC0000'}
          onBlur={e => e.target.style.borderColor = '#e5e7eb'}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: '#FFF0F0' }}>
            <tr>
              {['Date', 'Reason', 'Points', 'User ID'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-black uppercase tracking-wide" style={{ color: '#CC0000' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-red-50 transition-colors">
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {t.createdAt?.toDate?.()?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '—'}
                </td>
                <td className="px-4 py-3 font-semibold text-gray-700">{t.reason || '—'}</td>
                <td className="px-4 py-3">
                  <span className="font-black" style={{ color: t.points > 0 ? '#CC0000' : '#888' }}>
                    {t.points > 0 ? '+' : ''}{t.points} pts
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs font-mono truncate max-w-32">{t.userId}</td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                  <TrendingUp size={32} className="mx-auto mb-2 opacity-20" />
                  <p>No transactions found.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && !search && (
        <div className="text-center mt-6">
          <button onClick={() => loadPage(lastDoc)} disabled={loading}
            className="px-6 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-60"
            style={{ background: '#CC0000' }}>
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
      {loading && allTx.length === 0 && (
        <p className="text-center text-sm text-gray-400 mt-8">Loading…</p>
      )}
    </div>
  )
}
