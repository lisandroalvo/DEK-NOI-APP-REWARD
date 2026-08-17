import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { db, storage } from '../../lib/firebase'
import { uploadImageFile, validateImageFile } from '../../lib/storage'
import { recognizeReceiptTotal } from '../../lib/ocr'
import { hashImageFile, normalizeRef, hashText } from '../../lib/billDedup'
import { BAHT_PER_POINT } from '../../lib/points'
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore'
import { Camera, Upload, X, CheckCircle } from 'lucide-react'
import { useT } from '../../i18n/LanguageContext'

export default function ScanBill() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { t } = useT()
  const [selectedFile, setSelectedFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [amount, setAmount] = useState('')
  const [ocrAmount, setOcrAmount] = useState(null)
  const [ocrMerchant, setOcrMerchant] = useState('unclear')
  const [ocrRef, setOcrRef] = useState(null)
  const [recognizing, setRecognizing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      validateImageFile(file)
    } catch (err) {
      setError(err.message.startsWith('FILE_TOO_LARGE')
        ? t('scanBill.errTooLarge')
        : t('scanBill.errChooseImage'))
      return
    }

    if (preview) URL.revokeObjectURL(preview)
    setSelectedFile(file)
    setPreview(URL.createObjectURL(file))
    setAmount('')
    setOcrAmount(null)
    setError('')

    // Best-effort: auto-recognize the total to pre-fill the amount field.
    setRecognizing(true)
    const { amount: recognized, merchant, ref } = await recognizeReceiptTotal(file)
    setOcrMerchant(merchant)
    setOcrRef(ref)
    if (recognized != null) {
      setOcrAmount(recognized)
      setAmount(String(recognized))
    }
    setRecognizing(false)
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    const amountNum = Math.round(parseFloat(amount) * 100) / 100
    if (!(amountNum > 0)) {
      setError(t('scanBill.errEnterAmount'))
      return
    }

    setUploading(true)
    setError('')

    try {
      // Fingerprint the image so the same receipt can't be turned into points twice.
      const imageHash = await hashImageFile(selectedFile)

      // The receipt reference (Ref2 / bill id / transaction ref) is the strongest duplicate
      // key — it catches the same receipt even when re-photographed or submitted from another
      // account. Hash the normalized ref for a Firestore-safe lock-doc id. A missing/unreadable
      // ref just means dedup falls back to the image hash for this submission.
      const receiptRef = normalizeRef(ocrRef)
      const receiptRefHash = receiptRef ? await hashText(receiptRef) : null

      // Block re-submitting a receipt the customer already has pending or approved.
      // A previously rejected one is allowed through so a mistaken rejection can be fixed.
      const dupSnap = await getDocs(query(
        collection(db, 'billSubmissions'),
        where('userId', '==', user.uid),
        where('imageHash', '==', imageHash),
      ))
      const alreadyActive = dupSnap.docs.some(d => ['pending', 'approved'].includes(d.data().status))
      if (alreadyActive) {
        setError(t('scanBill.errAlreadySubmitted'))
        setUploading(false)
        return
      }

      // Upload the receipt to Storage; Firestore keeps only the download URL.
      // Bills are kept permanently so customers always see their history.
      const imageUrl = await uploadImageFile(storage, selectedFile, `bills/${user.uid}`)

      await addDoc(collection(db, 'billSubmissions'), {
        userId: user.uid,
        userName: profile?.name || 'Unknown',
        userEmail: profile?.email || '',
        imageUrl,
        imageHash,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        amount: amountNum,
        ocrAmount,
        merchantFlag: ocrMerchant,
        receiptRef,
        receiptRefHash,
        status: 'pending',
        submittedAt: serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
        pointsAwarded: 0,
        notes: ''
      })

      if (preview) URL.revokeObjectURL(preview)
      setSuccess(true)
      setSelectedFile(null)
      setPreview(null)
      setAmount('')
      setOcrAmount(null)

      // Briefly show the success banner, then take the customer to their bill
      // history — the new submission appears at the top of the Receipts tab.
      setTimeout(() => {
        navigate('/activity')
      }, 1200)

    } catch (err) {
      console.error('Error uploading bill:', err)

      let errorMessage = t('scanBill.errUpload')
      if (err.code === 'permission-denied') {
        errorMessage += t('scanBill.errPermission')
      } else if (err.message?.startsWith('FILE_TOO_LARGE')) {
        errorMessage += t('scanBill.errImageTooLarge')
      } else {
        errorMessage += t('scanBill.errTryAgain')
      }

      setError(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    if (preview) URL.revokeObjectURL(preview)
    setSelectedFile(null)
    setPreview(null)
    setAmount('')
    setOcrAmount(null)
    setError('')
  }

  // Live points estimate for the entered amount, accounting for the customer's
  // current carried baht (spendCarry). Shown only once an amount is entered.
  const amountNum = parseFloat(amount) || 0
  const carry = profile?.spendCarry || 0
  const pool = carry + amountNum
  const estEarned = Math.floor(pool / BAHT_PER_POINT)
  const estToNext = BAHT_PER_POINT - (pool % BAHT_PER_POINT)

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-2xl w-full mx-auto">
      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">{t('scanBill.title')}</h1>
      <p className="text-gray-600 mb-6">{t('scanBill.subtitle')}</p>

      {success && (
        <div className="mb-6 p-4 bg-green-50 border-2 border-green-500 rounded-xl flex items-center gap-3">
          <CheckCircle size={24} className="text-green-600" />
          <div>
            <p className="font-bold text-green-900">{t('scanBill.submittedTitle')}</p>
            <p className="text-sm text-green-700">{t('scanBill.submittedBody')}</p>
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
              <p className="text-lg font-bold text-gray-700 mb-2">{t('scanBill.takePhoto')}</p>
              <p className="text-sm text-gray-500">{t('scanBill.tapCamera')}</p>
            </div>
          </label>

          <div className="text-center text-gray-500 font-bold">{t('scanBill.or')}</div>

          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="border-4 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-red-500 hover:bg-red-50 transition-all">
              <Upload size={64} className="mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-bold text-gray-700 mb-2">{t('scanBill.uploadGallery')}</p>
              <p className="text-sm text-gray-500">{t('scanBill.tapBrowse')}</p>
            </div>
          </label>

          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 mt-6">
            <p className="font-bold text-yellow-900 mb-2">{t('scanBill.tipsTitle')}</p>
            <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
              <li>{t('scanBill.tipVisible')}</li>
              <li>{t('scanBill.tipTotal')}</li>
              <li>{t('scanBill.tipBlur')}</li>
              <li>{t('scanBill.sizeHint')}</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative rounded-2xl overflow-hidden border-4 border-red-600">
            <img src={preview} alt={t('scanBill.previewAlt')} className="w-full h-auto" />
            <button
              onClick={handleCancel}
              className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700"
            >
              <X size={20} />
            </button>
          </div>

          {/* Bill amount (auto-recognized, editable) */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {t('scanBill.amountLabel')}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={recognizing ? t('scanBill.readingShort') : t('scanBill.enterTotal')}
              disabled={recognizing}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-red-500 focus:outline-none text-lg font-bold disabled:bg-gray-100"
            />
            {recognizing && (
              <p className="text-sm text-gray-500 mt-1">{t('scanBill.reading')}</p>
            )}
            {!recognizing && ocrAmount != null && (
              <p className="text-xs text-gray-400 mt-1">{t('scanBill.autoRead', { amount: ocrAmount })}</p>
            )}
            {amountNum > 0 && (
              <div className="mt-2 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-xl">
                <p className="text-sm font-bold text-yellow-900">
                  {t('scanBill.earns', { n: estEarned, s: estEarned === 1 ? '' : 's' })}
                  {estToNext < BAHT_PER_POINT && t('scanBill.toNextPoint', { n: estToNext })}
                </p>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={uploading || recognizing || !(amountNum > 0)}
            className="w-full py-4 rounded-xl font-black text-lg shadow-lg transition-all disabled:opacity-50"
            style={{
              background: uploading ? '#999' : 'linear-gradient(135deg, #CC0000 0%, #FF3333 100%)',
              color: '#fff'
            }}
          >
            {uploading ? t('scanBill.uploading') : t('scanBill.submit')}
          </button>

          <button
            onClick={handleCancel}
            className="w-full py-3 rounded-xl font-bold text-gray-700 border-2 border-gray-300 hover:bg-gray-100"
          >
            {t('common.cancel')}
          </button>
        </div>
      )}
    </div>
  )
}
