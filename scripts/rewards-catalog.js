// ABOUTME: Starter rewards catalog (Tiers 1-3) priced at ~2 points per baht of shelf value, with baht ceiling.
// ABOUTME: Pure data + a validator; consumed by seed-rewards.js and its test.

// Each item mirrors the reward doc shape written by the admin UI: the "up to ฿X"
// ceiling lives in the description so staff know exactly which SKUs qualify.
// Costs are set against the ฿25-per-point earning rate (see BAHT_PER_POINT); the
// spend required for each reward — and thus the % return — matches the old ฿50 rate.
export const REWARDS_CATALOG = [
  // Tier 1 — Quick Wins (the hook: cheap first redemptions)
  { name: 'Free bottled water', description: 'One free bottle of water (up to ฿10).', pointsCost: 20, maxValue: 10, emoji: '💧' },
  { name: 'Free candy or small treat', description: 'One free candy or small treat (up to ฿12).', pointsCost: 30, maxValue: 12, emoji: '🍬' },
  { name: 'Free bag of chips', description: 'One free bag of chips or a snack (up to ฿20).', pointsCost: 50, maxValue: 20, emoji: '🍟' },

  // Tier 2 — Everyday Favorites (the core of the program)
  { name: 'Free cup noodles', description: 'One free cup of instant noodles (up to ฿15).', pointsCost: 60, maxValue: 15, emoji: '🍜' },
  { name: 'Free soft drink', description: 'One free soft drink or soda (up to ฿20).', pointsCost: 70, maxValue: 20, emoji: '🥤' },
  { name: 'Free ice cream', description: 'One free ice cream (up to ฿30).', pointsCost: 80, maxValue: 30, emoji: '🍦' },

  // Tier 3 — Treat Bundles (bigger "spend my stash" moments)
  { name: 'Pick any 3 snacks', description: 'Choose any 3 snacks, total up to ฿55.', pointsCost: 200, maxValue: 55, emoji: '🎉' },
  { name: 'Snack + drink combo box', description: 'A snack and drink combo box (up to ฿75).', pointsCost: 260, maxValue: 75, emoji: '📦' },
]

// Fields the admin UI defaults; applied to every seeded reward so the docs are
// indistinguishable from ones created by hand in the dashboard.
export const REWARD_DEFAULTS = { available: true, imageUrl: null }

// Throws if any catalog entry is malformed. Kept next to the data so the seed
// script and the test enforce the exact same contract.
export function validateCatalog(catalog = REWARDS_CATALOG) {
  const names = new Set()
  for (const r of catalog) {
    if (!r.name || typeof r.name !== 'string') throw new Error(`Reward missing name: ${JSON.stringify(r)}`)
    if (names.has(r.name)) throw new Error(`Duplicate reward name: ${r.name}`)
    names.add(r.name)
    if (!r.description || typeof r.description !== 'string') throw new Error(`Reward missing description: ${r.name}`)
    if (!Number.isInteger(r.pointsCost) || r.pointsCost <= 0) throw new Error(`Reward pointsCost must be a positive integer: ${r.name}`)
    if (!Number.isInteger(r.maxValue) || r.maxValue <= 0) throw new Error(`Reward maxValue must be a positive integer: ${r.name}`)
    if (!r.emoji || typeof r.emoji !== 'string') throw new Error(`Reward missing emoji: ${r.name}`)
  }
  return true
}
