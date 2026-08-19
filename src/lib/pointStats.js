// ABOUTME: Pure helper that rolls a customer's pointTransactions into earned/redeemed totals.
// ABOUTME: No Firestore/React deps so the dashboard's stat math is unit-tested in isolation.

// A rejected redemption writes a reserve debit ("Redeemed: …") and, on refund, an offsetting
// credit ("Refund: …") — see functions/redeemCore.js. Both stats must net those out so a
// refunded redemption counts as neither earned nor redeemed.
export function summarizePointTransactions(transactions) {
  let earned = 0
  let redeemed = 0
  for (const tx of transactions) {
    const points = tx?.points ?? 0
    const isRefund = String(tx?.reason ?? '').startsWith('Refund:')
    if (isRefund) {
      redeemed += points // a positive credit that cancels a prior reserve debit
    } else if (points > 0) {
      earned += points
    } else {
      redeemed += points // a redemption debit (negative)
    }
  }
  return { earned, redeemed: Math.abs(redeemed) }
}
