import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { Megaphone } from 'lucide-react'
import lineQr from '../../assets/line-qr.png'
import charSnacks from '../../assets/char-snacks.png'

export default function CustomerPromos() {
  const [promos, setPromos] = useState([])

  useEffect(() => {
    getDocs(query(collection(db, 'promos'), where('active', '==', true), orderBy('createdAt', 'desc')))
      .then(snap => setPromos(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-black text-gray-900 mb-1">Monthly Promos</h1>
      <p className="text-gray-400 text-sm mb-6">Special deals to earn more points!</p>

      {promos.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <img src={charSnacks} alt="" className="h-36 mx-auto mb-2" />
          <p>No active promos right now. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          {promos.map(p => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="h-2" style={{ background: '#CC0000' }} />
              <div className="h-2" style={{ background: '#FFE600' }} />
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider" style={{ color: '#CC0000' }}>
                    📅 {p.month || 'Special Offer'}
                  </span>
                  {p.bonusPoints && (
                    <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ background: '#FFE600', color: '#CC0000' }}>
                      ⭐ {p.bonusPoints}x Points
                    </span>
                  )}
                </div>
                <h3 className="font-black text-gray-900 text-lg mb-1">{p.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{p.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LINE QR */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 max-w-sm">
        <p className="font-black text-gray-900 text-sm mb-3">Want to know about promos first?</p>
        <div className="flex items-center gap-4">
          <img src={lineQr} alt="LINE QR" className="w-20 h-20 object-contain rounded-xl shrink-0" />
          <p className="text-xs text-gray-500 leading-relaxed">
            Add us on <strong>LINE</strong> by scanning the QR code to get notified about upcoming promotions and rewards!
          </p>
        </div>
      </div>
    </div>
  )
}
