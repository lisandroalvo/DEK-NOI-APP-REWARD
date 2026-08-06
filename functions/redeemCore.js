// ABOUTME: Caller-agnostic redemption engine — reserves the owner's points, dispenses via the
// ABOUTME: injected collaborator, then finalizes or refunds atomically. Idempotent per redemption.
import { HttpsError } from 'firebase-functions/v2/https'
import { FieldValue } from 'firebase-admin/firestore'

export async function redeemCore({ db, redemptionId, dispense }) {
  const redemptionRef = db.collection('redemptions').doc(redemptionId)
  const snap = await redemptionRef.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Redemption not found.')
  const redemption = snap.data()
  const ownerId = redemption.userId
  const userRef = db.collection('users').doc(ownerId)

  // Already resolved -> return the stored outcome (idempotent, no re-dispense).
  if (redemption.status === 'approved') {
    return { ok: true, status: 'approved', product: redemption.product ?? null }
  }
  if (redemption.status === 'rejected') {
    return { ok: false, status: 'rejected', code: redemption.failureCode ?? 'REJECTED', message: redemption.failureMessage ?? null, product: redemption.product ?? null }
  }
  // Only 'pending' (fresh) or 'reserving' (a retry after a mid-flight death) proceed.
  if (redemption.status !== 'pending' && redemption.status !== 'reserving') {
    throw new HttpsError('failed-precondition', 'Redemption is not processable.')
  }

  const barcode = String(redemption.barcode ?? '').trim()
  if (!barcode) throw new HttpsError('failed-precondition', 'Redemption has no barcode.')

  // Authoritative reward values — never trust the client-written snapshot.
  const rewardSnap = await db.collection('rewards').doc(redemption.rewardId).get()
  if (!rewardSnap.exists) throw new HttpsError('failed-precondition', 'Reward no longer exists.')
  const reward = rewardSnap.data()
  const pointsCost = reward.pointsCost
  const maxValue = reward.maxValue
  if (!(pointsCost > 0) || !(maxValue > 0)) throw new HttpsError('failed-precondition', 'Reward is misconfigured.')

  // ── Reserve step ──────────────────────────────────────────────────────────
  // Deduct BEFORE dispensing so two concurrent redemptions can't both dispense.
  // Idempotent: only a 'pending' redemption reserves; a 'reserving' one (retry) skips
  // to the API. An insufficient balance rejects here, before any item is dispensed.
  const reserveOutcome = await db.runTransaction(async (tx) => {
    const rSnap = await tx.get(redemptionRef)
    if (rSnap.data()?.status !== 'pending') return 'proceed' // already reserved (retry) or resolved
    const bal = (await tx.get(userRef)).data()?.points ?? 0
    if (bal < pointsCost) {
      tx.update(redemptionRef, {
        status: 'rejected', failureCode: 'INSUFFICIENT_POINTS', failureMessage: 'Not enough points.',
        reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system',
      })
      return 'insufficient'
    }
    tx.update(userRef, { points: bal - pointsCost })
    tx.update(redemptionRef, { status: 'reserving', reservedAt: FieldValue.serverTimestamp(), reservedPoints: pointsCost })
    tx.set(db.collection('pointTransactions').doc(), {
      userId: ownerId, points: -pointsCost, reason: `Redeemed: ${reward.name ?? 'reward'}`,
      addedBy: 'system', createdAt: FieldValue.serverTimestamp(),
    })
    return 'reserved'
  })
  if (reserveOutcome === 'insufficient') {
    return { ok: false, status: 'rejected', code: 'INSUFFICIENT_POINTS', message: 'Not enough points.', product: null }
  }

  // ── Dispense (idempotencyKey = redemptionId) ──
  const payload = {
    idempotencyKey: redemptionId,
    barcode,
    maxValue,
    reward: { id: redemption.rewardId, name: reward.name },
    customer: { id: ownerId, name: redemption.userName ?? '' },
    requestedAt: new Date().toISOString(),
  }
  const result = await dispense(payload)

  if (result.action === 'complete') {
    const product = result.product ?? null
    await db.runTransaction(async (tx) => {
      const rSnap = await tx.get(redemptionRef)
      if (rSnap.data()?.status !== 'reserving') return
      tx.update(redemptionRef, { status: 'approved', product, reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system' })
    })
    return { ok: true, status: 'approved', product }
  }

  if (result.action === 'reject') {
    await db.runTransaction(async (tx) => {
      const rSnap = await tx.get(redemptionRef)
      if (rSnap.data()?.status !== 'reserving') return
      const refundAmount = rSnap.data()?.reservedPoints ?? pointsCost
      const bal = (await tx.get(userRef)).data()?.points ?? 0
      tx.update(userRef, { points: bal + refundAmount })
      tx.update(redemptionRef, {
        status: 'rejected', failureCode: result.code, failureMessage: result.message ?? null,
        product: result.product ?? null, reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system',
      })
      tx.set(db.collection('pointTransactions').doc(), {
        userId: ownerId, points: refundAmount, reason: `Refund: ${reward.name ?? 'reward'} (${result.code})`,
        addedBy: 'system', createdAt: FieldValue.serverTimestamp(),
      })
    })
    return { ok: false, status: 'rejected', code: result.code, message: result.message ?? null, product: result.product ?? null }
  }

  // Transient failures persisted — points remain reserved, status stays 'reserving'.
  throw new HttpsError('unavailable', 'The store system is busy. Please try again in a moment.')
}
