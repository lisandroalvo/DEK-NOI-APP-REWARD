// ABOUTME: Builds the POS dispense collaborator — runs the retry/backoff loop over the
// ABOUTME: reward-redemptions API and returns one classified result for redeemCore to act on.
import { classifyRedemptionResult, postRewardRedemption } from './rewardApi.js'

const BACKOFF_MS = [0, 1000, 2000, 4000]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function makeDispenser(apiUrl, apiKey) {
  return async function dispense(payload) {
    let result = null
    for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
      if (attempt > 0) await sleep(BACKOFF_MS[attempt])
      const { status, body } = await postRewardRedemption(apiUrl, apiKey, payload)
      result = classifyRedemptionResult(status, body)
      if (result.action !== 'retry') break
    }
    return result
  }
}
