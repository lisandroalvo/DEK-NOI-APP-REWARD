// ABOUTME: Parses the receipt-scan model's reply into { amount, merchant }.
// ABOUTME: Pure + best-effort — a malformed reply falls back to a raw amount and 'unclear' merchant.
import { parseAmount } from './parseAmount.js'

const MERCHANT_VALUES = ['match', 'mismatch', 'unclear']

// The model is asked for {"total": number|null, "merchant": "match"|"mismatch"|"unclear"}.
// We tolerate stray prose or code fences around the JSON; any parse problem falls back to
// reading the whole reply as an amount with an unknown merchant, so a hiccup never blocks the
// upload (the amount is a pre-fill hint and the merchant is an admin-advisory flag).
export function parseReceiptReply(text) {
  const raw = String(text ?? '')
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  let obj = null
  if (jsonMatch) {
    try { obj = JSON.parse(jsonMatch[0]) } catch { obj = null }
  }
  // If the JSON parsed, honor its total (including an explicit null); only fall back to
  // scanning the raw reply for a number when JSON parsing failed entirely.
  const amount = obj
    ? (obj.total != null ? parseAmount(String(obj.total)) : null)
    : parseAmount(raw)
  const merchant = MERCHANT_VALUES.includes(obj?.merchant) ? obj.merchant : 'unclear'
  return { amount, merchant }
}
