// ABOUTME: Helpers for the login/register forms — friendly auth error copy and password rules.
// ABOUTME: Keeps raw Firebase error codes out of the UI and the password rule in one place.

export const MIN_PASSWORD_LENGTH = 8

// Sign-in failures (wrong-password / user-not-found / invalid-credential) all
// map to the SAME generic message so the form never reveals whether an email is
// registered — preserving the login flow's anti-enumeration behaviour.
const MESSAGES = {
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/user-not-found': 'Invalid email or password.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
  'auth/weak-password': `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
}

// Map a Firebase auth error code to user-facing copy. Unknown codes fall back to
// the caller's generic message so we never surface a raw `auth/...` string.
export function authErrorMessage(code, fallback = 'Something went wrong. Please try again.') {
  return code in MESSAGES ? MESSAGES[code] : fallback
}

// Returns an error string if the password is too short, or null if it passes.
export function passwordError(password) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  return null
}
