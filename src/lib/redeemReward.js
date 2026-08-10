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

// Admin-only: re-drives a stuck redemption server-side (points already held). Returns the
// same shape as redeemReward; transient failures reject the promise for the caller to catch.
export async function retryRedemption(redemptionId) {
  const call = httpsCallable(functions, 'retryRedemption')
  const { data } = await call({ redemptionId })
  return data
}
