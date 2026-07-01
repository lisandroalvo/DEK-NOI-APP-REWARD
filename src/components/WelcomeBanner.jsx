// ABOUTME: Static branded welcome banner for the customer dashboard.
// ABOUTME: Stands in for the promos carousel while promos are out of MVP scope.
import charSnacks from '../assets/char-snacks.png'

export default function WelcomeBanner() {
  return (
    <div
      className="relative overflow-hidden rounded-3xl mb-6 p-5 sm:p-6 border-2"
      style={{ background: 'linear-gradient(135deg, #FFF9E0 0%, #FFF0F0 100%)', borderColor: '#FFE600' }}
    >
      <div className="relative z-10 max-w-[72%]">
        <span
          className="inline-block text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-full mb-2"
          style={{ background: '#CC0000', color: '#FFE600' }}
        >
          🎉 Rewards Club
        </span>
        <h2 className="text-lg sm:text-xl font-black text-gray-900 leading-snug">Welcome to DEK NOI</h2>
        <p className="text-sm text-gray-600 mt-1">Spend in-store, collect points, and redeem them for treats!</p>
      </div>
      <img
        src={charSnacks}
        alt=""
        className="absolute -bottom-1 right-1 h-24 sm:h-28 w-auto object-contain pointer-events-none drop-shadow"
      />
    </div>
  )
}
