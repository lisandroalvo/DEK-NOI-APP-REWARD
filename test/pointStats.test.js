// ABOUTME: Unit tests for summarizePointTransactions — the customer-dashboard earned/redeemed
// ABOUTME: stat helper, covering the refund-netting that a rejected redemption produces.
import { describe, test, expect } from 'vitest'
import { summarizePointTransactions } from '../src/lib/pointStats.js'

describe('summarizePointTransactions', () => {
  test('empty ledger totals zero', () => {
    expect(summarizePointTransactions([])).toEqual({ earned: 0, redeemed: 0 })
  })

  test('earnings sum into earned, not redeemed', () => {
    const txs = [
      { points: 18, reason: 'Bill approved' },
      { points: 5, reason: 'Bill approved' },
      { points: 150, reason: 'Welcome bonus points!' },
    ]
    expect(summarizePointTransactions(txs)).toEqual({ earned: 173, redeemed: 0 })
  })

  test('completed redemptions sum into redeemed', () => {
    const txs = [
      { points: -20, reason: 'Redeemed: Bottled Water' },
      { points: -20, reason: 'Redeemed: Bottled Water' },
    ]
    expect(summarizePointTransactions(txs)).toEqual({ earned: 0, redeemed: 40 })
  })

  test('a refunded rejection nets out of BOTH earned and redeemed', () => {
    // The exact shape redeemCore writes on a PRODUCT_NOT_FOUND reject: a reserve debit
    // followed by a refund credit. Neither should show as spent or earned.
    const txs = [
      { points: 20, reason: 'Refund: Bottled Water (PRODUCT_NOT_FOUND)' },
      { points: -20, reason: 'Redeemed: Bottled Water' },
    ]
    expect(summarizePointTransactions(txs)).toEqual({ earned: 0, redeemed: 0 })
  })

  test('mixed history: refunds offset only their own redemption', () => {
    // Two successful 20-pt redemptions + one rejected-and-refunded, amid earnings.
    const txs = [
      { points: 20, reason: 'Refund: Bottled Water (PRODUCT_NOT_FOUND)' },
      { points: -20, reason: 'Redeemed: Bottled Water' }, // the rejected one
      { points: 18, reason: 'Bill approved' },
      { points: -20, reason: 'Redeemed: Bottled Water' }, // completed
      { points: -20, reason: 'Redeemed: Bottled Water' }, // completed
      { points: 25, reason: 'Bill approved' },
    ]
    expect(summarizePointTransactions(txs)).toEqual({ earned: 43, redeemed: 40 })
  })

  test('tolerates missing reason/points fields', () => {
    const txs = [{ points: 10 }, { reason: 'Bill approved' }, {}]
    expect(summarizePointTransactions(txs)).toEqual({ earned: 10, redeemed: 0 })
  })
})
