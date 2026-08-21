// ABOUTME: Tests the landing page copy module and its language fallback.
// ABOUTME: Ensures Thai is the default and both locales expose the same keys.
import { describe, it, expect } from 'vitest'
import { CONTENT, getContent } from './content.js'

describe('landing content', () => {
  it('defaults to Thai for unknown language', () => {
    expect(getContent('xx')).toBe(CONTENT.th)
    expect(getContent(undefined)).toBe(CONTENT.th)
  })

  it('returns English when asked', () => {
    expect(getContent('en')).toBe(CONTENT.en)
  })

  it('exposes identical keys in both locales', () => {
    expect(Object.keys(CONTENT.th).sort()).toEqual(Object.keys(CONTENT.en).sort())
  })

  it('carries the real contact details in both locales', () => {
    for (const lang of ['th', 'en']) {
      expect(CONTENT[lang].contactEmail).toBe('deknoi24@gmail.com')
      expect(CONTENT[lang].contactPhone).toBe('062-028-3183')
      expect(CONTENT[lang].locationName).toBe('Supalai River Resort')
    }
  })
})
