import { useState, useRef } from 'react'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '../lib/firebase'
import { Upload, X, Image as ImageIcon } from 'lucide-react'

export default function ImageUpload({ value, onChange, folder = 'images', label = 'Upload Image' }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(value || null)
  const fileInputRef = useRef(null)

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    setUploading(true)
    try {
      console.log('Starting upload...', { file: file.name, size: file.size, type: file.type })
      
      // Check if storage is initialized
      if (!storage) {
        throw new Error('Firebase Storage is not initialized')
      }

      // Create unique filename
      const timestamp = Date.now()
      const filename = `${folder}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
      console.log('Upload path:', filename)
      
      const storageRef = ref(storage, filename)

      // Upload file with metadata
      console.log('Uploading to Firebase Storage...')
      const metadata = {
        contentType: file.type,
        customMetadata: {
          uploadedBy: 'admin',
          uploadedAt: new Date().toISOString()
        }
      }
      const uploadResult = await uploadBytes(storageRef, file, metadata)
      console.log('Upload complete:', uploadResult)
      
      // Get download URL
      console.log('Getting download URL...')
      const url = await getDownloadURL(storageRef)
      console.log('Download URL:', url)
      
      setPreview(url)
      onChange(url)
      
      alert('Image uploaded successfully!')
    } catch (error) {
      console.error('Upload error details:', error)
      console.error('Error code:', error.code)
      console.error('Error message:', error.message)
      
      let errorMessage = 'Failed to upload image. '
      
      if (error.code === 'storage/unauthorized') {
        errorMessage += 'Permission denied. Please check Firebase Storage rules.'
      } else if (error.code === 'storage/canceled') {
        errorMessage += 'Upload was canceled.'
      } else if (error.code === 'storage/unknown') {
        errorMessage += 'Unknown error. Check Firebase Storage configuration.'
      } else if (error.message?.includes('not initialized')) {
        errorMessage += 'Firebase Storage is not configured. Please enable it in Firebase Console.'
      } else {
        errorMessage += error.message || 'Please try again.'
      }
      
      alert(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = async () => {
    if (!preview) return
    
    try {
      // Try to delete from storage (if it's a Firebase Storage URL)
      if (preview.includes('firebasestorage.googleapis.com')) {
        const storageRef = ref(storage, preview)
        await deleteObject(storageRef).catch(() => {
          // Ignore errors if file doesn't exist
        })
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
    
    setPreview(null)
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      
      {preview ? (
        <div className="relative group">
          <img 
            src={preview} 
            alt="Preview" 
            className="w-full h-48 object-cover rounded-xl border-2 border-gray-200"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-48 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
          style={{ background: '#f9fafb' }}
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mb-2" style={{ borderColor: '#CC0000' }} />
              <p className="text-sm text-gray-500">Uploading...</p>
            </>
          ) : (
            <>
              <ImageIcon size={32} className="text-gray-400 mb-2" />
              <p className="text-sm font-semibold text-gray-600">Click to upload</p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
            </>
          )}
        </div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />
    </div>
  )
}
