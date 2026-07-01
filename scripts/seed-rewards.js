// ABOUTME: One-time seeder that writes the starter rewards catalog to Firestore.
// ABOUTME: Signs in as an admin (same path as the dashboard) and upserts each reward by name.
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  getFirestore, collection, getDocs, addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { REWARDS_CATALOG, REWARD_DEFAULTS, validateCatalog } from './rewards-catalog.js'

// Firebase project config comes from the same VITE_* vars the app uses; load them
// with `node --env-file=.env`. Admin credentials are passed in at run time and are
// never stored in the repo.
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

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

async function main() {
  validateCatalog()
  if (!cfg.apiKey || !cfg.projectId) fail('Missing Firebase config. Run with: node --env-file=.env scripts/seed-rewards.js')
  if (!email || !password) fail('Missing admin credentials. Run with: ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret npm run seed:rewards')

  const app = initializeApp(cfg)
  const auth = getAuth(app)
  const db = getFirestore(app)

  console.log(`Signing in as ${email}…`)
  await signInWithEmailAndPassword(auth, email, password)

  // Map existing rewards by name so re-running updates in place instead of
  // creating duplicates.
  const snap = await getDocs(collection(db, 'rewards'))
  const byName = new Map(snap.docs.map(d => [d.data().name, d.id]))

  let created = 0
  let updated = 0
  for (const item of REWARDS_CATALOG) {
    const data = { ...item, ...REWARD_DEFAULTS, updatedAt: serverTimestamp() }
    const existingId = byName.get(item.name)
    if (existingId) {
      await updateDoc(doc(db, 'rewards', existingId), data)
      updated++
      console.log(`  ↻ updated  ${item.emoji} ${item.name} — ${item.pointsCost} pts`)
    } else {
      await addDoc(collection(db, 'rewards'), { ...data, createdAt: serverTimestamp() })
      created++
      console.log(`  + created  ${item.emoji} ${item.name} — ${item.pointsCost} pts`)
    }
  }

  console.log(`\n✓ Done. ${created} created, ${updated} updated.\n`)
  process.exit(0)
}

main().catch((err) => fail(err.message || String(err)))
