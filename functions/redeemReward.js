// ABOUTME: Customer callable to redeem one shelf item — authorizes the owner, then runs the
// ABOUTME: shared redeemCore against the caller's own redemption.
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { makeDispenser } from './dispense.js'
import { redeemCore } from './redeemCore.js'

const REWARDS_API_KEY = defineSecret('REWARDS_API_KEY')
const REWARDS_API_URL = 'https://dek-noi-dashboard.vercel.app/api/reward-redemptions'

if (getApps().length === 0) initializeApp()

// Throw unless redemptions/{redemptionId}.userId === uid (the sole guard stopping one
// customer from driving another's redemption). Returns the redemption data on success.
export async function assertOwner(db, redemptionId, uid) {
  const snap = await db.collection('redemptions').doc(redemptionId).get()
  if (!snap.exists) throw new HttpsError('not-found', 'Redemption not found.')
  const data = snap.data()
  if (data.userId !== uid) throw new HttpsError('permission-denied', 'Not your redemption.')
  return data
}

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
    await assertOwner(db, redemptionId, uid)
    const dispense = makeDispenser(REWARDS_API_URL, REWARDS_API_KEY.value())
    return redeemCore({ db, redemptionId, dispense })
  },
)
