import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { db } from '../../lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { Camera, Upload, X, CheckCircle } from 'lucide-react'

export default function ScanBill() {
  const { user, profile } = useAuth()
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Allow up to 10MB, will compress if needed
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }
      
      // Read and compress image
      const reader = new FileReader()
      reader.onloadend = () => {
        compressImage(reader.result, file.type)
      }
      reader.onerror = () => {
        setError('Failed to read file. Please try again.')
      }
      reader.readAsDataURL(file)
    }
  }

  const compressImage = (base64, fileType) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      // Calculate new dimensions (max 1920px width)
      let width = img.width
      let height = img.height
      const maxWidth = 1920
      const maxHeight = 1920
      
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
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height)
      
      // Convert to base64 with quality adjustment
      const compressedBase64 = canvas.toDataURL(fileType || 'image/jpeg', 0.8)
      
      setSelectedFile({ name: 'compressed-image.jpg', size: compressedBase64.length })
      setPreview(compressedBase64)
      setError('')
      
      console.log('Original size:', base64.length, 'Compressed size:', compressedBase64.length)
    }
    img.onerror = () => {
      setError('Failed to process image. Please try again.')
    }
    img.src = base64
  }

  const handleUpload = async () => {
    if (!selectedFile || !preview) return

    setUploading(true)
    setError('')

    try {
      console.log('Starting upload...', selectedFile.name)
      
      // IMPORTANT: Save bill submission PERMANENTLY to Firestore
      // Bills are NEVER deleted - they remain for at least 2 months
      // Users can always see their bill history even after logout
      console.log('Saving to Firestore with base64 image...')
      await addDoc(collection(db, 'billSubmissions'), {
        userId: user.uid,
        userName: profile?.name || 'Unknown',
        userEmail: profile?.email || '',
        imageData: preview, // base64 string
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        status: 'pending',
        submittedAt: serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
        pointsAwarded: 0,
        notes: ''
      })
      console.log('✅ Saved to Firestore successfully!')

      setSuccess(true)
      setSelectedFile(null)
      setPreview(null)

      // Reset success message after 3 seconds
      setTimeout(() => {
        setSuccess(false)
      }, 3000)

    } catch (err) {
      console.error('❌ Error uploading bill:', err)
      console.error('Error code:', err.code)
      console.error('Error message:', err.message)
      
      let errorMessage = 'Failed to upload bill. '
      if (err.code === 'permission-denied') {
        errorMessage += 'Permission denied. Please contact support.'
      } else if (err.message.includes('size')) {
        errorMessage += 'Image too large. Try a smaller image.'
      } else {
        errorMessage += err.message || 'Please try again.'
      }
      
      setError(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setPreview(null)
    setError('')
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl w-full mx-auto">
      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">📄 Scan Your Bill</h1>
      <p className="text-gray-600 mb-6">Upload your receipt to collect points!</p>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border-2 border-green-500 rounded-xl flex items-center gap-3">
          <CheckCircle size={24} className="text-green-600" />
          <div>
            <p className="font-bold text-green-900">Bill submitted successfully!</p>
            <p className="text-sm text-green-700">An admin will review it soon.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-500 rounded-xl">
          <p className="font-bold text-red-900">{error}</p>
        </div>
      )}

      {!preview ? (
        <div className="space-y-4">
          {/* Camera/Upload Button */}
          <label className="block">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="border-4 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-red-500 hover:bg-red-50 transition-all">
              <Camera size={64} className="mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-bold text-gray-700 mb-2">Take a Photo</p>
              <p className="text-sm text-gray-500">Tap to use camera</p>
            </div>
          </label>

          <div className="text-center text-gray-500 font-bold">OR</div>

          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="border-4 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-red-500 hover:bg-red-50 transition-all">
              <Upload size={64} className="mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-bold text-gray-700 mb-2">Upload from Gallery</p>
              <p className="text-sm text-gray-500">Tap to browse files</p>
            </div>
          </label>

          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 mt-6">
            <p className="font-bold text-yellow-900 mb-2">📌 Tips for best results:</p>
            <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
              <li>Make sure the bill is clearly visible</li>
              <li>Include the total amount and date</li>
              <li>Avoid blurry or dark photos</li>
              <li>Photos up to 10MB accepted (auto-compressed)</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative rounded-2xl overflow-hidden border-4 border-red-600">
            <img src={preview} alt="Bill preview" className="w-full h-auto" />
            <button
              onClick={handleCancel}
              className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700"
            >
              <X size={20} />
            </button>
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-4 rounded-xl font-black text-lg shadow-lg transition-all disabled:opacity-50"
            style={{
              background: uploading ? '#999' : 'linear-gradient(135deg, #CC0000 0%, #FF3333 100%)',
              color: '#fff'
            }}
          >
            {uploading ? 'Uploading...' : '✅ Submit Bill'}
          </button>

          <button
            onClick={handleCancel}
            className="w-full py-3 rounded-xl font-bold text-gray-700 border-2 border-gray-300 hover:bg-gray-100"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
