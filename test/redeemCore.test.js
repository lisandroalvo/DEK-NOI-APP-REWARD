// ABOUTME: Emulator-backed tests for redeemCore — reserve/finalize/refund/idempotency money paths.
// ABOUTME: Runs under `npm run test:rules`; uses firebase-admin against the Firestore emulator.
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { redeemCore } from '../functions/redeemCore.js'

const PROJECT_ID = 'demo-dek-noi'
let app, db

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' })
}

async function seed({ points = 100, status = 'pending' } = {}) {
  await db.collection('users').doc('u1').set({ name: 'Alice', points })
  await db.collection('rewards').doc('rw1').set({ name: 'Soft Drink', pointsCost: 30, maxValue: 20 })
  await db.collection('redemptions').doc('rd1').set({
    userId: 'u1', userName: 'Alice', rewardId: 'rw1', rewardName: 'Soft Drink', barcode: '8850999320005', status,
  })
}
const balance = async () => (await db.collection('users').doc('u1').get()).data().points
const redemption = async () => (await db.collection('redemptions').doc('rd1').get()).data()
const ledgerCount = async () => (await db.collection('pointTransactions').get()).size

beforeAll(() => { app = initializeApp({ projectId: PROJECT_ID }); db = getFirestore() })
afterAll(async () => { await deleteApp(app) })
beforeEach(clearFirestore)

describe('redeemCore', () => {
  test('complete: deducts once, approves, writes one ledger entry', async () => {
    await seed()
    const dispense = async () => ({ action: 'complete', product: { name: 'Coke', price: 15 } })
    const res = await redeemCore({ db, redemptionId: 'rd1', dispense })
    expect(res).toEqual({ ok: true, status: 'approved', product: { name: 'Coke', price: 15 } })
    expect(await balance()).toBe(70)
    expect((await redemption()).status).toBe('approved')
    expect(await ledgerCount()).toBe(1)
  })

  test('idempotent: a second complete call does not deduct again', async () => {
    await seed()
    const dispense = async () => ({ action: 'complete', product: { name: 'Coke' } })
    await redeemCore({ db, redemptionId: 'rd1', dispense })
    await redeemCore({ db, redemptionId: 'rd1', dispense }) // status now 'approved' -> short-circuits
    expect(await balance()).toBe(70)
    expect(await ledgerCount()).toBe(1)
  })

  test('reject after reserve: refunds points and records failure', async () => {
    await seed()
    const dispense = async () => ({ action: 'reject', code: 'OUT_OF_STOCK', message: 'Sold out', product: null })
    const res = await redeemCore({ db, redemptionId: 'rd1', dispense })
    expect(res.ok).toBe(false)
    expect(res.code).toBe('OUT_OF_STOCK')
    expect(await balance()).toBe(100) // deducted then refunded
    const r = await redemption()
    expect(r.status).toBe('rejected')
    expect(r.failureCode).toBe('OUT_OF_STOCK')
    expect(await ledgerCount()).toBe(2) // debit + refund
  })

  test('insufficient points: rejects without dispensing', async () => {
    await seed({ points: 10 })
    let called = false
    const dispense = async () => { called = true; return { action: 'complete' } }
    const res = await redeemCore({ db, redemptionId: 'rd1', dispense })
    expect(res.code).toBe('INSUFFICIENT_POINTS')
    expect(called).toBe(false)
    expect(await balance()).toBe(10)
    expect((await redemption()).status).toBe('rejected')
  })

  test('persistent transient: throws, leaves points reserved (retryable)', async () => {
    await seed()
    const dispense = async () => ({ action: 'retry', code: 'UPSTREAM_ERROR' })
    await expect(redeemCore({ db, redemptionId: 'rd1', dispense })).rejects.toThrow()
    expect(await balance()).toBe(70) // still held
    expect((await redemption()).status).toBe('reserving')
  })

  test('retry from reserving completes without a second deduction', async () => {
    await seed()
    // First attempt reserves then dies transiently.
    await expect(redeemCore({ db, redemptionId: 'rd1', dispense: async () => ({ action: 'retry', code: 'UPSTREAM_ERROR' }) })).rejects.toThrow()
    // Retry drives the same redemption to completion.
    const res = await redeemCore({ db, redemptionId: 'rd1', dispense: async () => ({ action: 'complete', product: { name: 'Coke' } }) })
    expect(res.status).toBe('approved')
    expect(await balance()).toBe(70) // deducted exactly once across both attempts
    expect(await ledgerCount()).toBe(1)
  })
})
