import { useEffect, useState } from 'react'
import logo from '../assets/logo.png'

export default function SplashScreen({ onComplete }) {
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    // Fade in
    setTimeout(() => setOpacity(1), 100)
    
    // Fade out and complete after 2 seconds
    const timer = setTimeout(() => {
      setOpacity(0)
      setTimeout(onComplete, 500)
    }, 2000)

    return () => clearTimeout(timer)
  }, [onComplete])


  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: '#CC0000',
        transition: 'opacity 0.5s ease-in-out',
        opacity: opacity
      }}
    >
      <img 
        src={logo} 
        alt="DEK NOI" 
        className="w-48 h-48 object-contain"
        style={{
          animation: 'fadeInScale 1s ease-out',
          filter: 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.3))'
        }}
      />
      
      <style>{`
        @keyframes fadeInScale {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  )
}
