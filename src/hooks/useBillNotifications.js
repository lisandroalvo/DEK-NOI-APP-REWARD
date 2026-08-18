import { useEffect, useRef, useState } from 'react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { playSuccessSound } from '../utils/soundEffects'
import { translate, resolveInitialLang } from '../i18n/translate'
import en from '../i18n/dictionaries/en'
import th from '../i18n/dictionaries/th'

const DICTS = { en, th }
function tMsg(key, vars) {
  const lang = resolveInitialLang(localStorage.getItem('dekNoiLang'))
  return translate(DICTS[lang], en, key, vars)
}

export function useBillNotifications(userId) {
  const [notification, setNotification] = useState(null)
  const previousBills = useRef(new Map())
  const isFirstLoad = useRef(true)

  useEffect(() => {
    if (!userId) return

    const q = query(
      collection(db, 'billSubmissions'),
      where('userId', '==', userId),
      orderBy('submittedAt', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bills = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      // Skip first load
      if (isFirstLoad.current) {
        bills.forEach(bill => {
          previousBills.current.set(bill.id, bill.status)
        })
        isFirstLoad.current = false
        return
      }

      // Check for status changes
      bills.forEach(bill => {
        const previousStatus = previousBills.current.get(bill.id)
        
        // New bill or status changed
        if (previousStatus && previousStatus !== bill.status && bill.status !== 'pending') {
          console.log(`🔔 Bill status changed: ${previousStatus} → ${bill.status}`)
          
          // Play sound
          playSuccessSound()
          
          // Show notification
          if (bill.status === 'approved') {
            setNotification({
              type: 'success',
              title: '✅ Bill Approved!',
              message: tMsg('toast.pointsReceived', { points: bill.pointsAwarded }),
              notes: bill.notes
            })
          } else if (bill.status === 'rejected') {
            setNotification({
              type: 'error',
              title: '❌ Bill Not Approved',
              message: bill.notes || tMsg('toast.billNeedsAttention'),
              notes: bill.notes
            })
          }

          // Auto-hide after 8 seconds
          setTimeout(() => setNotification(null), 8000)
        }

        // Update previous status
        previousBills.current.set(bill.id, bill.status)
      })
    }, (error) => {
      // A missing composite index or a rules change surfaces here; without this
      // handler the listener fails silently and notifications never fire.
      console.error('Bill notifications listener failed:', error)
    })

    return () => unsubscribe()
  }, [userId])

  const clearNotification = () => setNotification(null)

  return { notification, clearNotification }
}
