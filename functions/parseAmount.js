// ABOUTME: Parses the model's text reply into a positive baht amount, or null.
// ABOUTME: Lenient on purpose — tolerates currency words/symbols, commas, and stray text.
export function parseAmount(text) {
  if (!text) return null
  const cleaned = String(text).trim().toLowerCase()
  if (!cleaned || cleaned.includes('none')) return null
  const match = cleaned.replace(/,/g, '').match(/\d+(?:\.\d+)?/)
  if (!match) return null
  const value = parseFloat(match[0])
  return value > 0 ? value : null
}
