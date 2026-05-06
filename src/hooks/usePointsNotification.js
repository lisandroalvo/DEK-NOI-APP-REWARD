import { useEffect, useRef } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { playPointsAwardedSound } from '../utils/soundEffects'

export function usePointsNotification(userId) {
  const previousPoints = useRef(null)
  const isFirstLoad = useRef(true)

  useEffect(() => {
    if (!userId) return

    const unsubscribe = onSnapshot(doc(db, 'users', userId), (snapshot) => {
      if (!snapshot.exists()) return

      const currentPoints = snapshot.data().points || 0

      // Skip first load to avoid playing sound on app start
      if (isFirstLoad.current) {
        previousPoints.current = currentPoints
        isFirstLoad.current = false
        return
      }

      // Check if points increased
      if (previousPoints.current !== null && currentPoints > previousPoints.current) {
        const pointsAdded = currentPoints - previousPoints.current
        console.log(`🎉 Points increased! +${pointsAdded} points`)
        
        // Play success sound
        playPointsAwardedSound()
        
        // Show browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Points Awarded! 🎉', {
            body: `You received +${pointsAdded} points!`,
            icon: '/logo.png',
            badge: '/logo.png'
          })
        }
      }

      previousPoints.current = currentPoints
    })

    return () => unsubscribe()
  }, [userId])
}
