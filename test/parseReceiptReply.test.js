// ABOUTME: Tests for parseReceiptReply — the receipt-scan model reply parser.
// ABOUTME: Covers clean JSON, code-fenced JSON, malformed replies, and merchant validation.
import { describe, test, expect } from 'vitest'
import { parseReceiptReply } from '../functions/parseReceiptReply.js'

describe('parseReceiptReply', () => {
  test('clean JSON returns amount + merchant', () => {
    expect(parseReceiptReply('{"total": 120, "merchant": "match"}')).toEqual({ amount: 120, merchant: 'match' })
  })

  test('mismatch merchant is preserved', () => {
    expect(parseReceiptReply('{"total": 55.5, "merchant": "mismatch"}')).toEqual({ amount: 55.5, merchant: 'mismatch' })
  })

  test('JSON wrapped in code fences / prose is still parsed', () => {
    expect(parseReceiptReply('```json\n{"total": 90, "merchant": "unclear"}\n```')).toEqual({ amount: 90, merchant: 'unclear' })
  })

  test('null total yields amount null', () => {
    expect(parseReceiptReply('{"total": null, "merchant": "match"}')).toEqual({ amount: null, merchant: 'match' })
  })

  test('an unknown/invalid merchant value falls back to unclear', () => {
    expect(parseReceiptReply('{"total": 20, "merchant": "yes"}').merchant).toBe('unclear')
  })

  test('missing merchant field falls back to unclear', () => {
    expect(parseReceiptReply('{"total": 20}').merchant).toBe('unclear')
  })

  test('malformed reply falls back to raw amount parse + unclear', () => {
    // Not JSON — parseAmount reads the number out of the raw text; merchant unknown.
    expect(parseReceiptReply('520.00')).toEqual({ amount: 520, merchant: 'unclear' })
  })

  test('empty / nullish reply yields amount null + unclear', () => {
    expect(parseReceiptReply('')).toEqual({ amount: null, merchant: 'unclear' })
    expect(parseReceiptReply(null)).toEqual({ amount: null, merchant: 'unclear' })
  })
})
