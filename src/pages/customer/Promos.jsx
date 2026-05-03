import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { Megaphone, Tag, Coffee, Utensils, ShoppingBag, Sparkles, X } from 'lucide-react'
import lineQr from '../../assets/line-qr.png'
import charSnacks from '../../assets/char-snacks.png'

const CATEGORIES = [
  { id: 'all', label: 'All Promos', icon: Sparkles, color: '#CC0000' },
  { id: 'food', label: 'Food', icon: Utensils, color: '#FF6B35' },
  { id: 'drinks', label: 'Drinks', icon: Coffee, color: '#4ECDC4' },
  { id: 'snacks', label: 'Snacks', icon: ShoppingBag, color: '#FFE66D' },
  { id: 'special', label: 'Special Offers', icon: Tag, color: '#A8DADC' },
]

export default function CustomerPromos() {
  const [promos, setPromos] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedPromo, setSelectedPromo] = useState(null)

  useEffect(() => {
    getDocs(query(collection(db, 'promos'), where('active', '==', true)))
      .then(snap => {
        const promosData = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        setPromos(promosData)
      })
  }, [])

  const filteredPromos = selectedCategory === 'all' 
    ? promos 
    : promos.filter(p => p.category === selectedCategory)

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900 mb-2">🎉 Monthly Promos</h1>
        <p className="text-gray-500">Discover amazing deals and special offers this month!</p>
      </div>

      {/* Category Chips */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon
          const isActive = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-all shrink-0"
              style={{
                background: isActive ? cat.color : '#f3f4f6',
                color: isActive ? '#fff' : '#666',
                boxShadow: isActive ? `0 4px 12px ${cat.color}40` : 'none',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
              }}>
              <Icon size={16} />
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Promos Grid */}
      {filteredPromos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <img src={charSnacks} alt="" className="h-40 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-bold">No promos in this category</p>
          <p className="text-sm">Try selecting a different category!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {filteredPromos.map(p => (
            <div 
              key={p.id} 
              onClick={() => setSelectedPromo(p)}
              className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 overflow-hidden cursor-pointer hover:shadow-xl hover:border-red-200 transition-all group">
              {/* Image */}
              <div className="h-48 relative overflow-hidden" style={{ background: '#FFF0F0' }}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Megaphone size={64} className="text-red-200" />
                  </div>
                )}
                {/* Category Badge */}
                {p.category && (
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-black bg-white/90 backdrop-blur-sm"
                    style={{ color: CATEGORIES.find(c => c.id === p.category)?.color || '#CC0000' }}>
                    {CATEGORIES.find(c => c.id === p.category)?.label || 'Promo'}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-black text-gray-900 text-lg mb-2 line-clamp-2">{p.title}</h3>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{p.description}</p>
                
                {/* Price/Info */}
                {p.price && (
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-black" style={{ color: '#CC0000' }}>฿{p.price}</span>
                    <span className="text-xs font-bold text-gray-400">Tap for details</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LINE QR */}
      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl shadow-sm border-2 border-green-200 p-6 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">💬</span>
          <p className="font-black text-gray-900">Stay Updated!</p>
        </div>
        <div className="flex items-center gap-4">
          <img src={lineQr} alt="LINE QR" className="w-24 h-24 object-contain rounded-xl shrink-0 bg-white p-2" />
          <p className="text-sm text-gray-600 leading-relaxed">
            <strong>Add us on LINE</strong> to get instant notifications about new promos, exclusive deals, and special rewards!
          </p>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedPromo && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setSelectedPromo(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            {/* Image */}
            <div className="h-64 relative" style={{ background: '#FFF0F0' }}>
              {selectedPromo.imageUrl ? (
                <img src={selectedPromo.imageUrl} alt={selectedPromo.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Megaphone size={80} className="text-red-200" />
                </div>
              )}
              <button 
                onClick={() => setSelectedPromo(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <h2 className="text-2xl font-black text-gray-900 mb-3">{selectedPromo.title}</h2>
              <p className="text-gray-600 leading-relaxed mb-5">{selectedPromo.description}</p>

              {selectedPromo.price && (
                <div className="rounded-2xl p-4 mb-4" style={{ background: '#FFF0F0' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600">Special Price</span>
                    <span className="text-3xl font-black" style={{ color: '#CC0000' }}>฿{selectedPromo.price}</span>
                  </div>
                </div>
              )}

              <button 
                onClick={() => setSelectedPromo(null)}
                className="w-full py-3 rounded-xl font-black text-white"
                style={{ background: '#CC0000' }}>
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
