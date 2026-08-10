// ABOUTME: Verifies the ownership guard used by redeemReward — only the redemption's own
// ABOUTME: userId may drive it; a missing redemption is rejected before ownership is checked.
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { assertOwner } from '../functions/redeemReward.js'

const PROJECT_ID = 'demo-dek-noi'
let app, db
async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' })
}
// redeemReward.js's own module-level admin init (if (getApps().length === 0) initializeApp())
// already runs on import above, so reuse that default app rather than re-initializing it.
beforeAll(() => { app = getApps().length === 0 ? initializeApp({ projectId: PROJECT_ID }) : getApps()[0]; db = getFirestore() })
afterAll(async () => { await deleteApp(app) })
beforeEach(clearFirestore)

describe('assertOwner', () => {
  test('resolves with the redemption data for its own userId', async () => {
    await db.collection('redemptions').doc('rd1').set({ userId: 'u1', status: 'reserving' })
    await expect(assertOwner(db, 'rd1', 'u1')).resolves.toMatchObject({ userId: 'u1', status: 'reserving' })
  })
  test('throws permission-denied for a different user', async () => {
    await db.collection('redemptions').doc('rd1').set({ userId: 'u1', status: 'reserving' })
    await expect(assertOwner(db, 'rd1', 'other')).rejects.toThrow(/[Nn]ot your/)
  })
  test('throws not-found for a missing redemption', async () => {
    await expect(assertOwner(db, 'ghost', 'u1')).rejects.toThrow(/not found/i)
  })
})
