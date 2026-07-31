// ABOUTME: Modal that reads a product barcode from the device camera, with a manual-entry fallback.
// ABOUTME: Works cross-platform (iOS Safari + Android) via @zxing/browser; calls onDetected(barcode).
import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { X, Keyboard } from 'lucide-react'

export default function BarcodeScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null)
  // Keep the latest onDetected without re-running the camera effect on every render.
  const onDetectedRef = useRef(onDetected)
  useEffect(() => {
    onDetectedRef.current = onDetected
  })

  const [manual, setManual] = useState('')
  const [cameraError, setCameraError] = useState('')
  // Guards onDetected so it fires at most once from this component, whether
  // triggered by a camera scan or the manual "Use" button. A ref (not state)
  // so the check/set is synchronous and safe to call from the camera decode
  // callback without going through a setState updater — StrictMode
  // double-invokes updaters in dev, which would otherwise double-fire it.
  const firedRef = useRef(false)
  const [submitted, setSubmitted] = useState(false)

  const fireOnce = (code) => {
    if (firedRef.current) return
    firedRef.current = true
    setSubmitted(true)
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
        if (result) {
          stopped = true
          ctrls.stop()
          fireOnce(result.getText())
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

  const submitManual = () => {
    const code = manual.trim()
    if (code) fireOnce(code)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">Scan the product barcode</h2>
          <button onClick={onCancel}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="p-4">
          {cameraError ? (
            <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3 mb-4 text-xs text-yellow-800">
              {cameraError}
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden border-2 mb-4 aspect-square bg-black" style={{ borderColor: '#CC0000' }}>
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            </div>
          )}

          <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Keyboard size={14} /> Or enter it manually
          </label>
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 8850999320005"
              className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              onFocus={e => e.target.style.borderColor = '#CC0000'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              onKeyDown={e => e.key === 'Enter' && submitManual()}
            />
            <button onClick={submitManual} disabled={submitted || !manual.trim()}
              className="px-4 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-50"
              style={{ background: '#CC0000' }}>
              Use
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
