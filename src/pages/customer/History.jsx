// ABOUTME: Customer Activity page — a two-tab history of Receipts (bills) and Rewards (redemptions).
// ABOUTME: Holds the active-tab state and renders one tab body plus a shared LINE help card.
import { useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import ReceiptsTab from './history/ReceiptsTab'
import RewardsTab from './history/RewardsTab'
import lineChar from '../../assets/line-qr.png'
import { useT } from '../../i18n/LanguageContext'

// Opening our LINE official account: chats for existing followers, and shows
// LINE's own add-friend screen (with QR) for anyone who hasn't followed yet.
const LINE_URL = 'https://line.me/R/ti/p/@167fnbxs'

export default function History() {
  const { t } = useT()
  const TABS = [
    { key: 'receipts', label: t('history.tabReceipts') },
    { key: 'rewards',  label: t('history.tabRewards') },
  ]
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'rewards' ? 'rewards' : 'receipts'
  // Receipts is the default, so clear the param for a clean URL; keep ?tab=rewards otherwise.
  const setTab = (key) => setSearchParams(key === 'rewards' ? { tab: 'rewards' } : {}, { replace: true })

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-lg">
      <h1 className="text-2xl font-black text-gray-900 mb-4">{t('history.title')}</h1>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 bg-gray-100 rounded-xl p-1">
        {TABS.map(({ key, label }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 py-2.5 rounded-lg text-sm font-black transition-all"
              style={active ? { background: '#CC0000', color: '#fff' } : { color: '#666' }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {tab === 'receipts' ? <ReceiptsTab /> : <RewardsTab />}

      {/* LINE help */}
      <a
        href={LINE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition-all active:scale-[0.99]"
      >
        <img src={lineChar} alt="" className="w-16 h-16 object-contain rounded-xl shrink-0" />
        <div className="min-w-0">
          <p className="font-black text-gray-900 text-sm mb-0.5">{t('history.haveQuestion')}</p>
          <p className="text-xs text-gray-500 leading-relaxed">{t('history.tapChat')} <strong>LINE</strong> {t('history.forHelp')}</p>
        </div>
        <ChevronRight size={18} className="text-gray-400 shrink-0 ml-auto" />
      </a>
    </div>
  )
}
