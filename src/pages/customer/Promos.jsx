import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { Megaphone, Tag, Coffee, Utensils, ShoppingBag, Sparkles, X, ChevronRight } from 'lucide-react'
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

  // Group promos by category for sections
  const promosByCategory = CATEGORIES.slice(1).map(cat => ({
    ...cat,
    promos: promos.filter(p => p.category === cat.id)
  })).filter(cat => cat.promos.length > 0)

  // Featured/All promos
  const featuredPromos = promos.slice(0, 5)

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 mb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">🎉 Monthly Promos</h1>
        <p className="text-sm sm:text-base text-gray-500">Discover amazing deals and special offers!</p>
      </div>

      {/* Featured Promos - Large Horizontal Scroll */}
      {featuredPromos.length > 0 && (
        <div className="mb-8">
          <div className="px-4 sm:px-6 mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black text-gray-900">✨ Featured Deals</h2>
            <ChevronRight size={20} className="text-gray-400" />
          </div>
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-4 px-4 sm:px-6 pb-2">
              {featuredPromos.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => setSelectedPromo(p)}
                  className="flex-shrink-0 w-80 bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden cursor-pointer hover:shadow-2xl hover:scale-105 transition-all">
                  {/* Image */}
                  <div className="h-44 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #FFE600 0%, #FF6B6B 100%)' }}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Megaphone size={64} className="text-white/30" />
                      </div>
                    )}
                    {/* Badge */}
                    <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-black bg-red-600 text-white shadow-lg">
                      🔥 HOT DEAL
                    </div>
                  </div>
                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-black text-gray-900 text-lg mb-1 line-clamp-1">{p.title}</h3>
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{p.description}</p>
                    {p.price && (
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-black text-red-600">฿{p.price}</span>
                        <span className="text-xs font-bold text-gray-400">Tap to view →</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category Sections - Horizontal Scrolls */}
      {promosByCategory.map(cat => {
        const Icon = cat.icon
        return (
          <div key={cat.id} className="mb-8">
            <div className="px-4 sm:px-6 mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Icon size={20} style={{ color: cat.color }} />
                {cat.label}
              </h2>
              <ChevronRight size={20} className="text-gray-400" />
            </div>
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex gap-4 px-4 sm:px-6 pb-2">
                {cat.promos.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => setSelectedPromo(p)}
                    className="flex-shrink-0 w-64 bg-white rounded-2xl shadow-sm border-2 border-gray-100 overflow-hidden cursor-pointer hover:shadow-xl hover:border-red-200 transition-all">
                    {/* Image */}
                    <div className="h-36 relative overflow-hidden" style={{ background: '#FFF0F0' }}>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon size={48} style={{ color: cat.color, opacity: 0.3 }} />
                        </div>
                      )}
                    </div>
                    {/* Content */}
                    <div className="p-3">
                      <h3 className="font-black text-gray-900 text-base mb-1 line-clamp-1">{p.title}</h3>
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">{p.description}</p>
                      {p.price && (
                        <span className="text-xl font-black" style={{ color: cat.color }}>฿{p.price}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {/* Empty State */}
      {promos.length === 0 && (
        <div className="text-center py-16 px-4 text-gray-400">
          <img src={charSnacks} alt="" className="h-40 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-bold">No promos available</p>
          <p className="text-sm">Check back soon for amazing deals!</p>
        </div>
      )}

      {/* LINE QR */}
      <div className="px-4 sm:px-6 mt-8">
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
