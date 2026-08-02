// ABOUTME: Callable that redeems one shelf item — reserves the customer's points,
// ABOUTME: validates+dispenses via the POS API, then finalizes or refunds atomically.
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { classifyRedemptionResult, postRewardRedemption } from './rewardApi.js'

const REWARDS_API_KEY = defineSecret('REWARDS_API_KEY')
const REWARDS_API_URL = 'https://dek-noi-dashboard.vercel.app/api/reward-redemptions'
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
    const userRef = db.collection('users').doc(uid)

    const snap = await redemptionRef.get()
    if (!snap.exists) throw new HttpsError('not-found', 'Redemption not found.')
    const redemption = snap.data()
    if (redemption.userId !== uid) throw new HttpsError('permission-denied', 'Not your redemption.')

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
    // Deduct the points BEFORE dispensing so two concurrent redemptions by the same
    // user can't both pass an affordability check and both dispense. Idempotent: only
    // a 'pending' redemption reserves; a 'reserving' one (retry) skips to the API. An
    // insufficient balance rejects here, before any item is dispensed.
    let insufficient = false
    await db.runTransaction(async (tx) => {
      const rSnap = await tx.get(redemptionRef)
      if (rSnap.data()?.status !== 'pending') return // already reserved/resolved concurrently
      const balance = (await tx.get(userRef)).data()?.points ?? 0
      if (balance < pointsCost) {
        insufficient = true
        tx.update(redemptionRef, {
          status: 'rejected', failureCode: 'INSUFFICIENT_POINTS', failureMessage: 'Not enough points.',
          reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system',
        })
        return
      }
      tx.update(userRef, { points: balance - pointsCost })
      tx.update(redemptionRef, { status: 'reserving', reservedAt: FieldValue.serverTimestamp() })
      tx.set(db.collection('pointTransactions').doc(), {
        userId: uid, points: -pointsCost, reason: `Redeemed: ${reward.name ?? 'reward'}`,
        addedBy: 'system', createdAt: FieldValue.serverTimestamp(),
      })
    })
    if (insufficient) {
      return { ok: false, status: 'rejected', code: 'INSUFFICIENT_POINTS', message: 'Not enough points.', product: null }
    }

    // ── Dispense via the API (idempotencyKey = redemptionId; retry transient codes) ──
    const payload = {
      idempotencyKey: redemptionId,
      barcode,
      maxValue,
      reward: { id: redemption.rewardId, name: reward.name },
      customer: { id: uid, name: redemption.userName ?? '' },
      requestedAt: new Date().toISOString(),
    }
    let result = null
    for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
      if (attempt > 0) await sleep(BACKOFF_MS[attempt])
      const { status, body } = await postRewardRedemption(REWARDS_API_URL, REWARDS_API_KEY.value(), payload)
      result = classifyRedemptionResult(status, body)
      if (result.action !== 'retry') break
    }

    if (result.action === 'complete') {
      const product = result.product ?? null
      // Points already deducted at reserve; just finalize (idempotent on 'approved').
      await db.runTransaction(async (tx) => {
        const rSnap = await tx.get(redemptionRef)
        if (rSnap.data()?.status !== 'reserving') return
        tx.update(redemptionRef, {
          status: 'approved', product, reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system',
        })
      })
      return { ok: true, status: 'approved', product }
    }

    if (result.action === 'reject') {
      // Business rejection after we reserved points -> refund (idempotent on 'reserving').
      await db.runTransaction(async (tx) => {
        const rSnap = await tx.get(redemptionRef)
        if (rSnap.data()?.status !== 'reserving') return
        const balance = (await tx.get(userRef)).data()?.points ?? 0
        tx.update(userRef, { points: balance + pointsCost })
        tx.update(redemptionRef, {
          status: 'rejected', failureCode: result.code, failureMessage: result.message ?? null,
          product: result.product ?? null, reviewedAt: FieldValue.serverTimestamp(), reviewedBy: 'system',
        })
        tx.set(db.collection('pointTransactions').doc(), {
          userId: uid, points: pointsCost, reason: `Refund: ${reward.name ?? 'reward'} (${result.code})`,
          addedBy: 'system', createdAt: FieldValue.serverTimestamp(),
        })
      })
      return { ok: false, status: 'rejected', code: result.code, message: result.message ?? null, product: result.product ?? null }
    }

    // Transient failures persisted — points remain reserved, status stays 'reserving'.
    // A later retry re-calls the API (idempotent) and either finalizes or refunds.
    throw new HttpsError('unavailable', 'The store system is busy. Please try again in a moment.')
  },
)
