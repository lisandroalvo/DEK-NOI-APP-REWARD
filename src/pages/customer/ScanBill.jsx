import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { db, storage } from '../../lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
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
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('File size must be less than 5MB')
        return
      }
      setSelectedFile(file)
      setPreview(URL.createObjectURL(file))
      setError('')
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setError('')

    try {
      // Upload image to Firebase Storage
      const timestamp = Date.now()
      const storageRef = ref(storage, `bills/${user.uid}/${timestamp}_${selectedFile.name}`)
      await uploadBytes(storageRef, selectedFile)
      const imageUrl = await getDownloadURL(storageRef)

      // Save bill submission to Firestore
      await addDoc(collection(db, 'billSubmissions'), {
        userId: user.uid,
        userName: profile?.name || 'Unknown',
        userEmail: profile?.email || '',
        imageUrl,
        status: 'pending', // pending, approved, rejected
        submittedAt: serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
        pointsAwarded: 0,
        notes: ''
      })

      setSuccess(true)
      setSelectedFile(null)
      setPreview(null)

      // Reset success message after 3 seconds
      setTimeout(() => {
        setSuccess(false)
      }, 3000)

    } catch (err) {
      console.error('Error uploading bill:', err)
      setError('Failed to upload bill. Please try again.')
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
              <li>File size must be under 5MB</li>
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
