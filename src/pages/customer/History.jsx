// ABOUTME: Customer Activity page — a two-tab history of Receipts (bills) and Rewards (redemptions).
// ABOUTME: Holds the active-tab state and renders one tab body plus a shared LINE help card.
import { useSearchParams } from 'react-router-dom'
import ReceiptsTab from './history/ReceiptsTab'
import RewardsTab from './history/RewardsTab'
import lineQr from '../../assets/line-qr.png'

const TABS = [
  { key: 'receipts', label: 'Receipts' },
  { key: 'rewards',  label: 'Rewards' },
]

export default function History() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'rewards' ? 'rewards' : 'receipts'
  // Receipts is the default, so clear the param for a clean URL; keep ?tab=rewards otherwise.
  const setTab = (key) => setSearchParams(key === 'rewards' ? { tab: 'rewards' } : {}, { replace: true })

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-lg">
      <h1 className="text-2xl font-black text-gray-900 mb-4">Activity</h1>

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
      <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
        <img src={lineQr} alt="LINE QR" className="w-16 h-16 object-contain rounded-xl shrink-0" />
        <div>
          <p className="font-black text-gray-900 text-sm mb-0.5">Have a question?</p>
          <p className="text-xs text-gray-500 leading-relaxed">Scan to contact us on <strong>LINE</strong> for help with your rewards.</p>
        </div>
      </div>
    </div>
  )
}
