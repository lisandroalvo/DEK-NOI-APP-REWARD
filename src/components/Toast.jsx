import { useEffect } from 'react'
import { X, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

const TOAST_STYLES = {
  success: {
    bg: '#F0FFF4',
    border: '#16a34a',
    icon: CheckCircle,
    iconColor: '#16a34a',
  },
  error: {
    bg: '#FFF0F0',
    border: '#CC0000',
    icon: XCircle,
    iconColor: '#CC0000',
  },
  info: {
    bg: '#FFF9E0',
    border: '#CC7700',
    icon: AlertCircle,
    iconColor: '#CC7700',
  },
}

export default function Toast({ message, type = 'info', onClose, duration = 5000 }) {
  const style = TOAST_STYLES[type] || TOAST_STYLES.info
  const Icon = style.icon

  useEffect(() => {
    if (duration && onClose) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  return (
    <div
      className="fixed top-4 right-4 z-50 max-w-sm w-full animate-slide-in-right shadow-2xl rounded-2xl border-2 p-4 flex items-start gap-3"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <Icon size={20} style={{ color: style.iconColor }} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 leading-snug">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={18} />
        </button>
      )}
    </div>
  )
}
