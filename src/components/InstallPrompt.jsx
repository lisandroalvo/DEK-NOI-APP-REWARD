// ABOUTME: Dismissible "install this app" banner — native prompt on Android, a manual
// ABOUTME: hint on iOS, and a LINE browser-escape where install is otherwise blocked.
import { useEffect, useState } from 'react'
import { X, Download, Share } from 'lucide-react'
import { installBannerState } from '../lib/pwaInstall'
import { buildExternalUrl } from '../lib/inAppBrowser'
import { useT } from '../i18n/LanguageContext'

const DISMISS_KEY = 'dekNoiInstallDismissed'

function persistDismiss() {
  try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode: dismiss for this session only */ }
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export default function InstallPrompt() {
  const { t } = useT()
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    // Chrome/Android fires this instead of showing its own mini-infobar; we stash the
    // event and trigger it from our own button so the prompt matches the app's look.
    const onBeforeInstall = (e) => { e.preventDefault(); setDeferredPrompt(e) }
    // Once installed, drop the banner for good.
    const onInstalled = () => { setDeferredPrompt(null); setDismissed(true); persistDismiss() }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const hide = () => { setDismissed(true); persistDismiss() }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const mode = installBannerState({
    userAgent: ua,
    standalone: isStandalone(),
    canPrompt: !!deferredPrompt,
    dismissed,
  })
  if (mode === 'hidden') return null

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    hide()
  }

  const openInBrowser = () => { window.location.href = buildExternalUrl(window.location.href) }

  const body = mode === 'ios' ? t('install.iosHint')
    : mode === 'line' ? t('install.lineBody')
    : t('install.body')

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-[88px] md:bottom-6 z-30 w-[92%] max-w-md">
      <div className="relative bg-white rounded-2xl shadow-2xl border-2 p-4 pr-9" style={{ borderColor: '#FFE600' }}>
        <button onClick={hide} aria-label={t('install.dismiss')}
          className="absolute top-2.5 right-2.5 p-1 rounded-lg text-gray-400 hover:bg-gray-100">
          <X size={18} />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FFF0F0' }}>
            <span className="text-2xl">📲</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-gray-900">{t('install.title')}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{body}</p>

            {mode === 'android' && (
              <button onClick={install}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-white"
                style={{ background: '#CC0000' }}>
                <Download size={16} /> {t('install.button')}
              </button>
            )}
            {mode === 'line' && (
              <button onClick={openInBrowser}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-white"
                style={{ background: '#CC0000' }}>
                <Share size={16} /> {t('install.openBrowser')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
