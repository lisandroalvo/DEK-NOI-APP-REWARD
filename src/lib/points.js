// ABOUTME: Atomic point-mutation helpers for bill approval and redemption approval.
// ABOUTME: Every balance change runs in a Firestore transaction and is logged to pointTransactions.
import { doc, collection, runTransaction, serverTimestamp } from 'firebase/firestore'

// Approve a redemption: deduct its cost from the user, but only if the
// current balance covers it (prevents negative balances and double-spends).
export async function approveRedemption(db, redemption, adminUid) {
  await runTransaction(db, async (tx) => {
    const userRef = doc(db, 'users', redemption.userId)
    const redemptionRef = doc(db, 'redemptions', redemption.id)

    // Re-read the redemption inside the transaction so a stale list or a
    // double-click can't approve (and deduct for) the same redemption twice.
    const redemptionSnap = await tx.get(redemptionRef)
    if (!redemptionSnap.exists()) throw new Error('Redemption not found')
    if (redemptionSnap.data().status !== 'pending') throw new Error('ALREADY_REVIEWED')

    const userSnap = await tx.get(userRef)
    if (!userSnap.exists()) throw new Error('User not found')

    const current = userSnap.data().points || 0
    if (current < redemption.pointsCost) throw new Error('INSUFFICIENT_POINTS')

    tx.update(redemptionRef, {
      status: 'approved',
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
    })
    tx.update(userRef, { points: current - redemption.pointsCost })
    tx.set(doc(collection(db, 'pointTransactions')), {
      userId: redemption.userId,
      points: -redemption.pointsCost,
      reason: `Redeemed: ${redemption.rewardName}`,
      addedBy: adminUid,
      createdAt: serverTimestamp(),
    })
  })
}

// Approve a bill: award positive points to the user and record the bill review.
export async function approveBill(db, bill, pointsAwarded, notes, adminUid) {
  if (!(pointsAwarded > 0)) throw new Error('INVALID_POINTS')

  await runTransaction(db, async (tx) => {
    const userRef = doc(db, 'users', bill.userId)
    const billRef = doc(db, 'billSubmissions', bill.id)

    // Re-read the bill inside the transaction so a stale list or a double-click
    // can't approve (and award points for) the same bill twice.
    const billSnap = await tx.get(billRef)
    if (!billSnap.exists()) throw new Error('Bill not found')
    if (billSnap.data().status !== 'pending') throw new Error('ALREADY_REVIEWED')

    const userSnap = await tx.get(userRef)
    if (!userSnap.exists()) throw new Error('User not found')

    const current = userSnap.data().points || 0

    tx.update(billRef, {
      status: 'approved',
      pointsAwarded,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
      notes: notes || '',
    })
    tx.update(userRef, { points: current + pointsAwarded })
    tx.set(doc(collection(db, 'pointTransactions')), {
      userId: bill.userId,
      points: pointsAwarded,
      reason: 'Bill approved',
      addedBy: adminUid,
      createdAt: serverTimestamp(),
    })
  })
}
