// ABOUTME: Guards the starter rewards catalog data (Tiers 1-3) before it is seeded.
// ABOUTME: Checks required fields, positive-integer costs, unique names, and the expected lineup.
import { describe, test, expect } from 'vitest'
import { REWARDS_CATALOG, REWARD_DEFAULTS, validateCatalog } from '../scripts/rewards-catalog.js'

describe('rewards catalog', () => {
  test('every entry is well-formed', () => {
    expect(() => validateCatalog()).not.toThrow()
  })

  test('has all 8 seeded rewards with the agreed point costs', () => {
    const costs = Object.fromEntries(REWARDS_CATALOG.map(r => [r.name, r.pointsCost]))
    expect(REWARDS_CATALOG).toHaveLength(8)
    expect(costs).toEqual({
      'Free bottled water': 10,
      'Free candy or small treat': 15,
      'Free bag of chips': 25,
      'Free cup noodles': 30,
      'Free soft drink': 35,
      'Free ice cream': 40,
      'Pick any 3 snacks': 100,
      'Snack + drink combo box': 130,
    })
  })

  test('reward names are unique', () => {
    const names = REWARDS_CATALOG.map(r => r.name)
    expect(new Set(names).size).toBe(names.length)
  })

  test('defaults make rewards visible with no image', () => {
    expect(REWARD_DEFAULTS).toEqual({ available: true, imageUrl: null })
  })

  test('validator rejects a non-integer point cost', () => {
    expect(() => validateCatalog([{ name: 'x', description: 'y', pointsCost: 1.5, emoji: '💧' }])).toThrow()
  })

  test('validator rejects a duplicate name', () => {
    const dup = [
      { name: 'x', description: 'y', pointsCost: 10, emoji: '💧' },
      { name: 'x', description: 'z', pointsCost: 20, emoji: '🍬' },
    ]
    expect(() => validateCatalog(dup)).toThrow(/Duplicate/)
  })
})
