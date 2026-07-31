// ABOUTME: Pure result classifier + thin HTTP client for the POS reward-redemptions API.
// ABOUTME: classifyRedemptionResult maps an HTTP status+body to an action; it has no side effects.

// Only these codes are safe to retry with the same idempotency key (see docs/api/reward-redemptions.md).
const RETRYABLE_CODES = new Set(['IN_PROGRESS', 'UPSTREAM_ERROR', 'INTERNAL_ERROR'])

// Map the API's HTTP status + parsed JSON body to exactly one action:
//   { action: 'complete', product, replayed }         — item redeemed; deduct points
//   { action: 'reject',   code, message, product }     — business rejection; no points
//   { action: 'retry',    code, message }              — transient; retry with the same key
// A missing/unknown code is treated as 'reject' so a malformed response can never loop forever.
export function classifyRedemptionResult(status, body) {
  if (status === 200 && body && body.ok === true) {
    return { action: 'complete', product: body.product ?? null, replayed: body.replayed === true }
  }
  const code = (body && body.code) || null
  if (code && RETRYABLE_CODES.has(code)) {
    return { action: 'retry', code, message: (body && body.message) ?? null }
  }
  return { action: 'reject', code: code || 'UNKNOWN', message: (body && body.message) ?? null, product: (body && body.product) ?? null }
}

// POST one redemption to the API. Returns { status, body }. A network/fetch failure is
// surfaced as a synthetic INTERNAL_ERROR (status 0) so the caller's retry logic — which
// keys off the classified action — handles it uniformly with the same idempotency key.
export async function postRewardRedemption(url, apiKey, payload) {
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    return { status: 0, body: { ok: false, code: 'INTERNAL_ERROR', message: String(err?.message || err) } }
  }
  let body = null
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body }
}
