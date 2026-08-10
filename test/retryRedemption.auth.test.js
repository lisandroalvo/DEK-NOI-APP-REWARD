// ABOUTME: Verifies the admin gate used by retryRedemption — only role:'admin' users pass.
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeApp, getApps, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { assertAdmin } from '../functions/retryRedemption.js'

const PROJECT_ID = 'demo-dek-noi'
let app, db
async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' })
}
// retryRedemption.js's own module-level admin init (if (getApps().length === 0) initializeApp())
// already runs on import above, so reuse that default app rather than re-initializing it.
beforeAll(() => { app = getApps().length === 0 ? initializeApp({ projectId: PROJECT_ID }) : getApps()[0]; db = getFirestore() })
afterAll(async () => { await deleteApp(app) })
beforeEach(clearFirestore)

describe('assertAdmin', () => {
  test('passes for an admin user', async () => {
    await db.collection('users').doc('admin1').set({ role: 'admin' })
    await expect(assertAdmin(db, 'admin1')).resolves.toBeUndefined()
  })
  test('throws for a customer', async () => {
    await db.collection('users').doc('cust1').set({ role: 'customer' })
    await expect(assertAdmin(db, 'cust1')).rejects.toThrow(/[Aa]dmin/)
  })
  test('throws for a missing user', async () => {
    await expect(assertAdmin(db, 'ghost')).rejects.toThrow()
  })
})
