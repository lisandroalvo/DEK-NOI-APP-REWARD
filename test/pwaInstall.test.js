// ABOUTME: Tests the PWA install-banner decision logic across platforms and states.
// ABOUTME: Pure logic so the InstallPrompt component can stay a thin wrapper.
import { describe, test, expect } from 'vitest'
import { installBannerState, isIOS } from '../src/lib/pwaInstall.js'

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36'
const LINE_UA = ANDROID_UA + ' Line/13.5.0'
const FB_UA = ANDROID_UA + ' [FBAN/FB4A;FBAV/450.0]'
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

describe('isIOS', () => {
  test('detects iPhone/iPad/iPod', () => {
    expect(isIOS(IOS_UA)).toBe(true)
    expect(isIOS('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true)
  })
  test('is false for android and desktop', () => {
    expect(isIOS(ANDROID_UA)).toBe(false)
    expect(isIOS(DESKTOP_UA)).toBe(false)
    expect(isIOS('')).toBe(false)
  })
})

describe('installBannerState', () => {
  test('shows the native prompt when a deferred prompt is available', () => {
    expect(installBannerState({ userAgent: ANDROID_UA, canPrompt: true })).toBe('android')
  })

  test('shows the iOS hint on iPhone Safari without a prompt', () => {
    expect(installBannerState({ userAgent: IOS_UA, canPrompt: false })).toBe('ios')
  })

  test('is hidden once already installed (standalone), even with a prompt', () => {
    expect(installBannerState({ userAgent: ANDROID_UA, canPrompt: true, standalone: true })).toBe('hidden')
  })

  test('is hidden after the user dismisses it', () => {
    expect(installBannerState({ userAgent: ANDROID_UA, canPrompt: true, dismissed: true })).toBe('hidden')
    expect(installBannerState({ userAgent: IOS_UA, dismissed: true })).toBe('hidden')
  })

  test('offers a browser escape inside LINE (which can be forced external)', () => {
    expect(installBannerState({ userAgent: LINE_UA, canPrompt: true })).toBe('line')
    expect(installBannerState({ userAgent: LINE_UA, canPrompt: false })).toBe('line')
  })

  test('is hidden inside FB/IG webviews that cannot be forced external', () => {
    expect(installBannerState({ userAgent: FB_UA, canPrompt: true })).toBe('hidden')
  })

  test('the LINE escape still yields to standalone and dismissal', () => {
    expect(installBannerState({ userAgent: LINE_UA, standalone: true })).toBe('hidden')
    expect(installBannerState({ userAgent: LINE_UA, dismissed: true })).toBe('hidden')
  })

  test('is hidden on desktop with no prompt available', () => {
    expect(installBannerState({ userAgent: DESKTOP_UA, canPrompt: false })).toBe('hidden')
  })
})
