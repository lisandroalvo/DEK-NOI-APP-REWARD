// ABOUTME: Pure helpers for duplicate-receipt detection: image hashing and admin soft-flags.
// ABOUTME: No Firebase imports so they can be unit-tested without the emulator.

// SHA-256 of raw image bytes, returned as a lowercase hex string. Used as a stable
// fingerprint so the same image file is recognized across submissions and accounts.
export async function hashImageBytes(arrayBuffer) {
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Convenience wrapper for a File/Blob selected in the browser.
export async function hashImageFile(file) {
  return hashImageBytes(await file.arrayBuffer())
}

// Normalize a receipt reference (Ref2 / bill id / transaction ref) so trivially different
// spellings collapse to one key: trimmed, upper-cased, inner whitespace removed. Empty -> null.
export function normalizeRef(ref) {
  if (typeof ref !== 'string') return null
  const norm = ref.trim().toUpperCase().replace(/\s+/g, '')
  return norm || null
}

// SHA-256 hex of a (normalized) receipt reference — a Firestore-safe, stable lock-doc key.
export async function hashText(str) {
  return hashImageBytes(new TextEncoder().encode(str))
}

// Given one bill and the full list of bills, decide which non-blocking duplicate
// warnings apply. Never considers the bill itself. exactImage is a strong signal;
// sameAmountDay is a weak heuristic (two real same-price buys on one day trip it).
export function duplicateFlagsFor(bill, allBills) {
  const others = allBills.filter(b => b.id !== bill.id)
  const exactImage = !!bill.imageHash && others.some(b => b.imageHash === bill.imageHash)
  const sameRef = !!bill.receiptRef && others.some(b => b.receiptRef === bill.receiptRef)
  const sameAmountDay = bill.amount != null && others.some(b =>
    b.amount === bill.amount && sameCalendarDay(b.submittedAt, bill.submittedAt))
  return { exactImage, sameRef, sameAmountDay }
}

// Firestore Timestamps (anything with toDate()) → true when both fall on the same
// local calendar day. A missing/unparseable value never matches.
function sameCalendarDay(a, b) {
  const da = a?.toDate?.()
  const db = b?.toDate?.()
  if (!da || !db) return false
  return da.getFullYear() === db.getFullYear() &&
         da.getMonth() === db.getMonth() &&
         da.getDate() === db.getDate()
}
