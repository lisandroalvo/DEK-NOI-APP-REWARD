import { X, CheckCircle, XCircle } from 'lucide-react'

export default function BillNotificationToast({ notification, onClose }) {
  if (!notification) return null

  const isSuccess = notification.type === 'success'
  const bgColor = isSuccess ? 'bg-green-50' : 'bg-red-50'
  const borderColor = isSuccess ? 'border-green-500' : 'border-red-500'
  const textColor = isSuccess ? 'text-green-900' : 'text-red-900'
  const Icon = isSuccess ? CheckCircle : XCircle

  return (
    <div className="fixed top-4 left-4 right-4 z-[9999] animate-slide-down">
      <div className={`${bgColor} border-2 ${borderColor} rounded-2xl shadow-2xl p-4 max-w-md mx-auto`}>
        <div className="flex items-start gap-3">
          <Icon className={textColor} size={24} />
          
          <div className="flex-1">
            <h3 className={`font-black ${textColor} mb-1`}>
              {notification.title}
            </h3>
            <p className={`text-sm ${textColor} font-medium mb-2`}>
              {notification.message}
            </p>
            {notification.notes && (
              <div className={`mt-2 pt-2 border-t ${isSuccess ? 'border-green-200' : 'border-red-200'}`}>
                <p className="text-xs font-bold text-gray-700 mb-1">Admin Note:</p>
                <p className="text-sm text-gray-600 italic">"{notification.notes}"</p>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1 hover:bg-black/5 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  )
}
