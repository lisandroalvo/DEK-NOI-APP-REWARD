// ABOUTME: Callable that redeems one shelf item — validates the barcode via the POS API,
// ABOUTME: then deducts the customer's points once (atomic) and marks the redemption done.
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { classifyRedemptionResult, postRewardRedemption } from './rewardApi.js'

const REWARDS_API_KEY = defineSecret('REWARDS_API_KEY')
const REWARDS_API_URL = 'https://dek-noi-dashboard.vercel.app/api/reward-redemptions'

// Bounded retry for transient API codes (IN_PROGRESS / UPSTREAM_ERROR / INTERNAL_ERROR),
// always with the same idempotency key. Backoff per attempt, within the 60s call budget.
const BACKOFF_MS = [0, 1000, 2000, 4000]

if (getApps().length === 0) initializeApp()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const redeemReward = onCall(
  { region: 'asia-southeast1', memory: '256MiB', timeoutSeconds: 60, secrets: [REWARDS_API_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in.')
    const uid = request.auth.uid
    const redemptionId = request.data?.redemptionId
    if (!redemptionId || typeof redemptionId !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing redemptionId.')
    }

    const db = getFirestore()
    const redemptionRef = db.collection('redemptions').doc(redemptionId)
    const snap = await redemptionRef.get()
    if (!snap.exists) throw new HttpsError('not-found', 'Redemption not found.')
    const redemption = snap.data()
    if (redemption.userId !== uid) throw new HttpsError('permission-denied', 'Not your redemption.')

    // Idempotent short-circuit: already resolved -> return the stored outcome.
    if (redemption.status === 'approved') {
      return { ok: true, status: 'approved', product: redemption.product ?? null }
    }
    if (redemption.status === 'rejected') {
      return { ok: false, status: 'rejected', code: redemption.failureCode ?? 'REJECTED', message: redemption.failureMessage ?? null, product: redemption.product ?? null }
    }
    if (redemption.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Redemption is not processable.')
    }

    const barcode = String(redemption.barcode ?? '').trim()
    if (!barcode) throw new HttpsError('failed-precondition', 'Redemption has no barcode.')

    // Authoritative reward values — never trust the client-written snapshot on the doc.
    const rewardSnap = await db.collection('rewards').doc(redemption.rewardId).get()
    if (!rewardSnap.exists) throw new HttpsError('failed-precondition', 'Reward no longer exists.')
    const reward = rewardSnap.data()
    const pointsCost = reward.pointsCost
    const maxValue = reward.maxValue
    if (!(pointsCost > 0) || !(maxValue > 0)) throw new HttpsError('failed-precondition', 'Reward is misconfigured.')

    // Affordability (authoritative). If short, reject without calling the API.
    const userRef = db.collection('users').doc(uid)
    const balance = (await userRef.get()).data()?.points ?? 0
    if (balance < pointsCost) {
      await redemptionRef.update({
        status: 'rejected', failureCode: 'INSUFFICIENT_POINTS', failureMessage: 'Not enough points.',
        reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system',
      })
      return { ok: false, status: 'rejected', code: 'INSUFFICIENT_POINTS', message: 'Not enough points.', product: null }
    }

    const payload = {
      idempotencyKey: redemptionId,
      barcode,
      maxValue,
      reward: { id: redemption.rewardId, name: reward.name },
      customer: { id: uid, name: redemption.userName ?? '' },
      requestedAt: new Date().toISOString(),
    }

    // Call the API, retrying transient codes with the same key.
    let result = null
    for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
      if (attempt > 0) await sleep(BACKOFF_MS[attempt])
      const { status, body } = await postRewardRedemption(REWARDS_API_URL, REWARDS_API_KEY.value(), payload)
      result = classifyRedemptionResult(status, body)
      if (result.action !== 'retry') break
    }

    if (result.action === 'complete') {
      const product = result.product ?? null
      // Deduct points exactly once, atomically. A replay/retry sees status 'approved' and no-ops.
      await db.runTransaction(async (tx) => {
        const rSnap = await tx.get(redemptionRef)
        if (rSnap.data()?.status === 'approved') return
        const current = (await tx.get(userRef)).data()?.points ?? 0
        tx.update(userRef, { points: Math.max(0, current - pointsCost) })
        tx.update(redemptionRef, {
          status: 'approved', product, reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system',
        })
        tx.set(db.collection('pointTransactions').doc(), {
          userId: uid, points: -pointsCost, reason: `Redeemed: ${reward.name}`,
          addedBy: 'system', createdAt: FieldValue.serverTimestamp(),
        })
      })
      return { ok: true, status: 'approved', product }
    }

    if (result.action === 'reject') {
      await redemptionRef.update({
        status: 'rejected', failureCode: result.code, failureMessage: result.message ?? null,
        product: result.product ?? null, reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system',
      })
      return { ok: false, status: 'rejected', code: result.code, message: result.message ?? null, product: result.product ?? null }
    }

    // Transient failures persisted — leave the redemption 'pending' (the API auto-reclaims
    // a stuck key after 5 min) and tell the client to try again.
    throw new HttpsError('unavailable', 'The store system is busy. Please try again in a moment.')
  },
)
