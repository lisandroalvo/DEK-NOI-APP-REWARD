// ABOUTME: Decides which PWA install affordance to show given platform and app state.
// ABOUTME: Pure logic so the InstallPrompt component stays a thin wrapper around it.
import { detectInAppBrowser } from './inAppBrowser'

// iOS never fires beforeinstallprompt; installing there is always the manual
// Share -> Add to Home Screen flow, so it needs an instructional hint instead.
export function isIOS(userAgent = '') {
  return /iPad|iPhone|iPod/.test(userAgent)
}

// Returns the banner mode to render:
//   'android' — a captured beforeinstallprompt is ready; show a real Install button
//   'ios'     — iOS Safari; show the manual Add to Home Screen hint
//   'line'    — inside LINE, which can be forced to reopen in the system browser
//               where install works; show an "open in browser" escape
//   'hidden'  — already installed, dismissed, an un-escapable webview (FB/IG), or
//               a desktop/unsupported browser with no prompt to offer
export function installBannerState({ userAgent = '', standalone = false, canPrompt = false, dismissed = false }) {
  if (standalone) return 'hidden'   // already installed
  if (dismissed) return 'hidden'    // user closed the banner

  const inApp = detectInAppBrowser(userAgent)
  if (inApp) return inApp.canForceExternal ? 'line' : 'hidden'

  if (canPrompt) return 'android'
  if (isIOS(userAgent)) return 'ios'
  return 'hidden'
}
