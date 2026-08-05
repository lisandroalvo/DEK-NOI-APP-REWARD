// ABOUTME: Pure view helpers for the admin Redemptions page — filter, search, summarize.
// ABOUTME: No Firestore/React deps so the page's list logic is unit-tested in isolation.

export const NEEDS_ATTENTION_STATUSES = ['reserving', 'pending']

export function isNeedsAttention(status) {
  return NEEDS_ATTENTION_STATUSES.includes(status)
}

// Map a stored status to the customer-facing outcome the History tab groups by.
// approved and legacy 'collected' are both "completed"; the live limbo states are "stuck".
export function outcomeOf(status) {
  if (status === 'approved' || status === 'collected') return 'completed'
  if (status === 'rejected') return 'rejected'
  if (status === 'reserving' || status === 'pending') return 'stuck'
  return 'other'
}

export function matchesHistoryFilter(r, filter) {
  if (filter === 'all') return true
  return outcomeOf(r.status) === filter
}

export function matchesSearch(r, term) {
  const t = term.trim().toLowerCase()
  if (!t) return true
  return [r.userName, r.userEmail, r.rewardName]
    .some((f) => String(f ?? '').toLowerCase().includes(t))
}

export function summarize(list) {
  let pointsRedeemed = 0
  for (const r of list) {
    if (outcomeOf(r.status) === 'completed') pointsRedeemed += r.pointsCost ?? 0
  }
  return { count: list.length, pointsRedeemed }
}
