// ABOUTME: Atomic point-mutation helpers for bill approval and redemption approval.
// ABOUTME: Every balance change runs in a Firestore transaction and is logged to pointTransactions.
import { doc, collection, runTransaction, serverTimestamp } from 'firebase/firestore'

// Earning rate: this many baht of approved spend equals one point. Leftover baht
// below this threshold is banked in the user's spendCarry and rolls into the next
// approval, so no spend is ever wasted. Change here to retune the whole app.
export const BAHT_PER_POINT = 50

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

// Approve a bill: convert the spent baht into points and record the bill review.
// Points earned = floor((carried baht + amount) / BAHT_PER_POINT); the remainder is
// banked in spendCarry for next time, and the full amount adds to lifetime totalSpent.
export async function approveBill(db, bill, amount, notes, adminUid) {
  if (!(amount > 0)) throw new Error('INVALID_AMOUNT')

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

    const data = userSnap.data()
    const currentPoints = data.points || 0
    const carryBefore = data.spendCarry || 0
    const totalSpentBefore = data.totalSpent || 0

    const pool = carryBefore + amount
    const earned = Math.floor(pool / BAHT_PER_POINT)
    const carry = pool % BAHT_PER_POINT

    tx.update(billRef, {
      status: 'approved',
      amount,
      pointsAwarded: earned,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
      notes: notes || '',
    })
    tx.update(userRef, {
      points: currentPoints + earned,
      spendCarry: carry,
      totalSpent: totalSpentBefore + amount,
    })
    tx.set(doc(collection(db, 'pointTransactions')), {
      userId: bill.userId,
      points: earned,
      amount,
      reason: 'Bill approved',
      addedBy: adminUid,
      createdAt: serverTimestamp(),
    })
  })
}
