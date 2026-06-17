// ABOUTME: Client helper to OCR a receipt's total via the recognizeReceiptTotal Cloud Function.
// ABOUTME: Compresses the image, sends base64, returns a best-effort number or null (never throws).
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

// Returns the recognized total (positive number) or null. OCR is best-effort: any
// failure resolves to null so the customer simply types the amount in.
export async function recognizeReceiptTotal(file) {
  try {
    const blob = await compressImageToBlob(file)
    const imageBase64 = await blobToBase64(blob)
    const call = httpsCallable(functions, 'recognizeReceiptTotal')
    const { data } = await call({ imageBase64 })
    const amount = data?.amount
    return typeof amount === 'number' && amount > 0 ? amount : null
  } catch (err) {
    console.error('Receipt OCR failed:', err)
    return null
  }
}
