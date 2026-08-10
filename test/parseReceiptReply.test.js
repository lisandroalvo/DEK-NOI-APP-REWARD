// ABOUTME: Tests for parseReceiptReply — the receipt-scan model reply parser.
// ABOUTME: Covers clean JSON, code-fenced JSON, malformed replies, merchant + ref extraction.
import { describe, test, expect } from 'vitest'
import { parseReceiptReply } from '../functions/parseReceiptReply.js'

describe('parseReceiptReply', () => {
  test('clean JSON returns amount + merchant + ref', () => {
    expect(parseReceiptReply('{"total": 120, "merchant": "match", "ref": "INV-00042"}'))
      .toEqual({ amount: 120, merchant: 'match', ref: 'INV-00042' })
  })

  test('mismatch merchant is preserved', () => {
    expect(parseReceiptReply('{"total": 55.5, "merchant": "mismatch", "ref": null}'))
      .toEqual({ amount: 55.5, merchant: 'mismatch', ref: null })
  })

  test('JSON wrapped in code fences / prose is still parsed', () => {
    expect(parseReceiptReply('```json\n{"total": 90, "merchant": "unclear", "ref": "B12"}\n```'))
      .toEqual({ amount: 90, merchant: 'unclear', ref: 'B12' })
  })

  test('null total yields amount null', () => {
    expect(parseReceiptReply('{"total": null, "merchant": "match", "ref": "X1"}'))
      .toEqual({ amount: null, merchant: 'match', ref: 'X1' })
  })

  test('a ref is trimmed; a missing or non-string ref becomes null', () => {
    expect(parseReceiptReply('{"total": 10, "merchant": "match", "ref": "  R2-99  "}').ref).toBe('R2-99')
    expect(parseReceiptReply('{"total": 10, "merchant": "match"}').ref).toBeNull()
    expect(parseReceiptReply('{"total": 10, "merchant": "match", "ref": 12345}').ref).toBeNull()
    expect(parseReceiptReply('{"total": 10, "merchant": "match", "ref": "   "}').ref).toBeNull()
  })

  test('an unknown/invalid merchant value falls back to unclear', () => {
    expect(parseReceiptReply('{"total": 20, "merchant": "yes"}').merchant).toBe('unclear')
  })

  test('missing merchant field falls back to unclear', () => {
    expect(parseReceiptReply('{"total": 20}').merchant).toBe('unclear')
  })

  test('malformed reply falls back to raw amount parse + unclear + null ref', () => {
    expect(parseReceiptReply('520.00')).toEqual({ amount: 520, merchant: 'unclear', ref: null })
  })

  test('empty / nullish reply yields amount null + unclear + null ref', () => {
    expect(parseReceiptReply('')).toEqual({ amount: null, merchant: 'unclear', ref: null })
    expect(parseReceiptReply(null)).toEqual({ amount: null, merchant: 'unclear', ref: null })
  })
})
