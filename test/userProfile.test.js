// ABOUTME: Tests for ensureUserProfile against the emulator — the profile-bootstrap run on sign-in.
// ABOUTME: Guards that auto-creation never overwrites a profile already written by registration.
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, beforeEach, describe, test, expect } from 'vitest'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { ensureUserProfile } from '../src/lib/userProfile.js'

const PROJECT_ID = 'demo-dek-noi-profile'
const ALICE = 'alice'

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
})

function aliceDb() {
  return testEnv.authenticatedContext(ALICE).firestore()
}

async function profile(userId) {
  let data
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const snap = await getDoc(doc(ctx.firestore(), 'users', userId))
    data = snap.exists() ? snap.data() : null
  })
  return data
}

describe('ensureUserProfile', () => {
  test('creates a customer profile with sane defaults when none exists', async () => {
    await ensureUserProfile(aliceDb(), { uid: ALICE, displayName: 'Alice Smith', email: 'alice@example.com' })

    const p = await profile(ALICE)
    expect(p).toMatchObject({
      name: 'Alice Smith',
      email: 'alice@example.com',
      phone: '',
      role: 'customer',
      points: 0,
      totalSpent: 0,
      spendCarry: 0,
    })
  })

  test('does NOT overwrite a profile already written by registration', async () => {
    // Registration wrote the real name + phone the user typed.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ALICE), {
        name: 'Alice Real', phone: '0812345678', email: 'alice@example.com',
        role: 'customer', points: 100, totalSpent: 0, spendCarry: 0,
      })
    })

    // Sign-in fires the bootstrap with the auth user's bare info.
    await ensureUserProfile(aliceDb(), { uid: ALICE, displayName: null, email: 'alice@example.com' })

    const p = await profile(ALICE)
    expect(p.name).toBe('Alice Real')
    expect(p.phone).toBe('0812345678')
    expect(p.points).toBe(100)
  })

  test('falls back to the email prefix when the auth user has no display name', async () => {
    await ensureUserProfile(aliceDb(), { uid: ALICE, displayName: null, email: 'alice@example.com' })

    const p = await profile(ALICE)
    expect(p.name).toBe('alice')
  })

  test('falls back to a generic name when both display name and email are missing', async () => {
    await ensureUserProfile(aliceDb(), { uid: ALICE, displayName: null, email: null })

    const p = await profile(ALICE)
    expect(p.name).toBe('Member')
    expect(p.email).toBe('')
  })
})
