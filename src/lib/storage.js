// ABOUTME: Image-upload helpers — validate, compress in the browser, and store in Firebase Storage.
// ABOUTME: Firestore keeps only the returned download URL, never the image bytes.
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB

// Throws on an unsupported type or oversized file. Pure — depends only on type/size.
export function validateImageFile(file) {
  if (!file || !file.type || !file.type.startsWith('image/')) {
    throw new Error('INVALID_TYPE: please choose an image file')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('FILE_TOO_LARGE: image must be under 10MB')
  }
}

// Browser-only: downscale to maxDim and re-encode as a JPEG blob via canvas.
export function compressImageToBlob(file, { maxDim = 1920, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height / width) * maxDim)
            width = maxDim
          } else {
            width = Math.round((width / height) * maxDim)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Failed to compress image'))),
          'image/jpeg',
          quality
        )
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

// Upload a blob under `prefix` and return its download URL. Testable against the emulator.
export async function uploadImageBlob(storage, blob, prefix, contentType = 'image/jpeg') {
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const objectRef = ref(storage, `${prefix}/${filename}`)
  await uploadBytes(objectRef, blob, { contentType })
  return getDownloadURL(objectRef)
}

// Browser entry point: validate, compress, upload, return the download URL.
export async function uploadImageFile(storage, file, prefix) {
  validateImageFile(file)
  const blob = await compressImageToBlob(file)
  return uploadImageBlob(storage, blob, prefix)
}
