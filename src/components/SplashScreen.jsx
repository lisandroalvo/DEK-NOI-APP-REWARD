import { useEffect, useState } from 'react'
import { Sparkles, ShoppingCart, Star } from 'lucide-react'
import logo from '../assets/logo.png'

// Product emojis for raining animation - DEK NOI minimart items
const PRODUCTS = [
  '🥤', // Drinks
  '🍜', // Noodles (like the noodle cup)
  '🧃', // Juice box
  '🍪', // Cookies/Chips (like the chips bag)
  '☕', // Coffee (like the coffee cup)
  '�', // Hot dog
  '💧', // Water bottle
  '🥪', // Sandwich
  '�', // Chocolate
  '🧋', // Bubble tea
  '🥨', // Snacks
  '🍬', // Candy
]

export default function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('initial')
  const [rainingProducts, setRainingProducts] = useState([])

  // Generate raining products
  useEffect(() => {
    const products = []
    for (let i = 0; i < 30; i++) {
      products.push({
        id: i,
        emoji: PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)],
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        duration: 2.5 + Math.random() * 2,
        size: 35 + Math.random() * 35
      })
    }
    setRainingProducts(products)
  }, [])

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase('enter'), 100)
    const timer2 = setTimeout(() => setPhase('logo'), 300)
    const timer3 = setTimeout(() => setPhase('products'), 600)
    const timer4 = setTimeout(() => setPhase('shine'), 1200)
    const timer5 = setTimeout(() => setPhase('complete'), 2200)
    const timer6 = setTimeout(() => setPhase('fadeOut'), 3000)
    const timer7 = setTimeout(() => onComplete(), 3500)

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + 2
      })
    }, 35)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      clearTimeout(timer4)
      clearTimeout(timer5)
      clearTimeout(timer6)
      clearTimeout(timer7)
      clearInterval(progressInterval)
    }
  }, [onComplete])


  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden transition-all duration-700 ${
        phase === 'fadeOut' ? 'opacity-0 scale-110' : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'linear-gradient(135deg, #CC0000 0%, #FF6B6B 50%, #FFE600 100%)',
        transition: 'background 1s ease-in-out',
      }}
    >
      {/* Raining Products Animation */}
      {phase !== 'initial' && rainingProducts.map((product) => (
        <div
          key={product.id}
          className="fixed animate-fall pointer-events-none"
          style={{
            left: `${product.left}%`,
            top: '-10%',
            fontSize: `${product.size}px`,
            animationDelay: `${product.delay}s`,
            animationDuration: `${product.duration}s`,
            opacity: phase === 'fadeOut' ? 0 : 0.8,
            filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))',
          }}
        >
          {product.emoji}
        </div>
      ))}
      {/* Animated morphing background shapes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-96 h-96 rounded-full blur-3xl transition-all duration-[2000ms]"
          style={{
            background: 'radial-gradient(circle, rgba(204, 0, 0, 0.15) 0%, transparent 70%)',
            top: phase === 'initial' ? '-20%' : '10%',
            left: phase === 'initial' ? '-20%' : '5%',
            transform: `scale(${phase === 'complete' ? 1.5 : 1}) rotate(${phase === 'complete' ? 180 : 0}deg)`,
          }}
        />
        <div
          className="absolute w-[30rem] h-[30rem] rounded-full blur-3xl transition-all duration-[2000ms]"
          style={{
            background: 'radial-gradient(circle, rgba(255, 230, 0, 0.2) 0%, transparent 70%)',
            bottom: phase === 'initial' ? '-20%' : '5%',
            right: phase === 'initial' ? '-20%' : '10%',
            transform: `scale(${phase === 'complete' ? 1.5 : 1}) rotate(${phase === 'complete' ? -180 : 0}deg)`,
            transitionDelay: '200ms',
          }}
        />
      </div>

      {/* Animated top stripe with 3D effect */}
      <div
        className="fixed top-0 left-0 right-0 h-5 transition-all duration-700 ease-out shadow-lg"
        style={{
          background: 'linear-gradient(180deg, #CC0000 0%, #AA0000 100%)',
          transform: phase === 'initial' || phase === 'enter' ? 'translateX(-100%) rotateY(90deg)' : 'translateX(0) rotateY(0deg)',
          transformStyle: 'preserve-3d',
        }}
      />
      <div
        className="fixed top-5 left-0 right-0 h-5 transition-all duration-700 ease-out shadow-lg"
        style={{
          background: 'linear-gradient(180deg, #FFE600 0%, #FFD700 100%)',
          transform: phase === 'initial' || phase === 'enter' ? 'translateX(100%) rotateY(-90deg)' : 'translateX(0) rotateY(0deg)',
          transformStyle: 'preserve-3d',
          transitionDelay: '150ms',
        }}
      />

      {/* Animated bottom stripe with 3D effect */}
      <div
        className="fixed bottom-5 left-0 right-0 h-5 transition-all duration-700 ease-out shadow-lg"
        style={{
          background: 'linear-gradient(180deg, #AA0000 0%, #CC0000 100%)',
          transform: phase === 'initial' || phase === 'enter' ? 'translateX(100%) rotateY(-90deg)' : 'translateX(0) rotateY(0deg)',
          transformStyle: 'preserve-3d',
        }}
      />
      <div
        className="fixed bottom-0 left-0 right-0 h-5 transition-all duration-700 ease-out shadow-lg"
        style={{
          background: 'linear-gradient(180deg, #FFD700 0%, #FFE600 100%)',
          transform: phase === 'initial' || phase === 'enter' ? 'translateX(-100%) rotateY(90deg)' : 'translateX(0) rotateY(0deg)',
          transformStyle: 'preserve-3d',
          transitionDelay: '150ms',
        }}
      />

      {/* Floating sparkles */}
      {phase !== 'initial' && (
        <>
          <Sparkles className="fixed top-20 left-20 text-white/40 animate-pulse" size={32} style={{ animationDelay: '0s' }} />
          <Star className="fixed top-32 right-24 text-yellow-300/50 animate-pulse" size={28} style={{ animationDelay: '0.5s' }} />
          <ShoppingCart className="fixed bottom-28 left-16 text-white/30 animate-bounce" size={36} style={{ animationDelay: '0.3s' }} />
          <Sparkles className="fixed bottom-20 right-20 text-yellow-200/40 animate-pulse" size={24} style={{ animationDelay: '0.7s' }} />
        </>
      )}

      {/* Main content with perspective */}
      <div className="relative z-10 flex flex-col items-center" style={{ perspective: '1000px' }}>
        {/* Logo with 3D bounce animation */}
        <div
          className={`transition-all duration-1000 ${
            phase === 'initial' || phase === 'enter'
              ? 'scale-0 opacity-0'
              : phase === 'logo' || phase === 'stripes'
              ? 'scale-100 opacity-100'
              : phase === 'particles'
              ? 'scale-105 opacity-100'
              : 'scale-110 opacity-100'
          }`}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            transform: phase === 'complete' ? 'rotateY(360deg) scale(1.1)' : 'rotateY(0deg)',
            transformStyle: 'preserve-3d',
            transition: 'all 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          }}
        >
          <div className="relative">
            {/* Multi-layer glow effect */}
            <div
              className="absolute inset-0 blur-3xl opacity-40 rounded-full animate-pulse-slow"
              style={{
                background: 'radial-gradient(circle, #CC0000 0%, #FF3333 50%, transparent 70%)',
                transform: 'scale(1.3)',
              }}
            />
            <div
              className="absolute inset-0 blur-xl opacity-20 rounded-full"
              style={{
                background: 'radial-gradient(circle, #FFE600 0%, transparent 70%)',
                transform: 'scale(1.5)',
                animation: 'pulse 2s ease-in-out infinite',
                animationDelay: '0.5s',
              }}
            />
            
            {/* Logo with 3D shadow */}
            <img
              src={logo}
              alt="DEK NOI"
              className="h-52 w-auto object-contain relative z-10"
              style={{
                filter: 'drop-shadow(0 15px 40px rgba(0, 0, 0, 0.2)) drop-shadow(0 5px 15px rgba(204, 0, 0, 0.3))',
                transform: phase === 'complete' ? 'translateZ(20px)' : 'translateZ(0px)',
                transition: 'all 0.8s ease-out',
              }}
            />

            {/* Orbiting ring effect */}
            {phase === 'complete' && (
              <div
                className="absolute inset-0 rounded-full border-4 border-yellow-400 opacity-60"
                style={{
                  animation: 'orbit 3s linear infinite',
                  transform: 'scale(1.2)',
                }}
              />
            )}
          </div>
        </div>

        {/* Tagline with gradient text */}
        <div
          className={`mt-8 text-center transition-all duration-700 ${
            phase === 'products' || phase === 'shine' || phase === 'complete' || phase === 'fadeOut'
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-8 scale-95'
          }`}
          style={{
            transitionDelay: '400ms',
          }}
        >
          <h1 
            className="text-3xl font-black mb-2 text-white"
            style={{
              textShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)',
            }}
          >
            DEK NOI Minimart
          </h1>
          <p className="text-base text-white/90 font-bold tracking-wide"
            style={{
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            }}
          >
            🎁 Earn Points • Unlock Rewards 🎁
          </p>
        </div>

        {/* Enhanced progress bar */}
        <div
          className={`mt-10 w-64 transition-all duration-700 ${
            phase === 'particles' || phase === 'complete' || phase === 'fadeOut'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          }`}
          style={{
            transitionDelay: '600ms',
          }}
        >
          <div className="relative">
            {/* Progress bar background glow */}
            <div className="absolute inset-0 blur-md opacity-50 rounded-full"
              style={{
                background: `linear-gradient(90deg, #CC0000 0%, #FF3333 ${progress}%, transparent ${progress}%)`,
              }}
            />
            
            {/* Progress bar */}
            <div className="relative h-2 bg-gray-200/50 backdrop-blur-sm rounded-full overflow-hidden border border-gray-300/30">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out relative"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #CC0000 0%, #FF3333 50%, #FFE600 100%)',
                  boxShadow: '0 0 20px rgba(204, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
                }}
              >
                {/* Shimmer effect */}
                <div 
                  className="absolute inset-0 opacity-50"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
                    animation: 'shimmer 1.5s infinite',
                  }}
                />
              </div>
            </div>
            
            {/* Progress percentage */}
            <div className="text-center mt-3 text-xs font-bold text-gray-500">
              {Math.round(progress)}%
            </div>
          </div>
        </div>
      </div>

      {/* Animated corner accents */}
      <div
        className="fixed top-20 left-10 w-20 h-20 rounded-full opacity-20 transition-all duration-1000"
        style={{
          background: 'radial-gradient(circle, #CC0000 0%, transparent 70%)',
          transform: phase === 'complete' ? 'scale(1.5) rotate(180deg)' : 'scale(1) rotate(0deg)',
          filter: 'blur(20px)',
        }}
      />
      <div
        className="fixed bottom-20 right-10 w-24 h-24 rounded-full opacity-20 transition-all duration-1000"
        style={{
          background: 'radial-gradient(circle, #FFE600 0%, transparent 70%)',
          transform: phase === 'complete' ? 'scale(1.5) rotate(-180deg)' : 'scale(1) rotate(0deg)',
          filter: 'blur(20px)',
          transitionDelay: '200ms',
        }}
      />

    </div>
  )
}
