import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function PromoCarousel({ promos }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  console.log('🎪 PromoCarousel received promos:', promos)
  console.log('🎪 Promos count:', promos?.length || 0)

  // Use all active promos (with or without images)
  const activePromos = promos.filter(p => p.active)
  
  console.log('🎪 Active promos:', activePromos)
  console.log('🎪 Active promos count:', activePromos.length)

  useEffect(() => {
    if (!isAutoPlaying || activePromos.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activePromos.length)
    }, 5000) // Change slide every 5 seconds

    return () => clearInterval(interval)
  }, [isAutoPlaying, activePromos.length])

  if (activePromos.length === 0) {
    console.log('🎪 No active promos - carousel hidden')
    return null
  }
  
  console.log('🎪 Carousel rendering with', activePromos.length, 'promos')

  const goToPrevious = () => {
    setIsAutoPlaying(false)
    setCurrentIndex((prev) => (prev - 1 + activePromos.length) % activePromos.length)
  }

  const goToNext = () => {
    setIsAutoPlaying(false)
    setCurrentIndex((prev) => (prev + 1) % activePromos.length)
  }

  const goToSlide = (index) => {
    setIsAutoPlaying(false)
    setCurrentIndex(index)
  }

  const currentPromo = activePromos[currentIndex]

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-lg mb-6">
      {/* Main Image or Gradient Background */}
      <div className="relative h-64" style={{ 
        background: currentPromo.imageUrl 
          ? '#f3f4f6' 
          : 'linear-gradient(135deg, #CC0000 0%, #FF6B6B 50%, #FFE600 100%)'
      }}>
        {currentPromo.imageUrl && (
          <img
            src={currentPromo.imageUrl}
            alt={currentPromo.title}
            className="w-full h-full object-cover"
          />
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        {/* Content Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            {currentPromo.month && (
              <span className="text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: '#FFE600', color: '#CC0000' }}>
                📅 {currentPromo.month}
              </span>
            )}
            {currentPromo.bonusPoints && (
              <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ background: '#CC0000', color: '#FFE600' }}>
                ⭐ {currentPromo.bonusPoints}x Points
              </span>
            )}
          </div>
          <h3 className="font-black text-xl mb-1">{currentPromo.title}</h3>
          <p className="text-sm text-white/90 line-clamp-2">{currentPromo.description}</p>
        </div>
      </div>

      {/* Navigation Arrows */}
      {activePromos.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-all"
            aria-label="Previous slide"
          >
            <ChevronLeft size={20} className="text-gray-800" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center hover:bg-white transition-all"
            aria-label="Next slide"
          >
            <ChevronRight size={20} className="text-gray-800" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {activePromos.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {activePromos.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className="w-2 h-2 rounded-full transition-all"
              style={{
                background: index === currentIndex ? '#FFE600' : 'rgba(255,255,255,0.5)',
                width: index === currentIndex ? '24px' : '8px',
              }}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
