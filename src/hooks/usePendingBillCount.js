// ABOUTME: Live count of bill submissions awaiting admin review.
// ABOUTME: Admin-only; drives the pending badge on the Bill Review nav item.
import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function usePendingBillCount(enabled) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const q = query(collection(db, 'billSubmissions'), where('status', '==', 'pending'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => setCount(snap.size),
      (err) => {
        // A permission failure shouldn't break the nav — just hide the badge.
        console.error('Failed to count pending bills:', err)
        setCount(0)
      },
    )
    return () => unsubscribe()
  }, [enabled])

  return enabled ? count : 0
}
