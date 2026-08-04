// ABOUTME: Client helper to OCR a receipt's total via the recognizeReceiptTotal Cloud Function.
// ABOUTME: Returns a best-effort { amount, merchant } (never throws); merchant is an admin-advisory flag.
import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import { compressImageToBlob } from './storage'

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      // Strip the "data:image/jpeg;base64," prefix — the function wants raw base64.
      const result = String(reader.result)
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Returns { amount, merchant, ref }: amount is a positive number or null (OCR is best-effort,
// so any failure resolves to null and the customer types it in); merchant is
// 'match' | 'mismatch' | 'unclear' — an admin-advisory hint about whether the receipt/slip is
// a DEK NOI purchase; ref is the receipt's Ref2 / bill id / transaction reference (or null),
// used for duplicate detection. Never throws.
export async function recognizeReceiptTotal(file) {
  try {
    const blob = await compressImageToBlob(file)
    const imageBase64 = await blobToBase64(blob)
    const call = httpsCallable(functions, 'recognizeReceiptTotal')
    const { data } = await call({ imageBase64 })
    const amount = typeof data?.amount === 'number' && data.amount > 0 ? data.amount : null
    const merchant = ['match', 'mismatch', 'unclear'].includes(data?.merchant) ? data.merchant : 'unclear'
    const ref = typeof data?.ref === 'string' && data.ref.trim() ? data.ref.trim() : null
    return { amount, merchant, ref }
  } catch (err) {
    console.error('Receipt OCR failed:', err)
    return { amount: null, merchant: 'unclear', ref: null }
  }
}
