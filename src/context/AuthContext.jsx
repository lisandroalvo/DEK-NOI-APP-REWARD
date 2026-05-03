import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
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
        setUser(firebaseUser)
        const ref = doc(db, 'users', firebaseUser.uid)

        // Real-time listener — profile stays fresh (points update live)
        unsubProfileRef.current = onSnapshot(ref, async (snap) => {
          if (!snap.exists()) {
            const data = {
              name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              email: firebaseUser.email,
              phone: '',
              role: 'customer',
              points: 0,
              createdAt: serverTimestamp(),
            }
            await setDoc(ref, data)
            setProfile(data)
          } else {
            setProfile(snap.data())
          }
          setLoading(false)
        })
      } else {
        setUser(null)
        setProfile(null)
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
    const data = { name, phone, email, role: 'customer', points: 0, createdAt: serverTimestamp() }
    await setDoc(doc(db, 'users', cred.user.uid), data)
    return cred
  }

  const logout = () => {
    sessionStorage.removeItem('hasSeenSplash')
    return signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, loginWithGoogle, register, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
