import { useState, useRef, useEffect } from 'react'
import { X, Image as ImageIcon, Upload } from 'lucide-react'

// Simple image upload using base64 - NO external service needed!
export default function ImageUploadSimple({ value, onChange, label = 'Upload Image' }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(value || null)
  const fileInputRef = useRef(null)

  // Update preview when value prop changes (for editing existing items)
  useEffect(() => {
    setPreview(value || null)
  }, [value])

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target.result
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          
          // Resize if too large
          const maxWidth = 1200
          const maxHeight = 1200
          
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = (height / width) * maxWidth
              width = maxWidth
            } else {
              width = (width / height) * maxHeight
              height = maxHeight
            }
          }
          
          canvas.width = width
          canvas.height = height
          
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          
          // Convert to base64 with compression
          // Start with quality 0.7, will reduce if needed
          let quality = 0.7
          let base64String = canvas.toDataURL('image/jpeg', quality)
          
          // If still too large, reduce quality
          while (base64String.length > 800000 && quality > 0.1) {
            quality -= 0.1
            base64String = canvas.toDataURL('image/jpeg', quality)
            console.log(`Compressing... quality: ${quality.toFixed(1)}, size: ${Math.round(base64String.length / 1024)} KB`)
          }
          
          resolve(base64String)
        }
        img.onerror = reject
      }
      reader.onerror = reject
    })
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    console.log('File selected:', file)
    
    if (!file) {
      console.log('No file selected')
      return
    }

    console.log('File details:', {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeKB: Math.round(file.size / 1024)
    })

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('Invalid file type:', file.type)
      alert('Please select an image file (PNG, JPG, GIF, WebP)')
      return
    }

    console.log('Starting upload and compression...')
    setUploading(true)
    
    try {
      // Compress image
      const base64String = await compressImage(file)
      
      console.log('✅ Image compressed and converted to base64')
      console.log('Final base64 size:', Math.round(base64String.length / 1024), 'KB')
      
      // Check if still too large for Firestore (max ~1MB)
      if (base64String.length > 1000000) {
        console.error('❌ Image still too large after compression:', base64String.length)
        alert('Image is too large even after compression. Please use a smaller image or compress it at https://tinypng.com first.')
        setUploading(false)
        return
      }
      
      setPreview(base64String)
      console.log('✅ Preview set')
      
      onChange(base64String)
      console.log('✅ onChange called with base64 string')
      
      setUploading(false)
      console.log('✅ Upload complete!')
      
    } catch (error) {
      console.error('❌ Upload error:', error)
      alert('Failed to process image. Please try again.')
      setUploading(false)
    }
  }

  const handleRemove = () => {
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
            className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
          >
            <X size={16} />
          </button>
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            ✓ Image loaded
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-48 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all"
          style={{ background: '#f9fafb' }}
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mb-2" style={{ borderColor: '#CC0000' }} />
              <p className="text-sm text-gray-500">Processing image...</p>
            </>
          ) : (
            <>
              <Upload size={32} className="text-gray-400 mb-2" />
              <p className="text-sm font-semibold text-gray-600">Click to upload image</p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, WebP (max 2MB)</p>
            </>
          )}
        </div>
      )}
      
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
