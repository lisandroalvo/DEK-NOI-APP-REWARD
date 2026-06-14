// ABOUTME: Reusable image picker that uploads to Firebase Storage and reports back the download URL.
// ABOUTME: Used by admin Rewards/Promos and the customer Profile photo; stores URLs, never base64.
import { useState, useRef } from 'react'
import { X, Upload } from 'lucide-react'
import { storage } from '../lib/firebase'
import { uploadImageFile } from '../lib/storage'

export default function ImageUpload({ value, onChange, label = 'Upload Image', folder = 'images' }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  // The component is controlled: `value` (the saved URL) is the source of truth.
  const preview = value || null

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')
    try {
      const url = await uploadImageFile(storage, file, folder)
      onChange(url)
    } catch (err) {
      console.error('Image upload failed:', err)
      if (err.message?.startsWith('INVALID_TYPE')) {
        setError('Please choose an image file (PNG, JPG, GIF, WebP).')
      } else if (err.message?.startsWith('FILE_TOO_LARGE')) {
        setError('Image must be under 10MB.')
      } else {
        setError('Failed to upload image. Please try again.')
      }
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    onChange(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>

      {preview ? (
        <div className="relative group">
          <img src={preview} alt="Preview" className="w-full h-48 object-cover rounded-xl border-2 border-gray-200" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          className="w-full h-48 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all"
          style={{ background: '#f9fafb' }}
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mb-2" style={{ borderColor: '#CC0000' }} />
              <p className="text-sm text-gray-500">Uploading image…</p>
            </>
          ) : (
            <>
              <Upload size={32} className="text-gray-400 mb-2" />
              <p className="text-sm font-semibold text-gray-600">Click to upload image</p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, WebP (max 10MB)</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />
    </div>
  )
}
