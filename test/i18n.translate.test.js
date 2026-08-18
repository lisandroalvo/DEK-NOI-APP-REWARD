// ABOUTME: Unit tests for the pure i18n string resolver and initial-language logic.
// ABOUTME: Runs in node (no DOM); guards lookup, interpolation, fallback, and default language.
import { describe, test, expect } from 'vitest'
import { translate, resolveInitialLang } from '../src/i18n/translate.js'

const en = { common: { cancel: 'Cancel' }, dashboard: { greeting: 'Hi, {name} 👋' } }
const th = { common: { cancel: 'ยกเลิก' }, dashboard: { greeting: 'สวัสดี {name} 👋' } }

describe('translate', () => {
  test('resolves a nested key in the active dictionary', () => {
    expect(translate(th, en, 'common.cancel')).toBe('ยกเลิก')
  })
  test('interpolates {var} placeholders', () => {
    expect(translate(th, en, 'dashboard.greeting', { name: 'Nok' })).toBe('สวัสดี Nok 👋')
  })
  test('falls back to en when key missing in active dict', () => {
    const partialTh = { common: {} }
    expect(translate(partialTh, en, 'common.cancel')).toBe('Cancel')
  })
  test('returns the key itself when missing everywhere', () => {
    expect(translate(th, en, 'nope.missing')).toBe('nope.missing')
  })
  test('leaves an unmatched placeholder literal', () => {
    expect(translate(en, en, 'dashboard.greeting')).toBe('Hi, {name} 👋')
  })
  test('interpolates a falsy (0) var instead of dropping it', () => {
    expect(translate(en, en, 'dashboard.greeting', { name: 0 })).toBe('Hi, 0 👋')
  })
})

describe('resolveInitialLang', () => {
  test('keeps a valid stored value', () => {
    expect(resolveInitialLang('en')).toBe('en')
    expect(resolveInitialLang('th')).toBe('th')
  })
  test('defaults to th for null/garbage', () => {
    expect(resolveInitialLang(null)).toBe('th')
    expect(resolveInitialLang('fr')).toBe('th')
  })
})
