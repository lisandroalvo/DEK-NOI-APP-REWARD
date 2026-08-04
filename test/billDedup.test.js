// ABOUTME: Unit tests for the pure duplicate-receipt helpers (hashing + soft-flags).
// ABOUTME: No Firebase/emulator needed — runs under plain vitest.
import { describe, test, expect } from 'vitest'
import { hashImageBytes, duplicateFlagsFor, normalizeRef, hashText } from '../src/lib/billDedup.js'

const ts = (isoDate) => ({ toDate: () => new Date(isoDate) })

describe('hashImageBytes', () => {
  test('same bytes hash to the same hex string', async () => {
    const a = new TextEncoder().encode('hello').buffer
    const b = new TextEncoder().encode('hello').buffer
    expect(await hashImageBytes(a)).toBe(await hashImageBytes(b))
  })
  test('different bytes hash differently', async () => {
    const a = new TextEncoder().encode('hello').buffer
    const b = new TextEncoder().encode('world').buffer
    expect(await hashImageBytes(a)).not.toBe(await hashImageBytes(b))
  })
})

describe('duplicateFlagsFor', () => {
  const bills = [
    { id: '1', imageHash: 'aaa', amount: 50, submittedAt: ts('2026-07-06T10:00:00') },
    { id: '2', imageHash: 'aaa', amount: 99, submittedAt: ts('2026-07-01T10:00:00') },
    { id: '3', imageHash: 'bbb', amount: 50, submittedAt: ts('2026-07-06T18:00:00') },
  ]
  test('flags an exact image match on another bill', () => {
    expect(duplicateFlagsFor(bills[0], bills).exactImage).toBe(true)
  })
  test('flags same amount and same calendar day', () => {
    expect(duplicateFlagsFor(bills[0], bills).sameAmountDay).toBe(true)
  })
  test('no flags when nothing matches', () => {
    const lone = { id: '9', imageHash: 'zzz', amount: 12, submittedAt: ts('2026-07-06T10:00:00') }
    const f = duplicateFlagsFor(lone, [...bills, lone])
    expect(f.exactImage).toBe(false)
    expect(f.sameAmountDay).toBe(false)
  })
  test('never flags a bill against itself', () => {
    const f = duplicateFlagsFor(bills[1], [bills[1]])
    expect(f.exactImage).toBe(false)
    expect(f.sameAmountDay).toBe(false)
  })
  test('flags a matching receipt ref on another bill (even with a different image)', () => {
    const refBills = [
      { id: 'a', imageHash: 'x', receiptRef: 'R2-100', amount: 10, submittedAt: ts('2026-08-01T10:00:00') },
      { id: 'b', imageHash: 'y', receiptRef: 'R2-100', amount: 20, submittedAt: ts('2026-08-02T10:00:00') },
    ]
    expect(duplicateFlagsFor(refBills[0], refBills).sameRef).toBe(true)
  })
  test('does not flag sameRef when refs differ or are absent', () => {
    const refBills = [
      { id: 'a', receiptRef: 'R2-100' },
      { id: 'b', receiptRef: 'R2-200' },
      { id: 'c' }, // no ref
    ]
    expect(duplicateFlagsFor(refBills[0], refBills).sameRef).toBe(false)
    expect(duplicateFlagsFor(refBills[2], refBills).sameRef).toBe(false)
  })
})

describe('normalizeRef', () => {
  test('trims, upper-cases, and strips inner whitespace', () => {
    expect(normalizeRef('  r2 100 ')).toBe('R2100')
  })
  test('empty or non-string becomes null', () => {
    expect(normalizeRef('   ')).toBeNull()
    expect(normalizeRef(null)).toBeNull()
    expect(normalizeRef(12345)).toBeNull()
  })
})

describe('hashText', () => {
  test('same normalized ref hashes the same; different refs differ', async () => {
    expect(await hashText('R2100')).toBe(await hashText('R2100'))
    expect(await hashText('R2100')).not.toBe(await hashText('R2200'))
  })
  test('returns a 64-char hex string (SHA-256)', async () => {
    expect(await hashText('R2100')).toMatch(/^[0-9a-f]{64}$/)
  })
})
