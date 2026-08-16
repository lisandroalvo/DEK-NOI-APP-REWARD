// ABOUTME: React language provider exposing useT() { t, lang, setLang } for the customer app.
// ABOUTME: Persists choice to localStorage['dekNoiLang']; defaults to Thai on first load.
import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { translate, resolveInitialLang } from './translate'
import en from './dictionaries/en'
import th from './dictionaries/th'

const DICTS = { en, th }
const STORAGE_KEY = 'dekNoiLang'
const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() =>
    resolveInitialLang(
      typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    )
  )

  const setLang = useCallback((next) => {
    const resolved = resolveInitialLang(next)
    setLangState(resolved)
    try { localStorage.setItem(STORAGE_KEY, resolved) } catch { /* ignore quota/denied */ }
  }, [])

  const t = useCallback(
    (key, vars) => translate(DICTS[lang], en, key, vars),
    [lang]
  )

  const value = useMemo(() => ({ t, lang, setLang }), [t, lang, setLang])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useT() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useT must be used within a LanguageProvider')
  return ctx
}
