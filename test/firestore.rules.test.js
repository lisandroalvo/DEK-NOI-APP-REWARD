// ABOUTME: Security-rules tests for Firestore and Storage, run against the Firebase emulator.
// ABOUTME: Encodes who may change points/role, who may approve bills, and that storage requires auth.
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, test } from 'vitest'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadString } from 'firebase/storage'

const PROJECT_ID = 'demo-dek-noi'
const ALICE = 'alice'
const ADMIN = 'admin1'

let testEnv

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  })
})

afterAll(async () => {
  await testEnv.cleanup()
})

// Seed an ordinary customer (Alice, 100 pts) and an admin, bypassing rules.
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
    await setDoc(doc(db, 'billSubmissions', 'bill1'), {
      userId: ALICE, status: 'pending', pointsAwarded: 0,
    })
  })
})

describe('users collection — point/role protection', () => {
  test('a customer cannot inflate their own points balance', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(updateDoc(doc(db, 'users', ALICE), { points: 999999 }))
  })

  test('a customer cannot escalate their own role to admin', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(updateDoc(doc(db, 'users', ALICE), { role: 'admin' }))
  })

  test('a customer can still edit their own name and phone', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertSucceeds(updateDoc(doc(db, 'users', ALICE), { name: 'Alice B.', phone: '0812345678' }))
  })

  test('an admin can adjust a customer point balance', async () => {
    const db = testEnv.authenticatedContext(ADMIN).firestore()
    await assertSucceeds(updateDoc(doc(db, 'users', ALICE), { points: 250 }))
  })

  test('a customer cannot change their own totalSpent', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(updateDoc(doc(db, 'users', ALICE), { totalSpent: 99999 }))
  })

  test('a customer cannot change their own spendCarry', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(updateDoc(doc(db, 'users', ALICE), { spendCarry: 49 }))
  })
})

describe('billSubmissions — no self-approval', () => {
  test('a customer cannot approve their own bill or award themselves points', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(
      updateDoc(doc(db, 'billSubmissions', 'bill1'), { status: 'approved', pointsAwarded: 500 })
    )
  })

  test('a customer can submit a bill with a claimed amount', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertSucceeds(
      setDoc(doc(db, 'billSubmissions', 'bill2'), {
        userId: ALICE, status: 'pending', pointsAwarded: 0, amount: 120, ocrAmount: 120,
      })
    )
  })

  test('a customer cannot pre-award points on a new bill', async () => {
    const db = testEnv.authenticatedContext(ALICE).firestore()
    await assertFails(
      setDoc(doc(db, 'billSubmissions', 'bill3'), {
        userId: ALICE, status: 'pending', pointsAwarded: 500, amount: 120,
      })
    )
  })
})

describe('storage — must be authenticated', () => {
  test('an unauthenticated user cannot write to storage', async () => {
    const storage = testEnv.unauthenticatedContext().storage()
    await assertFails(uploadString(ref(storage, 'bills/x.txt'), 'hello'))
  })

  test('an authenticated user can write an image to storage', async () => {
    const storage = testEnv.authenticatedContext(ALICE).storage()
    await assertSucceeds(
      uploadString(ref(storage, 'bills/x.png'), 'aGVsbG8=', 'base64', { contentType: 'image/png' })
    )
  })
})
