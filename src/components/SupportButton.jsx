import { MessageCircle } from 'lucide-react'

export default function SupportButton({ className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <p className="text-sm text-gray-600 font-medium">Need Help?</p>
      <a
        href="https://line.me/R/ti/p/@167fnbxs"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg hover:scale-105"
      >
        <MessageCircle size={20} />
        <span>Contact Support on LINE</span>
      </a>
    </div>
  )
}
