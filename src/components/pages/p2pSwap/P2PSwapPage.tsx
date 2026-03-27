import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs } from 'antd'
import { Icon } from '@iconify/react'
import { toast } from 'react-toastify'
import { useChain } from '../../../context/ChainContext'
import { useMultiChainWallet } from '../../../hooks/useMultiChainWallet'
import { useAuth } from '../../../hooks/useAuth'
import { P2P_MARKETS, type P2PMarketConfig } from '../../../config/p2pSwapConfig'
import { ChainId } from '../../../config/chains/types'
import {
  getP2PMarkets, getP2POffers, getMyP2POffers, getP2PHistory, recordP2PCancel,
} from '../../../services/p2pSwapApi'
import { cancelP2POffer } from '../../../p2p_swap_func'
import type { P2PMarket, P2POffer, P2PTrade, P2POfferPagination } from '../../../types/p2pSwap'
import P2PExperimentalBanner from './P2PExperimentalBanner'
import P2PMarketCard from './P2PMarketCard'
import OfferTable from './OfferTable'
import OfferDetail from './OfferDetail'
import MyOffersTable from './MyOffersTable'
import HistoryTable from './HistoryTable'
import CreateP2POfferWizard from '../../../Modals/website/CreateP2POfferWizard'
import AcceptP2POfferModal from '../../../Modals/website/AcceptP2POfferModal'
import CreateP2PMarketModal from '../../../Modals/website/CreateP2PMarketModal'

/** Convert a backend P2PMarket to the P2PMarketConfig shape the components expect */
function marketToConfig(m: P2PMarket): P2PMarketConfig {
  return {
    appId: m.appId,
    appAddress: m.appAddress,
    offerAssetId: m.offerAssetId,
    offerAssetName: m.offerAssetName,
    offerAssetSymbol: m.offerAssetSymbol,
    offerAssetDecimals: m.offerAssetDecimals,
    requestAssetId: m.requestAssetId,
    requestAssetName: m.requestAssetName,
    requestAssetSymbol: m.requestAssetSymbol,
    requestAssetDecimals: m.requestAssetDecimals,
    feeBps: m.feeBps,
    feeRecipient: m.feeRecipient,
  }
}

const P2PSwapPage: React.FC = () => {
  const { chainId, activeChain } = useChain()
  const { activeAddress, signer } = useMultiChainWallet()
  const { ensureAuth } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const fallbackMarket = P2P_MARKETS[chainId as ChainId]

  // Market state
  const [markets, setMarkets] = useState<P2PMarket[]>([])
  const [selectedMarketAppId, setSelectedMarketAppId] = useState<number>(fallbackMarket.appId)

  // Derive the active market config
  const selectedApiMarket = markets.find(m => m.appId === selectedMarketAppId)
  const activeMarketConfig: P2PMarketConfig = selectedApiMarket
    ? marketToConfig(selectedApiMarket)
    : fallbackMarket

  // Data state
  const [offers, setOffers] = useState<P2POffer[]>([])
  const [offerPagination, setOfferPagination] = useState<P2POfferPagination | undefined>()
  const [myOffers, setMyOffers] = useState<P2POffer[]>([])
  const [trades, setTrades] = useState<P2PTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('offers')

  // Modal state
  const [createWizardOpen, setCreateWizardOpen] = useState(false)
  const [createMarketOpen, setCreateMarketOpen] = useState(false)
  const [acceptOffer, setAcceptOffer] = useState<P2POffer | null>(null)

  // Share link: ?offer=chainId/appId/offerId
  const offerParam = searchParams.get('offer')
  const shareLink = offerParam ? offerParam.split('/') : null
  const showDetail = shareLink && shareLink.length === 3

  // Fetch markets from backend
  const fetchMarkets = useCallback(async () => {
    try {
      const apiMarkets = await getP2PMarkets()
      setMarkets(apiMarkets)
      // If selected market not in list, keep fallback
      if (apiMarkets.length > 0 && !apiMarkets.find(m => m.appId === selectedMarketAppId)) {
        setSelectedMarketAppId(apiMarkets[0].appId)
      }
    } catch (err) {
      console.error('Failed to fetch markets:', err)
    }
  }, [selectedMarketAppId])

  // Fetch offers for selected market
  const fetchOffers = useCallback(async (page = 1) => {
    try {
      const result = await getP2POffers({ marketAppId: selectedMarketAppId, status: 'open', page, limit: 20 })
      setOffers(result.data)
      setOfferPagination(result.pagination)
    } catch (err) {
      console.error('Failed to fetch offers:', err)
    }
  }, [selectedMarketAppId])

  const fetchMyOffers = useCallback(async () => {
    if (!activeAddress) return
    try {
      const result = await getMyP2POffers()
      setMyOffers(result.data)
    } catch (err) {
      console.error('Failed to fetch my offers:', err)
    }
  }, [activeAddress])

  const fetchHistory = useCallback(async () => {
    if (!activeAddress) return
    try {
      const result = await getP2PHistory()
      setTrades(result.data)
    } catch (err) {
      console.error('Failed to fetch history:', err)
    }
  }, [activeAddress])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchMarkets(), fetchOffers(), fetchMyOffers(), fetchHistory()])
    setLoading(false)
  }, [fetchMarkets, fetchOffers, fetchMyOffers, fetchHistory])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Re-fetch offers when selected market changes
  useEffect(() => {
    fetchOffers()
  }, [selectedMarketAppId, fetchOffers])

  // Handle cancel
  const handleCancel = async (offer: P2POffer) => {
    if (!signer || !activeAddress) return
    try {
      await ensureAuth()
      const algodConfig = {
        server: (activeChain.connection as any).algodServer,
        port: String((activeChain.connection as any).algodPort),
        token: (activeChain.connection as any).algodToken,
      }
      const { txId } = await cancelP2POffer(
        activeMarketConfig.appId, offer.offerId, activeAddress, signer, algodConfig
      )
      await recordP2PCancel(offer.offerId, { marketAppId: activeMarketConfig.appId, cancelTxId: txId })
      toast.success('Offer cancelled successfully')
      fetchAll()
    } catch (err: any) {
      console.error('Cancel failed:', err)
      toast.error(err?.message || 'Failed to cancel offer')
    }
  }

  const handleAcceptClick = (offer: P2POffer) => setAcceptOffer(offer)

  // Share link detail view
  if (showDetail) {
    return (
      <div className="relative z-[1] flex-1 py-[30px] px-[5%]">
        <div className="max-w-[1400px] m-auto">
          <P2PExperimentalBanner />
          <OfferDetail
            chainId={shareLink[0]}
            marketAppId={Number(shareLink[1])}
            offerId={Number(shareLink[2])}
            market={activeMarketConfig}
            onAccept={handleAcceptClick}
            onBack={() => setSearchParams({})}
          />
        </div>
        {acceptOffer && (
          <AcceptP2POfferModal
            isOpen={!!acceptOffer}
            setIsOpen={(open) => { if (!open) setAcceptOffer(null) }}
            offer={acceptOffer}
            market={activeMarketConfig}
            onSuccess={() => { setAcceptOffer(null); fetchAll() }}
          />
        )}
      </div>
    )
  }

  const tabItems = [
    {
      key: 'offers',
      label: `Open Offers${offerPagination ? ` (${offerPagination.total})` : ''}`,
      children: (
        <OfferTable
          offers={offers}
          loading={loading}
          market={activeMarketConfig}
          onAccept={handleAcceptClick}
          onCancel={handleCancel}
          pagination={offerPagination}
          onPageChange={(page) => fetchOffers(page)}
        />
      ),
    },
    {
      key: 'my-offers',
      label: `My Offers${myOffers.length > 0 ? ` (${myOffers.length})` : ''}`,
      children: activeAddress ? (
        <MyOffersTable offers={myOffers} loading={loading} market={activeMarketConfig} onCancel={handleCancel} />
      ) : (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          Connect your wallet to see your offers.
        </div>
      ),
    },
    {
      key: 'history',
      label: 'History',
      children: activeAddress ? (
        <HistoryTable trades={trades} loading={loading} market={activeMarketConfig} />
      ) : (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          Connect your wallet to see your trade history.
        </div>
      ),
    },
  ]

  return (
    <div className="relative z-[1] flex-1 py-[30px] px-[5%]">
      <div className="max-w-[1400px] m-auto">
        <P2PExperimentalBanner />

        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold font-apex text-[var(--text-primary)]">
              P2P Trading
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              Trade directly with other users — permissionless, on-chain settlement
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreateMarketOpen(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-[var(--border-color)] text-[var(--text-primary)] font-bold hover:bg-[var(--bg-secondary)] transition-colors"
            >
              <Icon icon="mdi:store-plus" width={20} />
              Create Market
            </button>
            <button
              onClick={() => setCreateWizardOpen(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-lg bg-[#DE0308] text-white font-bold hover:opacity-90 transition-opacity"
            >
              <Icon icon="mdi:plus" width={20} />
              Create Offer
            </button>
          </div>
        </div>

        {/* Market selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {markets.length > 0 ? (
            markets.map((m) => (
              <P2PMarketCard
                key={m._id}
                market={m}
                openOfferCount={m.appId === selectedMarketAppId ? (offerPagination?.total || 0) : 0}
                onClick={() => setSelectedMarketAppId(m.appId)}
                isSelected={m.appId === selectedMarketAppId}
              />
            ))
          ) : (
            <P2PMarketCard
              market={fallbackMarket}
              openOfferCount={offerPagination?.total || 0}
              onClick={() => {}}
              isSelected={true}
            />
          )}
        </div>

        {/* Tabs */}
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} className="p2p-tabs" />
      </div>

      {/* Modals */}
      <CreateP2POfferWizard
        isOpen={createWizardOpen}
        setIsOpen={setCreateWizardOpen}
        market={activeMarketConfig}
        onSuccess={() => { setCreateWizardOpen(false); fetchAll() }}
      />

      <CreateP2PMarketModal
        isOpen={createMarketOpen}
        setIsOpen={setCreateMarketOpen}
        onSuccess={() => { setCreateMarketOpen(false); fetchAll() }}
      />

      {acceptOffer && (
        <AcceptP2POfferModal
          isOpen={!!acceptOffer}
          setIsOpen={(open) => { if (!open) setAcceptOffer(null) }}
          offer={acceptOffer}
          market={activeMarketConfig}
          onSuccess={() => { setAcceptOffer(null); fetchAll() }}
        />
      )}
    </div>
  )
}

export default P2PSwapPage
