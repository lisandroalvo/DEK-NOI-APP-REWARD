import { useState, useRef } from 'react'
import { X, Image as ImageIcon } from 'lucide-react'

// Cloudinary upload widget - NO BACKEND NEEDED
export default function ImageUploadCloudinary({ value, onChange, folder = 'images', label = 'Upload Image' }) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState(value || null)

  const handleUpload = () => {
    setUploading(true)
    
    // Create Cloudinary upload widget
    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: 'demo', // Use 'demo' for testing, replace with your own later
        uploadPreset: 'ml_default', // Use 'ml_default' for demo
        folder: folder,
        sources: ['local', 'camera'],
        multiple: false,
        maxFileSize: 5000000, // 5MB
        clientAllowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
        maxImageWidth: 2000,
        maxImageHeight: 2000,
        cropping: false,
        showSkipCropButton: true,
        styles: {
          palette: {
            window: '#FFFFFF',
            windowBorder: '#CC0000',
            tabIcon: '#CC0000',
            menuIcons: '#CC0000',
            textDark: '#000000',
            textLight: '#FFFFFF',
            link: '#CC0000',
            action: '#CC0000',
            inactiveTabIcon: '#999999',
            error: '#F44235',
            inProgress: '#CC0000',
            complete: '#16a34a',
            sourceBg: '#F4F4F5'
          }
        }
      },
      (error, result) => {
        setUploading(false)
        
        if (error) {
          console.error('Upload error:', error)
          alert('Failed to upload image. Please try again.')
          return
        }
        
        if (result.event === 'success') {
          const url = result.info.secure_url
          console.log('Upload successful:', url)
          setPreview(url)
          onChange(url)
          widget.close()
        }
      }
    )
    
    widget.open()
  }

  const handleRemove = () => {
    setPreview(null)
    onChange(null)
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
          onClick={handleUpload}
          className="w-full h-48 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
          style={{ background: '#f9fafb' }}
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 mb-2" style={{ borderColor: '#CC0000' }} />
              <p className="text-sm text-gray-500">Opening uploader...</p>
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
    </div>
  )
}
