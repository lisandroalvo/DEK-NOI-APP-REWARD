import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function useRedemptionNotifications(userId) {
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    if (!userId) return

    // Track seen redemption statuses in localStorage
    const getSeenKey = (redemptionId) => `seen_redemption_${redemptionId}`
    
    const q = query(
      collection(db, 'redemptions'),
      where('userId', '==', userId),
      where('status', 'in', ['approved', 'rejected'])
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data()
          const redemptionId = change.doc.id
          const seenKey = getSeenKey(redemptionId)
          
          // Check if we've already shown notification for this status
          const lastSeenStatus = localStorage.getItem(seenKey)
          
          if (lastSeenStatus !== data.status) {
            // New status change - show notification
            if (data.status === 'approved') {
              setNotification({
                type: 'success',
                message: `🎉 Your "${data.rewardName}" redemption was approved! Visit the store to collect it.`,
                redemptionId,
              })
            } else if (data.status === 'rejected') {
              const reason = data.rejectNote ? ` Reason: ${data.rejectNote}` : ''
              setNotification({
                type: 'error',
                message: `Your "${data.rewardName}" redemption was not approved.${reason}`,
                redemptionId,
              })
            }
            
            // Mark as seen
            localStorage.setItem(seenKey, data.status)
          }
        }
      })
    }, (error) => {
      // A missing composite index or a rules change surfaces here; without this
      // handler the listener fails silently and notifications never fire.
      console.error('Redemption notifications listener failed:', error)
    })

    return () => unsubscribe()
  }, [userId])

  const clearNotification = () => setNotification(null)

  return { notification, clearNotification }
}
