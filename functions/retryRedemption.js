// ABOUTME: Admin-only callable to re-drive a stuck redemption through the shared redeemCore,
// ABOUTME: operating on the redemption owner's account (not the admin caller's).
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { makeDispenser } from './dispense.js'
import { redeemCore } from './redeemCore.js'

const REWARDS_API_KEY = defineSecret('REWARDS_API_KEY')
const REWARDS_API_URL = 'https://dek-noi-dashboard.vercel.app/api/reward-redemptions'

if (getApps().length === 0) initializeApp()

// Throw permission-denied unless users/{uid}.role === 'admin' (the app's admin signal).
export async function assertAdmin(db, uid) {
  const snap = await db.collection('users').doc(uid).get()
  if (snap.data()?.role !== 'admin') throw new HttpsError('permission-denied', 'Admins only.')
}

export const retryRedemption = onCall(
  { region: 'asia-southeast1', memory: '256MiB', timeoutSeconds: 60, secrets: [REWARDS_API_KEY] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in.')
    const uid = request.auth.uid
    const redemptionId = request.data?.redemptionId
    if (!redemptionId || typeof redemptionId !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing redemptionId.')
    }
    const db = getFirestore()
    await assertAdmin(db, uid)
    const dispense = makeDispenser(REWARDS_API_URL, REWARDS_API_KEY.value())
    return redeemCore({ db, redemptionId, dispense })
  },
)
