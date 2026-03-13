import React, { useEffect, useState, useMemo } from 'react'
import { Icon } from '@iconify/react'
import { useWallet } from '@txnlab/use-wallet'
import { Tabs, Spin, Input, Select } from 'antd'
import MarketCard from './MarketCard'
import PositionCard from './PositionCard'
import DepositModal from './DepositModal'
import WithdrawModal from './WithdrawModal'
import { getMarkets, getPositionsByWallet, getPools } from '../../../services/alphaArcadeApi'
import type { AlphaArcadeMarket, AlphaArcadePosition, AlphaArcadePool } from '../../../types/alphaArcade'

const AlphaArcadePage: React.FC = () => {
  const { activeAddress } = useWallet()

  const [markets, setMarkets] = useState<AlphaArcadeMarket[]>([])
  const [positions, setPositions] = useState<AlphaArcadePosition[]>([])
  const [pools, setPools] = useState<AlphaArcadePool[]>([])
  const [loading, setLoading] = useState(true)
  const [positionsLoading, setPositionsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const [depositModal, setDepositModal] = useState<{ visible: boolean; market: AlphaArcadeMarket | null }>({
    visible: false,
    market: null,
  })
  const [withdrawModal, setWithdrawModal] = useState<{ visible: boolean; position: AlphaArcadePosition | null }>({
    visible: false,
    position: null,
  })

  // Fetch markets and pools on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [marketsData, poolsData] = await Promise.all([
          getMarkets().catch(() => []),
          getPools().catch(() => []),
        ])
        setMarkets(marketsData || [])
        setPools(poolsData || [])
      } catch (e) {
        console.error('Failed to fetch market data:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Fetch positions when wallet changes
  useEffect(() => {
    if (!activeAddress) {
      setPositions([])
      return
    }
    const fetchPositions = async () => {
      setPositionsLoading(true)
      try {
        const data = await getPositionsByWallet(activeAddress)
        setPositions(data || [])
      } catch (e) {
        console.error('Failed to fetch positions:', e)
      } finally {
        setPositionsLoading(false)
      }
    }
    fetchPositions()
  }, [activeAddress])

  // Build pool lookup map
  const poolMap = useMemo(() => {
    const map = new Map<number, AlphaArcadePool>()
    for (const p of pools) {
      map.set(p.marketAppId, p)
    }
    return map
  }, [pools])

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const m of markets) {
      if (m.category) cats.add(m.category)
    }
    return ['all', ...Array.from(cats).sort()]
  }, [markets])

  // Filter markets
  const filteredMarkets = useMemo(() => {
    return markets.filter((m) => {
      const matchesSearch = !searchQuery ||
        (m.question || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [markets, searchQuery, categoryFilter])

  // Stats
  const totalTvl = useMemo(() => {
    return pools.reduce((sum, p) => sum + (p.totalUsdcDeposited || 0), 0) / 1_000_000
  }, [pools])

  const activePositionsCount = useMemo(() => {
    return positions.filter((p) => p.status === 'active').length
  }, [positions])

  const refreshAll = async () => {
    try {
      const [marketsData, poolsData] = await Promise.all([
        getMarkets().catch(() => []),
        getPools().catch(() => []),
      ])
      setMarkets(marketsData || [])
      setPools(poolsData || [])
      if (activeAddress) {
        const posData = await getPositionsByWallet(activeAddress).catch(() => [])
        setPositions(posData || [])
      }
    } catch (e) {
      console.error('Refresh failed:', e)
    }
  }

  const getMarketQuestion = (position: AlphaArcadePosition): string => {
    const pool = poolMap.get(position.marketAppId)
    if (pool?.marketQuestion) return pool.marketQuestion
    const market = markets.find((m) => m.app_id === position.marketAppId)
    return market?.question || ''
  }

  const fmtUsd = (v: number) =>
    `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="max-xxxl:w-[95%] w-[80%] m-auto pt-[30px] pb-[60px] flex-1 relative z-[2]">
      {/* Stats banner */}
      <div className="w-full mb-[30px]">
        <div className="flex sm-s:flex-col justify-between gap-[10px] sm-s:gap-[20px] bg-[var(--bg-card)] rounded-[18px] py-[32px] px-[60px] max-sm:!px-[30px] shadow-[0px_4px_24.2px_0px_var(--shadow-color)]">
          <div className="flex flex-col items-center gap-[6px]">
            <p className="text-text_clr tracking-[0.54px] large">Markets</p>
            <h3 className="small text-[var(--text-heading)] font-medium tracking-[1.08px]">
              {loading ? '...' : markets.length}
            </h3>
          </div>
          <div className="flex flex-col items-center gap-[6px]">
            <p className="text-text_clr tracking-[0.54px] large">Total TVL</p>
            <h3 className="small text-[var(--text-heading)] font-medium tracking-[1.08px]">
              {loading ? '...' : fmtUsd(totalTvl)}
            </h3>
          </div>
          <div className="flex flex-col items-center gap-[6px]">
            <p className="text-text_clr tracking-[0.54px] large">My Positions</p>
            <h3 className="small text-[var(--text-heading)] font-medium tracking-[1.08px]">
              {!activeAddress ? '—' : positionsLoading ? '...' : activePositionsCount}
            </h3>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        defaultActiveKey="markets"
        items={[
          {
            key: 'markets',
            label: 'Markets',
            children: (
              <div>
                {/* Search & filter */}
                <div className="flex flex-wrap gap-3 mb-5">
                  <Input
                    placeholder="Search markets..."
                    prefix={<Icon icon="mdi:magnify" width={18} className="text-[var(--text-secondary)]" />}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-[300px]"
                    allowClear
                  />
                  {categories.length > 2 && (
                    <Select
                      value={categoryFilter}
                      onChange={setCategoryFilter}
                      options={categories.map((c) => ({
                        value: c,
                        label: c === 'all' ? 'All Categories' : c,
                      }))}
                      className="min-w-[160px]"
                    />
                  )}
                </div>

                {loading ? (
                  <div className="flex justify-center py-20">
                    <Spin size="large" />
                  </div>
                ) : filteredMarkets.length === 0 ? (
                  <div className="text-center py-20">
                    <Icon icon="mdi:chart-timeline-variant" width={48} className="text-[var(--text-secondary)] opacity-30 mx-auto mb-3" />
                    <p className="text-[var(--text-secondary)]">
                      {searchQuery || categoryFilter !== 'all'
                        ? 'No markets match your filters'
                        : 'No markets available'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredMarkets.map((market) => (
                      <MarketCard
                        key={market.app_id}
                        market={market}
                        onDeposit={(m) => setDepositModal({ visible: true, market: m })}
                      />
                    ))}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'positions',
            label: `My Positions${activePositionsCount > 0 ? ` (${activePositionsCount})` : ''}`,
            children: (
              <div>
                {!activeAddress ? (
                  <div className="text-center py-20">
                    <Icon icon="mdi:wallet" width={48} className="text-[var(--text-secondary)] opacity-30 mx-auto mb-3" />
                    <p className="text-[var(--text-secondary)]">Connect your wallet to view positions</p>
                  </div>
                ) : positionsLoading ? (
                  <div className="flex justify-center py-20">
                    <Spin size="large" />
                  </div>
                ) : positions.length === 0 ? (
                  <div className="text-center py-20">
                    <Icon icon="mdi:inbox" width={48} className="text-[var(--text-secondary)] opacity-30 mx-auto mb-3" />
                    <p className="text-[var(--text-secondary)]">No positions yet</p>
                    <p className="text-[var(--text-secondary)] text-sm mt-1">Provide liquidity to a market to get started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {positions.map((pos) => (
                      <PositionCard
                        key={pos._id}
                        position={pos}
                        marketQuestion={getMarketQuestion(pos)}
                        onWithdraw={(p) => setWithdrawModal({ visible: true, position: p })}
                      />
                    ))}
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Modals */}
      <DepositModal
        visible={depositModal.visible}
        market={depositModal.market}
        onClose={() => setDepositModal({ visible: false, market: null })}
        onSuccess={() => {
          setDepositModal({ visible: false, market: null })
          refreshAll()
        }}
      />
      <WithdrawModal
        visible={withdrawModal.visible}
        position={withdrawModal.position}
        marketQuestion={withdrawModal.position ? getMarketQuestion(withdrawModal.position) : undefined}
        onClose={() => setWithdrawModal({ visible: false, position: null })}
        onSuccess={() => {
          setWithdrawModal({ visible: false, position: null })
          refreshAll()
        }}
      />
    </div>
  )
}

export default AlphaArcadePage
