import { MessageCircle } from 'lucide-react'

export default function SupportButton() {
  return (
    <div className="fixed bottom-24 right-4 z-40 md:bottom-6">
      <a
        href="https://line.me/R/ti/p/@167fnbxs"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-full font-bold hover:bg-green-700 transition-all shadow-2xl hover:scale-105"
      >
        <MessageCircle size={20} />
        <span className="text-sm">Support</span>
      </a>
    </div>
  )
}
