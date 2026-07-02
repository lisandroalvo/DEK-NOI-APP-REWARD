import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendEmailVerification } from 'firebase/auth'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { ensureUserProfile } from '../lib/userProfile'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(false)
  const unsubProfileRef = useRef(null)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Tear down any previous profile listener
      if (unsubProfileRef.current) {
        unsubProfileRef.current()
        unsubProfileRef.current = null
      }

      if (firebaseUser) {
        setLoading(true)
        setProfileError(false)
        setUser(firebaseUser)
        const ref = doc(db, 'users', firebaseUser.uid)

        // Real-time listener — profile stays fresh (points update live)
        unsubProfileRef.current = onSnapshot(ref, async (snap) => {
          if (snap.exists()) {
            setProfile(snap.data())
            setLoading(false)
            return
          }
          // No profile doc yet (e.g. first Google sign-in). Create it, then let
          // this same listener re-fire with the new doc to resolve loading. A
          // failed create must not strand the user on a blank gated screen.
          try {
            await ensureUserProfile(db, firebaseUser)
          } catch (err) {
            console.error('Failed to create user profile', err)
            setProfileError(true)
            setLoading(false)
          }
        }, (err) => {
          console.error('Profile listener failed', err)
          setProfileError(true)
          setLoading(false)
        })
      } else {
        setUser(null)
        setProfile(null)
        setProfileError(false)
        setLoading(false)
      }
    })

    return () => {
      unsubAuth()
      if (unsubProfileRef.current) unsubProfileRef.current()
    }
  }, [])

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)

  const loginWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider())

  const register = async (email, password, name, phone) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const data = { name, phone, email, role: 'customer', points: 0, totalSpent: 0, spendCarry: 0, createdAt: serverTimestamp() }
    await setDoc(doc(db, 'users', cred.user.uid), data)
    // Send a verification email, but never fail signup if it can't be sent.
    try {
      await sendEmailVerification(cred.user)
    } catch (err) {
      console.error('Could not send verification email', err)
    }
    return cred
  }

  const logout = () => {
    sessionStorage.removeItem('splashShown')
    return signOut(auth)
  }

  // A signed-in user whose profile could not be loaded would otherwise fall
  // through to a blank gated screen; show a recoverable error instead.
  const showProfileError = profileError && user

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, loginWithGoogle, register, logout }}>
      {loading ? null : showProfileError ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-white">
          <p className="text-base font-black text-gray-900 mb-1">We couldn't load your profile</p>
          <p className="text-sm text-gray-500 mb-5">Please check your connection and try again.</p>
          <button onClick={() => window.location.reload()}
            className="px-5 py-3 rounded-xl text-sm font-black text-white" style={{ background: '#CC0000' }}>
            Retry
          </button>
          <button onClick={logout} className="mt-3 text-xs text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      ) : children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider by design; only affects fast-refresh, not correctness.
export const useAuth = () => useContext(AuthContext)
