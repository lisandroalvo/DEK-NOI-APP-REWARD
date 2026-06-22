// ABOUTME: Unit tests for parseAmount — turns Gemini's text reply into a baht number or null.
// ABOUTME: Pure function, no network; covers plain numbers, currency words, commas, and "none".
import { describe, test, expect } from 'vitest'
import { parseAmount } from '../functions/parseAmount.js'

describe('parseAmount', () => {
  test('parses a plain decimal', () => {
    expect(parseAmount('520.00')).toBe(520)
  })

  test('parses an integer', () => {
    expect(parseAmount('186')).toBe(186)
  })

  test('strips thousands separators', () => {
    expect(parseAmount('1,234.50')).toBe(1234.5)
  })

  test('ignores currency words and symbols', () => {
    expect(parseAmount('THB 90')).toBe(90)
    expect(parseAmount('฿126.00')).toBe(126)
  })

  test('pulls the number out of a sentence', () => {
    expect(parseAmount('The total is 186 baht')).toBe(186)
  })

  test('returns null for "none"', () => {
    expect(parseAmount('none')).toBeNull()
  })

  test('returns null for empty / missing input', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount(null)).toBeNull()
  })

  test('returns null for a non-positive amount', () => {
    expect(parseAmount('0')).toBeNull()
  })
})
