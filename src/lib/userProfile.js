// ABOUTME: Bootstraps a user's Firestore profile document on first sign-in.
// ABOUTME: Non-destructive — a transaction re-checks existence so it never clobbers registration data.
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore'
import { PRIVACY_POLICY_VERSION } from './privacy'

// Create the profile for `firebaseUser` if it does not already exist. Runs in a
// transaction so a profile written concurrently by register() always wins over
// these auth defaults, regardless of which write the server sees first.
export async function ensureUserProfile(db, firebaseUser) {
  const ref = doc(db, 'users', firebaseUser.uid)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (snap.exists()) return
    tx.set(ref, {
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Member',
      email: firebaseUser.email || '',
      phone: '',
      role: 'customer',
      points: 0,
      totalSpent: 0,
      spendCarry: 0,
      createdAt: serverTimestamp(),
      privacyConsentAt: serverTimestamp(),
      privacyConsentVersion: PRIVACY_POLICY_VERSION,
    })
  })
}
