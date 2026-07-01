// ABOUTME: Tests for atomic point mutations (bill approval, redemption approval) against the emulator.
// ABOUTME: Guards that balances never go negative and that every change is logged in pointTransactions.
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, test, expect } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc, getDocs, collection } from 'firebase/firestore'
import { approveRedemption, approveBill, adjustPoints } from '../src/lib/points.js'

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

async function userDoc(userId) {
  let data
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(doc(ctx.firestore(), 'users', userId))
    data = snap.data()
  })
  return data
}

async function seedBill(id) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'billSubmissions', id), {
      userId: ALICE, status: 'pending', pointsAwarded: 0,
    })
  })
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

describe('adjustPoints (admin backfill / manual correction)', () => {
  // Alice starts with points:100 (see beforeEach).

  test('adds points and logs a matching transaction atomically', async () => {
    await adjustPoints(adminDb(), ALICE, 250, 'Backfill: LINE receipt ฿12,500', ADMIN)

    expect(await points(ALICE)).toBe(350)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const tx = await getDocs(collection(ctx.firestore(), 'pointTransactions'))
      expect(tx.size).toBe(1)
      expect(tx.docs[0].data().points).toBe(250)
      expect(tx.docs[0].data().reason).toBe('Backfill: LINE receipt ฿12,500')
    })
  })

  test('deducts points and logs the negative transaction', async () => {
    await adjustPoints(adminDb(), ALICE, -40, 'Correction', ADMIN)

    expect(await points(ALICE)).toBe(60)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const tx = await getDocs(collection(ctx.firestore(), 'pointTransactions'))
      expect(tx.docs[0].data().points).toBe(-40)
    })
  })

  test('refuses a deduction that would push the balance negative and leaves state unchanged', async () => {
    await expect(
      adjustPoints(adminDb(), ALICE, -150, 'Correction', ADMIN)
    ).rejects.toThrow(/INSUFFICIENT_POINTS/)

    expect(await points(ALICE)).toBe(100)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const tx = await getDocs(collection(ctx.firestore(), 'pointTransactions'))
      expect(tx.size).toBe(0)
    })
  })

  test('rejects a zero or non-integer delta', async () => {
    await expect(adjustPoints(adminDb(), ALICE, 0, '', ADMIN)).rejects.toThrow(/INVALID_DELTA/)
    await expect(adjustPoints(adminDb(), ALICE, 1.5, '', ADMIN)).rejects.toThrow(/INVALID_DELTA/)
    expect(await points(ALICE)).toBe(100)
  })
})

describe('approveBill', () => {
  // Alice starts with points:100, spendCarry:0, totalSpent:0 (see beforeEach).
  // Rate is 50฿ = 1pt.

  test('awards floor(amount/50) points, banks the remainder, and records spend', async () => {
    await seedBill('b1')
    await approveBill(adminDb(), { id: 'b1', userId: ALICE }, 120, 'Looks good', ADMIN)

    const u = await userDoc(ALICE)
    expect(u.points).toBe(102)      // 100 + floor(120/50)=2
    expect(u.spendCarry).toBe(20)   // 120 % 50
    expect(u.totalSpent).toBe(120)

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const tx = await getDocs(collection(ctx.firestore(), 'pointTransactions'))
      expect(tx.size).toBe(1)
      expect(tx.docs[0].data().points).toBe(2)
      expect(tx.docs[0].data().amount).toBe(120)
    })
  })

  test('banks sub-threshold spend as carry with zero points (nothing wasted)', async () => {
    await seedBill('b1')
    await approveBill(adminDb(), { id: 'b1', userId: ALICE }, 30, '', ADMIN)

    const u = await userDoc(ALICE)
    expect(u.points).toBe(100)      // no point yet
    expect(u.spendCarry).toBe(30)
    expect(u.totalSpent).toBe(30)

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const tx = await getDocs(collection(ctx.firestore(), 'pointTransactions'))
      expect(tx.size).toBe(1)       // still logged
      expect(tx.docs[0].data().points).toBe(0)
    })
  })

  test('rolls carried baht into the next approval', async () => {
    await seedBill('b1')
    await approveBill(adminDb(), { id: 'b1', userId: ALICE }, 80, '', ADMIN)
    // 80 -> +1pt, carry 30
    expect((await userDoc(ALICE)).spendCarry).toBe(30)

    await seedBill('b2')
    await approveBill(adminDb(), { id: 'b2', userId: ALICE }, 30, '', ADMIN)
    // carry 30 + 30 = 60 -> +1pt, carry 10

    const u = await userDoc(ALICE)
    expect(u.points).toBe(102)      // 100 + 1 + 1
    expect(u.spendCarry).toBe(10)
    expect(u.totalSpent).toBe(110)
  })

  test('preserves satang (2-decimal amounts) without floating-point drift', async () => {
    await seedBill('b1')
    await approveBill(adminDb(), { id: 'b1', userId: ALICE }, 50.10, '', ADMIN)

    const u = await userDoc(ALICE)
    expect(u.points).toBe(101)      // 100 + floor(50.10/50)=1
    expect(u.spendCarry).toBe(0.1)  // 50.10 % 50 = 0.10 exactly, not 0.0999…
    expect(u.totalSpent).toBe(50.1)
  })

  test('rejects a non-positive amount and leaves state unchanged', async () => {
    await seedBill('b1')
    await expect(
      approveBill(adminDb(), { id: 'b1', userId: ALICE }, 0, '', ADMIN)
    ).rejects.toThrow(/INVALID_AMOUNT/)

    const u = await userDoc(ALICE)
    expect(u.points).toBe(100)
    expect(u.totalSpent ?? 0).toBe(0)
  })

  test('refuses to approve the same bill twice (no double-count of spend or points)', async () => {
    await seedBill('b1')
    await approveBill(adminDb(), { id: 'b1', userId: ALICE }, 100, 'Looks good', ADMIN)
    expect((await userDoc(ALICE)).points).toBe(102)

    await expect(
      approveBill(adminDb(), { id: 'b1', userId: ALICE }, 100, 'Looks good', ADMIN)
    ).rejects.toThrow(/ALREADY_REVIEWED/)

    const u = await userDoc(ALICE)
    expect(u.points).toBe(102)
    expect(u.totalSpent).toBe(100)
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const tx = await getDocs(collection(ctx.firestore(), 'pointTransactions'))
      expect(tx.size).toBe(1)
    })
  })
})
