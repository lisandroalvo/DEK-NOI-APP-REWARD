// ABOUTME: One-time migration that doubles every reward's pointsCost in Firestore.
// ABOUTME: Pairs with the ฿50→฿25 earning-rate change so the % return is unchanged.
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  getFirestore, collection, getDocs, updateDoc, doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore'

// Firebase project config comes from the same VITE_* vars the app uses; load them
// with `node --env-file=.env`. Admin credentials are passed in at run time and are
// never stored in the repo. Writes only happen when APPLY=1 — otherwise it's a dry run.
const cfg = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}
const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
const APPLY = process.env.APPLY === '1'

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

async function main() {
  if (!cfg.apiKey || !cfg.projectId) fail('Missing Firebase config. Run with: node --env-file=.env scripts/double-reward-points.js')
  if (!email || !password) fail('Missing admin credentials. Run with: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret npm run migrate:reward-points')

  const app = initializeApp(cfg)
  const auth = getAuth(app)
  const db = getFirestore(app)

  console.log(`Signing in as ${email}…`)
  await signInWithEmailAndPassword(auth, email, password)

  // Guard against a double-run: doubling is not idempotent, so if the marker
  // already exists we refuse rather than turn 2× into 4×.
  const markerRef = doc(db, 'migrations', 'double-reward-points')
  const markerSnap = await getDoc(markerRef)
  if (markerSnap.exists()) {
    fail(`Migration already applied on ${markerSnap.data().appliedAt?.toDate?.() ?? '(unknown date)'}. Refusing to re-double. Delete migrations/double-reward-points to force a re-run.`)
  }

  const snap = await getDocs(collection(db, 'rewards'))
  if (snap.empty) fail('No rewards found. Nothing to migrate.')

  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN'} — doubling pointsCost on ${snap.size} reward(s):\n`)

  const plan = []
  for (const d of snap.docs) {
    const data = d.data()
    const oldCost = data.pointsCost
    if (!Number.isFinite(oldCost) || oldCost <= 0) {
      console.log(`  ! skipped  ${data.emoji || ''} ${data.name || d.id} — invalid pointsCost (${oldCost})`)
      continue
    }
    const newCost = oldCost * 2
    plan.push({ id: d.id, newCost })
    console.log(`  ${data.emoji || '•'} ${data.name || d.id}: ${oldCost} → ${newCost} pts`)
  }

  if (!APPLY) {
    console.log(`\nDry run only — no writes. Re-run with APPLY=1 to write:\n  APPLY=1 ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run migrate:reward-points\n`)
    process.exit(0)
  }

  for (const { id, newCost } of plan) {
    await updateDoc(doc(db, 'rewards', id), { pointsCost: newCost, updatedAt: serverTimestamp() })
  }
  await setDoc(markerRef, { appliedAt: serverTimestamp(), rewardsUpdated: plan.length, note: 'Doubled pointsCost for the ฿50→฿25 earning-rate change.' })

  console.log(`\n✓ Done. Doubled pointsCost on ${plan.length} reward(s) and wrote the migration marker.\n`)
  process.exit(0)
}

main().catch((err) => fail(err.message || String(err)))
