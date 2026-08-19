// ABOUTME: Detects in-app browser webviews (LINE, Facebook, Instagram) where Google OAuth is blocked,
// ABOUTME: and builds a LINE "open in external browser" URL so sign-in can continue in the real browser.

// Google refuses OAuth inside embedded webviews, so users arriving via these apps
// must be sent to their system browser. Only LINE exposes a flag to auto-escape.
const SIGNATURES = [
  // LINE tags itself " Line/<version>"; the \b guards against substrings like "airline/".
  { name: 'line', canForceExternal: true, test: (ua) => /\bLine\/\d/i.test(ua) },
  { name: 'facebook', canForceExternal: false, test: (ua) => /\bFB(AN|AV|_IAB)\b/.test(ua) },
  { name: 'instagram', canForceExternal: false, test: (ua) => /\bInstagram\b/.test(ua) },
]

// Returns { name, canForceExternal } for a known in-app browser, or null for a
// normal browser. Intentionally conservative: unknown user-agents return null so
// we never nag someone whose browser handles Google sign-in fine.
export function detectInAppBrowser(userAgent) {
  if (!userAgent) return null
  const match = SIGNATURES.find((s) => s.test(userAgent))
  return match ? { name: match.name, canForceExternal: match.canForceExternal } : null
}

// Appends LINE's documented openExternalBrowser=1 flag, which tells the LINE
// in-app browser to reopen the URL in the system default browser. Existing query
// params are preserved and the flag is set idempotently.
export function buildExternalUrl(href) {
  const url = new URL(href)
  url.searchParams.set('openExternalBrowser', '1')
  return url.toString()
}
