// ABOUTME: Unit tests for the pure reward-redemption API result classifier.
import { describe, test, expect } from 'vitest'
import { classifyRedemptionResult, postRewardRedemption } from '../functions/rewardApi.js'

describe('classifyRedemptionResult', () => {
  test('200 ok -> complete with product', () => {
    expect(classifyRedemptionResult(200, { ok: true, replayed: false, product: { name: 'Coke', price: 15 } }))
      .toEqual({ action: 'complete', product: { name: 'Coke', price: 15 }, replayed: false })
  })
  test('200 ok replayed -> complete replayed:true', () => {
    const r = classifyRedemptionResult(200, { ok: true, replayed: true, product: { name: 'Coke' } })
    expect(r.action).toBe('complete'); expect(r.replayed).toBe(true)
  })
  test.each([['IN_PROGRESS', 409], ['UPSTREAM_ERROR', 502], ['INTERNAL_ERROR', 500]])('%s -> retry', (code, status) => {
    expect(classifyRedemptionResult(status, { ok: false, code }).action).toBe('retry')
  })
  test.each([['PRODUCT_NOT_FOUND', 404], ['OUT_OF_STOCK', 409], ['EXCEEDS_MAX_VALUE', 422], ['BAD_REQUEST', 400], ['UNAUTHORIZED', 401]])('%s -> reject', (code, status) => {
    const r = classifyRedemptionResult(status, { ok: false, code, message: 'x' })
    expect(r.action).toBe('reject'); expect(r.code).toBe(code)
  })
  test('business rejection carries product (OUT_OF_STOCK)', () => {
    const r = classifyRedemptionResult(409, { ok: false, code: 'OUT_OF_STOCK', product: { name: 'Coke', remainingQty: 0 } })
    expect(r.product).toEqual({ name: 'Coke', remainingQty: 0 })
  })
  test('missing code -> reject (never an infinite retry)', () => {
    expect(classifyRedemptionResult(418, { ok: false }).action).toBe('reject')
  })
})

describe('postRewardRedemption', () => {
  test('a network failure becomes a retryable INTERNAL_ERROR (real unreachable host)', async () => {
    // Port 1 refuses immediately — a real fetch failure, not a mock.
    const { status, body } = await postRewardRedemption('http://127.0.0.1:1/x', 'k', { a: 1 })
    expect(status).toBe(0)
    expect(body.code).toBe('INTERNAL_ERROR')
    expect(classifyRedemptionResult(status, body).action).toBe('retry')
  })
})
