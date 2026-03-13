import React from 'react'
import { Icon } from '@iconify/react'
import type { AlphaArcadeMarket } from '../../../types/alphaArcade'

interface MarketCardProps {
  market: AlphaArcadeMarket
  onDeposit: (market: AlphaArcadeMarket) => void
}

const MarketCard: React.FC<MarketCardProps> = ({ market, onDeposit }) => {
  const yesPercent = Math.round((market.yes_price ?? 0.5) * 100)
  const noPercent = 100 - yesPercent
  const isResolved = market.status === 'resolved'

  const resolutionDate = market.resolution_time
    ? new Date(market.resolution_time * 1000)
    : null
  const now = Date.now()
  const resolvingSoon = resolutionDate
    ? resolutionDate.getTime() - now < 24 * 60 * 60 * 1000 && resolutionDate.getTime() > now
    : false

  const formatVolume = (v: number) => {
    if (!v) return '$0'
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`
    return `$${v.toFixed(0)}`
  }

  return (
    <div className="bg-[var(--bg-card)] rounded-[16px] overflow-hidden shadow-[0px_4px_24.2px_0px_var(--shadow-color)] flex flex-col">
      {/* Image */}
      <div className="relative h-[140px] bg-[var(--bg-secondary)] overflow-hidden">
        {market.image_url ? (
          <img
            src={market.image_url}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon icon="mdi:chart-timeline-variant" width={48} className="text-[var(--text-secondary)] opacity-30" />
          </div>
        )}
        {/* Category badge */}
        {market.category && (
          <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
            {market.category}
          </span>
        )}
        {/* Resolution warning */}
        {resolvingSoon && !isResolved && (
          <span className="absolute top-2 right-2 bg-yellow-500/90 text-black text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
            <Icon icon="mdi:clock-alert" width={12} />
            Resolving soon
          </span>
        )}
        {isResolved && (
          <span className="absolute top-2 right-2 bg-blue-500/90 text-white text-xs px-2 py-0.5 rounded-full">
            Resolved
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Question */}
        <p className="text-[var(--text-primary)] font-bold text-sm leading-tight line-clamp-2 min-h-[40px]">
          {market.question || `Market #${market.app_id}`}
        </p>

        {/* Probability bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-green-500 font-medium">Yes {yesPercent}%</span>
            <span className="text-red-500 font-medium">No {noPercent}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden flex bg-[var(--bg-secondary)]">
            <div
              className="bg-green-500 transition-all duration-300"
              style={{ width: `${yesPercent}%` }}
            />
            <div
              className="bg-red-500 transition-all duration-300"
              style={{ width: `${noPercent}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex justify-between text-xs text-[var(--text-secondary)]">
          <span>24h: {formatVolume(market.volume_24h)}</span>
          <span>Vol: {formatVolume(market.total_volume)}</span>
        </div>

        {/* Resolution date */}
        {resolutionDate && (
          <p className="text-xs text-[var(--text-secondary)]">
            Resolves: {resolutionDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}

        {/* Deposit button */}
        <button
          onClick={() => onDeposit(market)}
          disabled={isResolved || !market.yes_token_id}
          className="mt-auto w-full py-2.5 rounded-lg font-bold text-sm text-white transition-colors linearGradient disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isResolved ? 'Market Resolved' : 'Provide Liquidity'}
        </button>
      </div>
    </div>
  )
}

export default MarketCard
