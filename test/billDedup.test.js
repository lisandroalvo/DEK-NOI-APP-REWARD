// ABOUTME: Unit tests for the pure duplicate-receipt helpers (hashing + soft-flags).
// ABOUTME: No Firebase/emulator needed — runs under plain vitest.
import { describe, test, expect } from 'vitest'
import { hashImageBytes, duplicateFlagsFor } from '../src/lib/billDedup.js'

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
})
