// ABOUTME: Warns users in an in-app browser (LINE/FB/IG) that Google sign-in is blocked there,
// ABOUTME: and offers a one-tap "open in external browser" escape for LINE. Renders nothing otherwise.
import { detectInAppBrowser, buildExternalUrl } from '../lib/inAppBrowser'
import { useT } from '../i18n/LanguageContext'

// Shared by Login and Register — both expose a Google button that silently hangs
// inside these webviews, so both need the same escape hatch.
export default function InAppBrowserNotice() {
  const { t } = useT()
  const inApp = detectInAppBrowser(typeof navigator !== 'undefined' ? navigator.userAgent : '')
  if (!inApp) return null

  const openInBrowser = () => { window.location.href = buildExternalUrl(window.location.href) }

  return (
    <div className="mb-4 p-3 rounded-xl border-2" style={{ borderColor: '#FFE600', background: '#FFFBEB' }}>
      <p className="text-sm font-bold text-gray-800 mb-2">{t('auth.inAppHint')}</p>
      {inApp.canForceExternal ? (
        <button onClick={openInBrowser}
          className="w-full py-2.5 rounded-lg text-sm font-black text-white" style={{ background: '#CC0000' }}>
          {t('auth.inAppOpenBrowser')}
        </button>
      ) : (
        <p className="text-xs text-gray-600 leading-snug">{t('auth.inAppManualHint')}</p>
      )}
    </div>
  )
}
