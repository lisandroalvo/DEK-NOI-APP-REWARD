// ABOUTME: Client helper to redeem a reward via the redeemReward Cloud Function.
// ABOUTME: Returns the function's result object; throws (transient/unavailable) for the UI to catch.
import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

// Processes an already-created pending redemption. Returns
// { ok, status, product?, code?, message? }. Business rejections come back as
// ok:false data; transient failures (function threw) reject this promise.
export async function redeemReward(redemptionId) {
  const call = httpsCallable(functions, 'redeemReward')
  const { data } = await call({ redemptionId })
  return data
}
