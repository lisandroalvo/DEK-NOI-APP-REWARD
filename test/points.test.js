// ABOUTME: Tests for atomic point mutations (bill approval, redemption approval) against the emulator.
// ABOUTME: Guards that balances never go negative and that every change is logged in pointTransactions.
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, test, expect } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore'
import { approveRedemption, approveBill } from '../src/lib/points.js'

const PROJECT_ID = 'demo-dek-noi-points'
const ALICE = 'alice'
const ADMIN = 'admin1'

let testEnv

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

beforeEach(async () => {
  await testEnv.clearFirestore()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', ALICE), {
      name: 'Alice', phone: '', email: 'alice@example.com', role: 'customer', points: 100,
    })
    await setDoc(doc(db, 'users', ADMIN), {
      name: 'Admin', phone: '', email: 'admin@example.com', role: 'admin', points: 0,
    })
  })
})

function adminDb() {
  return testEnv.authenticatedContext(ADMIN).firestore()
}

async function points(userId) {
  let value
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(doc(ctx.firestore(), 'users', userId))
    value = snap.data().points
  })
  return value
}

async function seedRedemption(id, pointsCost) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'redemptions', id), {
      userId: ALICE, userName: 'Alice', rewardName: 'Free Coffee',
      pointsCost, status: 'pending',
    })
  })
}

describe('approveRedemption', () => {
  test('deducts the cost and logs a transaction when the balance is sufficient', async () => {
    await seedRedemption('r1', 100)
    await approveRedemption(adminDb(), { id: 'r1', userId: ALICE, pointsCost: 100, rewardName: 'Free Coffee' }, ADMIN)

    expect(await points(ALICE)).toBe(0)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const tx = await getDocs(collection(ctx.firestore(), 'pointTransactions'))
      expect(tx.size).toBe(1)
      expect(tx.docs[0].data().points).toBe(-100)
    })
  })

  test('refuses to approve when the balance is insufficient and leaves points unchanged', async () => {
    await seedRedemption('r2', 150)
    await expect(
      approveRedemption(adminDb(), { id: 'r2', userId: ALICE, pointsCost: 150, rewardName: 'Big Reward' }, ADMIN)
    ).rejects.toThrow(/INSUFFICIENT_POINTS/)

    expect(await points(ALICE)).toBe(100)
  })

  test('refuses to approve the same redemption twice (no double-deduct)', async () => {
    await seedRedemption('r3', 40)
    const redemption = { id: 'r3', userId: ALICE, pointsCost: 40, rewardName: 'Free Coffee' }
    await approveRedemption(adminDb(), redemption, ADMIN)
    expect(await points(ALICE)).toBe(60)

    await expect(
      approveRedemption(adminDb(), redemption, ADMIN)
    ).rejects.toThrow(/ALREADY_REVIEWED/)

    expect(await points(ALICE)).toBe(60)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const tx = await getDocs(collection(ctx.firestore(), 'pointTransactions'))
      expect(tx.size).toBe(1)
    })
  })
})

describe('approveBill', () => {
  test('adds the awarded points and logs a transaction', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'billSubmissions', 'b1'), {
        userId: ALICE, status: 'pending', pointsAwarded: 0,
      })
    })
    await approveBill(adminDb(), { id: 'b1', userId: ALICE }, 50, 'Looks good', ADMIN)

    expect(await points(ALICE)).toBe(150)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const tx = await getDocs(collection(ctx.firestore(), 'pointTransactions'))
      expect(tx.size).toBe(1)
      expect(tx.docs[0].data().points).toBe(50)
    })
  })

  test('rejects a non-positive award', async () => {
    await expect(
      approveBill(adminDb(), { id: 'b1', userId: ALICE }, 0, '', ADMIN)
    ).rejects.toThrow(/INVALID_POINTS/)
  })

  test('refuses to approve the same bill twice (no double-pay)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'billSubmissions', 'b2'), {
        userId: ALICE, status: 'pending', pointsAwarded: 0,
      })
    })
    await approveBill(adminDb(), { id: 'b2', userId: ALICE }, 50, 'Looks good', ADMIN)
    expect(await points(ALICE)).toBe(150)

    await expect(
      approveBill(adminDb(), { id: 'b2', userId: ALICE }, 50, 'Looks good', ADMIN)
    ).rejects.toThrow(/ALREADY_REVIEWED/)

    expect(await points(ALICE)).toBe(150)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const tx = await getDocs(collection(ctx.firestore(), 'pointTransactions'))
      expect(tx.size).toBe(1)
    })
  })
})
