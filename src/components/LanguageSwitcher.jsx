// ABOUTME: Segmented ไทย | EN toggle that switches the app language via useT().setLang.
// ABOUTME: Presentational; used on the Profile page and the auth pages.
import { useT } from '../i18n/LanguageContext'

export default function LanguageSwitcher() {
  const { lang, setLang } = useT()
  const opts = [
    { code: 'th', label: 'ไทย' },
    { code: 'en', label: 'EN' },
  ]
  return (
    <div className="inline-flex rounded-full border-2 border-gray-200 p-0.5" role="group" aria-label="Language">
      {opts.map(({ code, label }) => {
        const active = lang === code
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            className="px-4 py-1.5 rounded-full text-sm font-black transition-colors"
            style={active ? { background: '#CC0000', color: '#fff' } : { color: '#6b7280' }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
