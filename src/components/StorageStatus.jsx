import { useEffect, useState } from 'react'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '../lib/firebase'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function StorageStatus() {
  const [status, setStatus] = useState('checking') // 'checking' | 'ready' | 'error'
  const [message, setMessage] = useState('Checking Firebase Storage...')

  useEffect(() => {
    checkStorage()
  }, [])

  const checkStorage = async () => {
    try {
      // Check if storage is initialized
      if (!storage) {
        setStatus('error')
        setMessage('Firebase Storage not initialized')
        return
      }

      // Try to create a test reference
      const testRef = ref(storage, 'test/.test')
      
      // Create a tiny test file
      const testBlob = new Blob(['test'], { type: 'text/plain' })
      
      // Try to upload (this will fail if storage is not enabled, but that's ok)
      try {
        await uploadBytes(testRef, testBlob)
        await deleteObject(testRef) // Clean up
        setStatus('ready')
        setMessage('Firebase Storage is ready')
      } catch (uploadError) {
        // If we get a permission error, storage is enabled but rules are blocking
        if (uploadError.code === 'storage/unauthorized') {
          setStatus('ready')
          setMessage('Firebase Storage is enabled (upload rules configured)')
        } else if (uploadError.code === 'storage/unknown' || uploadError.message?.includes('not found')) {
          setStatus('error')
          setMessage('Firebase Storage not enabled. Enable it in Firebase Console.')
        } else {
          setStatus('error')
          setMessage(`Storage error: ${uploadError.message}`)
        }
      }
    } catch (error) {
      setStatus('error')
      setMessage(`Error: ${error.message}`)
    }
  }

  const getIcon = () => {
    switch (status) {
      case 'ready':
        return <CheckCircle size={16} className="text-green-600" />
      case 'error':
        return <XCircle size={16} className="text-red-600" />
      default:
        return <AlertCircle size={16} className="text-yellow-600 animate-pulse" />
    }
  }

  const getStyles = () => {
    switch (status) {
      case 'ready':
        return { bg: '#F0FFF4', border: '#16a34a', text: '#166534' }
      case 'error':
        return { bg: '#FFF0F0', border: '#CC0000', text: '#991B1B' }
      default:
        return { bg: '#FFF9E0', border: '#CC7700', text: '#92400E' }
    }
  }

  const styles = getStyles()

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border"
      style={{ background: styles.bg, borderColor: styles.border, color: styles.text }}
    >
      {getIcon()}
      <span>{message}</span>
      {status === 'error' && (
        <a
          href="https://console.firebase.google.com/project/dek-noi-4a39d/storage"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 underline hover:no-underline"
        >
          Enable Storage →
        </a>
      )}
    </div>
  )
}
