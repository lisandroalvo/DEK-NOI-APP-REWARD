// ABOUTME: Unit tests for in-app browser detection — the helper that spots LINE/Facebook/Instagram
// ABOUTME: webviews (where Google OAuth is blocked) and builds a LINE "open in external browser" URL.
import { describe, test, expect } from 'vitest'
import { detectInAppBrowser, buildExternalUrl } from '../src/lib/inAppBrowser.js'

// Real-world user-agent strings (trimmed) captured from each app's in-app browser.
const UA = {
  lineIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/13.1.0',
  lineAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/110.0.0.0 Mobile Safari/537.36 Line/13.2.0/IAB',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/400.0.0.0]',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/400.0.0.0;]',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 280.0.0.0 (iPhone14,2; iOS 16_0)',
  safariIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  chromeDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
}

describe('detectInAppBrowser', () => {
  test('LINE iOS is detected and can be forced to an external browser', () => {
    expect(detectInAppBrowser(UA.lineIOS)).toEqual({ name: 'line', canForceExternal: true })
  })

  test('LINE Android is detected and can be forced to an external browser', () => {
    expect(detectInAppBrowser(UA.lineAndroid)).toEqual({ name: 'line', canForceExternal: true })
  })

  test('Facebook (FBAV) webview is detected but cannot auto-escape', () => {
    expect(detectInAppBrowser(UA.facebook)).toEqual({ name: 'facebook', canForceExternal: false })
    expect(detectInAppBrowser(UA.facebookAndroid)).toEqual({ name: 'facebook', canForceExternal: false })
  })

  test('Instagram webview is detected but cannot auto-escape', () => {
    expect(detectInAppBrowser(UA.instagram)).toEqual({ name: 'instagram', canForceExternal: false })
  })

  test('normal mobile and desktop browsers return null', () => {
    expect(detectInAppBrowser(UA.safariIOS)).toBeNull()
    expect(detectInAppBrowser(UA.chromeAndroid)).toBeNull()
    expect(detectInAppBrowser(UA.chromeDesktop)).toBeNull()
  })

  test('missing or empty user-agent returns null (never nag a normal browser)', () => {
    expect(detectInAppBrowser('')).toBeNull()
    expect(detectInAppBrowser(undefined)).toBeNull()
    expect(detectInAppBrowser(null)).toBeNull()
  })

  test('does not false-positive on the substring "line" inside other tokens', () => {
    const airline = 'Mozilla/5.0 AirlineApp/2.0 Safari/537.36'
    expect(detectInAppBrowser(airline)).toBeNull()
  })
})

describe('buildExternalUrl', () => {
  test('appends the LINE openExternalBrowser flag', () => {
    expect(buildExternalUrl('https://app.example.com/login'))
      .toBe('https://app.example.com/login?openExternalBrowser=1')
  })

  test('preserves existing query parameters', () => {
    const out = buildExternalUrl('https://app.example.com/login?ref=promo')
    const params = new URL(out).searchParams
    expect(params.get('ref')).toBe('promo')
    expect(params.get('openExternalBrowser')).toBe('1')
  })

  test('is idempotent — never duplicates the flag', () => {
    const once = buildExternalUrl('https://app.example.com/login?openExternalBrowser=1')
    expect(once).toBe('https://app.example.com/login?openExternalBrowser=1')
  })
})
