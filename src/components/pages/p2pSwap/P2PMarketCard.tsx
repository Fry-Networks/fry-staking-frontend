import type { P2PMarketConfig } from '../../../config/p2pSwapConfig'

interface P2PMarketCardProps {
  market: P2PMarketConfig;
  openOfferCount: number;
  onClick: () => void;
  isSelected: boolean;
}

const P2PMarketCard: React.FC<P2PMarketCardProps> = ({ market, openOfferCount, onClick, isSelected }) => {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer p-4 rounded-lg border transition-all ${
        isSelected
          ? 'border-[#DE0308] bg-[#DE030810]'
          : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--text-secondary)]'
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center">
          <span className="font-bold text-lg text-[var(--text-primary)] font-apex">
            {market.offerAssetSymbol}/{market.requestAssetSymbol}
          </span>
        </div>
      </div>
      <div className="flex justify-between text-sm text-[var(--text-secondary)]">
        <span>{openOfferCount} open offer{openOfferCount !== 1 ? 's' : ''}</span>
        <span>Fee: {market.feeBps / 100}%</span>
      </div>
    </div>
  )
}

export default P2PMarketCard
