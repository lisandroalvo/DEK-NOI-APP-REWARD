// ABOUTME: Modal that reads a product barcode from the device camera, with a manual-entry fallback.
// ABOUTME: A scan fills the input; the customer reviews it and taps Confirm before the redemption runs.
import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { X, Keyboard, CheckCircle } from 'lucide-react'

export default function BarcodeScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null)
  // Keep the latest onDetected without re-running the camera effect on every render.
  const onDetectedRef = useRef(onDetected)
  useEffect(() => {
    onDetectedRef.current = onDetected
  })

  const [manual, setManual] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [scanned, setScanned] = useState(false)   // a camera scan filled the input
  const [submitting, setSubmitting] = useState(false)
  const capturedRef = useRef(false)               // camera fills the input at most once
  const firedRef = useRef(false)                  // onDetected fires at most once

  // Confirm the (scanned or typed) barcode. Requires an explicit tap so the customer
  // sees what will be redeemed before it goes through. Fires onDetected exactly once.
  const confirm = () => {
    const code = manual.trim()
    if (!code || firedRef.current) return
    firedRef.current = true
    setSubmitting(true)
    onDetectedRef.current(code)
  }

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let controls
    let stopped = false

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, _err, ctrls) => {
        controls = ctrls
        if (stopped) { ctrls?.stop(); return }
        if (result && !capturedRef.current) {
          // Fill the input and stop the camera — the customer confirms; no auto-redeem.
          capturedRef.current = true
          stopped = true
          ctrls.stop()
          setManual(result.getText())
          setScanned(true)
        }
      })
      .then((ctrls) => { controls = ctrls; if (stopped) ctrls.stop() })
      .catch((e) => {
        // No camera / permission denied — the manual field below still works.
        console.warn('Barcode camera unavailable:', e)
        setCameraError('Camera unavailable — type the barcode number below.')
      })

    return () => {
      stopped = true
      try { controls?.stop() } catch { /* already stopped */ }
    }
  }, [])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">Scan the product barcode</h2>
          <button onClick={onCancel}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="p-4">
          {scanned ? (
            <div className="rounded-2xl bg-green-50 border-2 border-green-200 p-4 mb-4 flex items-center gap-2 text-green-800">
              <CheckCircle size={18} className="shrink-0" />
              <span className="text-sm font-bold">Barcode captured — check it below, then confirm.</span>
            </div>
          ) : cameraError ? (
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 mb-4 text-xs text-yellow-800">
              {cameraError}
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden border-2 mb-4 aspect-square bg-black" style={{ borderColor: '#CC0000' }}>
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            </div>
          )}

          <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Keyboard size={14} /> Barcode
          </label>
          <input
            value={manual}
            onChange={(e) => { setManual(e.target.value); setScanned(false) }}
            inputMode="numeric"
            placeholder="e.g. 8850999320005"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none mb-4"
            onFocus={e => e.target.style.borderColor = '#CC0000'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            onKeyDown={e => e.key === 'Enter' && confirm()}
          />

          <div className="flex gap-2">
            <button onClick={onCancel}
              className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600">
              Cancel
            </button>
            <button onClick={confirm} disabled={submitting || !manual.trim()}
              className="flex-1 py-3 rounded-xl text-sm font-black text-white disabled:opacity-50"
              style={{ background: '#CC0000' }}>
              {submitting ? 'Redeeming…' : 'Confirm & redeem'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
