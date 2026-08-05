// ABOUTME: Unit tests for pure admin-redemption view helpers (filter/search/summarize).
import { describe, test, expect } from 'vitest'
import {
  NEEDS_ATTENTION_STATUSES, isNeedsAttention, outcomeOf,
  matchesHistoryFilter, matchesSearch, summarize,
} from '../src/lib/redemptions.js'

describe('needs-attention selection', () => {
  test('reserving and pending need attention; terminal states do not', () => {
    expect(NEEDS_ATTENTION_STATUSES).toEqual(['reserving', 'pending'])
    expect(isNeedsAttention('reserving')).toBe(true)
    expect(isNeedsAttention('pending')).toBe(true)
    expect(isNeedsAttention('approved')).toBe(false)
    expect(isNeedsAttention('collected')).toBe(false)
    expect(isNeedsAttention('rejected')).toBe(false)
  })
})

describe('outcomeOf', () => {
  test('approved and legacy collected both read as completed', () => {
    expect(outcomeOf('approved')).toBe('completed')
    expect(outcomeOf('collected')).toBe('completed')
  })
  test('rejected -> rejected, reserving/pending -> stuck', () => {
    expect(outcomeOf('rejected')).toBe('rejected')
    expect(outcomeOf('reserving')).toBe('stuck')
    expect(outcomeOf('pending')).toBe('stuck')
  })
})

describe('matchesHistoryFilter', () => {
  test.each([
    ['all', 'approved', true], ['all', 'rejected', true],
    ['completed', 'approved', true], ['completed', 'collected', true], ['completed', 'rejected', false],
    ['rejected', 'rejected', true], ['rejected', 'approved', false],
    ['stuck', 'reserving', true], ['stuck', 'pending', true], ['stuck', 'approved', false],
  ])('filter %s vs status %s -> %s', (filter, status, expected) => {
    expect(matchesHistoryFilter({ status }, filter)).toBe(expected)
  })
})

describe('matchesSearch', () => {
  const r = { userName: 'Somchai P.', userEmail: 'som@example.com', rewardName: 'Soft Drink' }
  test('empty term matches everything', () => { expect(matchesSearch(r, '')).toBe(true) })
  test('case-insensitive match on name, email, reward', () => {
    expect(matchesSearch(r, 'somchai')).toBe(true)
    expect(matchesSearch(r, 'SOM@')).toBe(true)
    expect(matchesSearch(r, 'drink')).toBe(true)
  })
  test('non-match returns false', () => { expect(matchesSearch(r, 'coffee')).toBe(false) })
})

describe('summarize', () => {
  test('counts all, sums pointsCost only over completed', () => {
    const list = [
      { status: 'approved', pointsCost: 30 },
      { status: 'collected', pointsCost: 20 },
      { status: 'rejected', pointsCost: 50 },
      { status: 'reserving', pointsCost: 10 },
    ]
    expect(summarize(list)).toEqual({ count: 4, pointsRedeemed: 50 })
  })
})
