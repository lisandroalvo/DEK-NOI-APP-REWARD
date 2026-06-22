// ABOUTME: Tests for the auth-form helpers — friendly error messages and password validation.
// ABOUTME: Pure functions, no emulator needed; guards we never show raw Firebase codes to users.
import { describe, test, expect } from 'vitest'
import { authErrorMessage, passwordError, MIN_PASSWORD_LENGTH } from '../src/lib/authForm.js'

describe('authErrorMessage', () => {
  test('maps email-already-in-use to a friendly, actionable message', () => {
    expect(authErrorMessage('auth/email-already-in-use')).toMatch(/already (exists|registered)/i)
  })

  test('maps weak-password to the character requirement', () => {
    expect(authErrorMessage('auth/weak-password')).toMatch(/8 characters/i)
  })

  test('never leaks a raw firebase code for an unknown error', () => {
    const msg = authErrorMessage('auth/some-future-code')
    expect(msg).not.toMatch(/auth\//)
    expect(msg.length).toBeGreaterThan(0)
  })

  test('uses the caller-provided fallback for unknown codes', () => {
    expect(authErrorMessage('auth/whatever', 'Registration failed.')).toBe('Registration failed.')
  })
})

describe('passwordError', () => {
  test('rejects passwords shorter than the minimum', () => {
    expect(passwordError('short')).toMatch(/8 characters/i)
  })

  test('accepts passwords at or above the minimum', () => {
    expect(passwordError('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull()
  })

  test('rejects an empty password', () => {
    expect(passwordError('')).toMatch(/8 characters/i)
  })
})
