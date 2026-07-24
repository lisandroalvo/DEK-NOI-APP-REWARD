// ABOUTME: Atomic point-mutation helpers for bill approval and redemption approval.
// ABOUTME: Every balance change runs in a Firestore transaction and is logged to pointTransactions.
import { doc, collection, runTransaction, serverTimestamp } from 'firebase/firestore'

// Earning rate: this many baht of approved spend equals one point. Leftover baht
// below this threshold is banked in the user's spendCarry and rolls into the next
// approval, so no spend is ever wasted. Change here to retune the whole app.
export const BAHT_PER_POINT = 25

// Round to satang (2 decimals). Receipts are usually whole baht but sometimes carry
// satang; rounding each stored money value keeps floating-point drift out of the
// running spendCarry / totalSpent totals.
const toSatang = (n) => Math.round(n * 100) / 100

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

// Adjust a customer's balance by a signed whole-number delta (admin backfill of
// LINE-submitted receipts, or a manual correction). The balance change and its
// pointTransactions log entry are written in one transaction so they can never
// diverge, and a deduction that would push the balance below zero is refused.
//
// spendAmount is optional: when backfilling points from real receipts, pass the
// baht total so lifetime totalSpent grows alongside the balance. Leave it 0 for
// grants that shouldn't count as spend (e.g. a double-points promo). It never
// touches spendCarry — these points are granted outright, not earned via carry.
export async function adjustPoints(db, userId, delta, reason, adminUid, spendAmount = 0) {
  if (!Number.isInteger(delta) || delta === 0) throw new Error('INVALID_DELTA')
  if (!(spendAmount >= 0)) throw new Error('INVALID_AMOUNT')
  const spend = toSatang(spendAmount)

  await runTransaction(db, async (tx) => {
    const userRef = doc(db, 'users', userId)
    const userSnap = await tx.get(userRef)
    if (!userSnap.exists()) throw new Error('User not found')

    const data = userSnap.data()
    const current = data.points || 0
    if (current + delta < 0) throw new Error('INSUFFICIENT_POINTS')

    const userUpdate = { points: current + delta }
    if (spend > 0) userUpdate.totalSpent = toSatang((data.totalSpent || 0) + spend)
    tx.update(userRef, userUpdate)

    const log = {
      userId,
      points: delta,
      reason: reason?.trim() || (delta > 0 ? 'Points added by admin' : 'Points deducted by admin'),
      addedBy: adminUid,
      createdAt: serverTimestamp(),
    }
    if (spend > 0) log.amount = spend
    tx.set(doc(collection(db, 'pointTransactions')), log)
  })
}

// Approve a bill: convert the spent baht into points and record the bill review.
// Points earned = floor((carried baht + amount) / BAHT_PER_POINT); the remainder is
// banked in spendCarry for next time, and the full amount adds to lifetime totalSpent.
export async function approveBill(db, bill, amount, notes, adminUid) {
  if (!(amount > 0)) throw new Error('INVALID_AMOUNT')
  const amt = toSatang(amount)

  await runTransaction(db, async (tx) => {
    const userRef = doc(db, 'users', bill.userId)
    const billRef = doc(db, 'billSubmissions', bill.id)
    // A receipt image can be turned into points exactly once. The lock doc is keyed
    // by the image hash; if a different bill already claimed it, refuse this approval.
    // Legacy bills without an imageHash skip the lock entirely.
    const lockRef = bill.imageHash ? doc(db, 'receiptHashes', bill.imageHash) : null

    // Re-read the bill inside the transaction so a stale list or a double-click
    // can't approve (and award points for) the same bill twice.
    const billSnap = await tx.get(billRef)
    if (!billSnap.exists()) throw new Error('Bill not found')
    if (billSnap.data().status !== 'pending') throw new Error('ALREADY_REVIEWED')

    const lockSnap = lockRef ? await tx.get(lockRef) : null
    if (lockSnap?.exists() && lockSnap.data().billId !== bill.id) throw new Error('DUPLICATE_RECEIPT')

    const userSnap = await tx.get(userRef)
    if (!userSnap.exists()) throw new Error('User not found')

    const data = userSnap.data()
    const currentPoints = data.points || 0
    const carryBefore = data.spendCarry || 0
    const totalSpentBefore = data.totalSpent || 0

    const pool = carryBefore + amt
    const earned = Math.floor(pool / BAHT_PER_POINT)
    const carry = toSatang(pool % BAHT_PER_POINT)

    tx.update(billRef, {
      status: 'approved',
      amount: amt,
      pointsAwarded: earned,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminUid,
      notes: notes || '',
    })
    tx.update(userRef, {
      points: currentPoints + earned,
      spendCarry: carry,
      totalSpent: toSatang(totalSpentBefore + amt),
    })
    tx.set(doc(collection(db, 'pointTransactions')), {
      userId: bill.userId,
      points: earned,
      amount: amt,
      reason: 'Bill approved',
      addedBy: adminUid,
      createdAt: serverTimestamp(),
    })
    if (lockRef) tx.set(lockRef, { billId: bill.id, userId: bill.userId, createdAt: serverTimestamp() })
  })
}
