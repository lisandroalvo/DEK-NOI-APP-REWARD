// ABOUTME: Guards that the en and th dictionaries expose exactly the same key paths.
// ABOUTME: A key added to one language but not the other fails here — keeps coverage pristine.
import { describe, test, expect } from 'vitest'
import en from '../src/i18n/dictionaries/en.js'
import th from '../src/i18n/dictionaries/th.js'

function paths(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const p = prefix ? `${prefix}.${k}` : k
    return v && typeof v === 'object' ? paths(v, p) : [p]
  })
}

describe('dictionary parity', () => {
  test('en and th have identical key sets', () => {
    const enKeys = paths(en).sort()
    const thKeys = paths(th).sort()
    expect(thKeys).toEqual(enKeys)
  })
  test('no value is an empty string', () => {
    for (const dict of [en, th]) {
      for (const p of paths(dict)) {
        const val = p.split('.').reduce((n, k) => n[k], dict)
        expect(val, `${p} is empty`).not.toBe('')
      }
    }
  })
})
