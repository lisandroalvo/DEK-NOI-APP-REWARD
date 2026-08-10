// ABOUTME: Registers the PWA service worker and keeps it fresh — checks for a new build
// ABOUTME: periodically and whenever the app regains focus, so deploys reach already-open apps.
import { registerSW } from 'virtual:pwa-register'

// registerType is 'autoUpdate' (vite.config.js), so a detected update is applied and the
// page reloaded automatically. Frequent checks just shorten how long an open app runs the
// old build after a deploy.
const UPDATE_INTERVAL_MS = 60 * 60 * 1000 // hourly

registerSW({
  immediate: true,
  onRegisteredSW(_swScriptUrl, registration) {
    if (!registration) return
    const check = () => { registration.update().catch(() => { /* offline / transient */ }) }
    setInterval(check, UPDATE_INTERVAL_MS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  },
})
