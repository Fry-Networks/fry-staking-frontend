import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, Spin } from 'antd'
import { Icon } from '@iconify/react'
import { toast } from 'react-toastify'
import { useChain } from '../../../context/ChainContext'
import { useMultiChainWallet } from '../../../hooks/useMultiChainWallet'
import { useAuth } from '../../../hooks/useAuth'
import { P2P_MARKETS } from '../../../config/p2pSwapConfig'
import { ChainId } from '../../../config/chains/types'
import {
  getP2POffers, getMyP2POffers, getP2PHistory,
} from '../../../services/p2pSwapApi'
import { recordP2PCancel } from '../../../services/p2pSwapApi'
import { cancelP2POffer } from '../../../p2p_swap_func'
import type { P2POffer, P2PTrade, P2POfferPagination } from '../../../types/p2pSwap'
import P2PExperimentalBanner from './P2PExperimentalBanner'
import P2PMarketCard from './P2PMarketCard'
import OfferTable from './OfferTable'
import OfferDetail from './OfferDetail'
import MyOffersTable from './MyOffersTable'
import HistoryTable from './HistoryTable'
import CreateP2POfferWizard from '../../../Modals/website/CreateP2POfferWizard'
import AcceptP2POfferModal from '../../../Modals/website/AcceptP2POfferModal'

const P2PSwapPage: React.FC = () => {
  const { chainId, activeChain } = useChain()
  const { activeAddress, signer } = useMultiChainWallet()
  const { ensureAuth } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const market = P2P_MARKETS[chainId as ChainId]

  // Data state
  const [offers, setOffers] = useState<P2POffer[]>([])
  const [offerPagination, setOfferPagination] = useState<P2POfferPagination | undefined>()
  const [myOffers, setMyOffers] = useState<P2POffer[]>([])
  const [trades, setTrades] = useState<P2PTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('offers')

  // Modal state
  const [createWizardOpen, setCreateWizardOpen] = useState(false)
  const [acceptOffer, setAcceptOffer] = useState<P2POffer | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)

  // Share link: ?offer=chainId/appId/offerId
  const offerParam = searchParams.get('offer')
  const shareLink = offerParam ? offerParam.split('/') : null
  const showDetail = shareLink && shareLink.length === 3

  // Fetch data
  const fetchOffers = useCallback(async (page = 1) => {
    try {
      const result = await getP2POffers({ marketAppId: market.appId, status: 'open', page, limit: 20 })
      setOffers(result.data)
      setOfferPagination(result.pagination)
    } catch (err) {
      console.error('Failed to fetch offers:', err)
    }
  }, [market.appId])

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
    await Promise.all([fetchOffers(), fetchMyOffers(), fetchHistory()])
    setLoading(false)
  }, [fetchOffers, fetchMyOffers, fetchHistory])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Handle cancel
  const handleCancel = async (offer: P2POffer) => {
    if (!signer || !activeAddress) return
    setCancelling(offer._id)
    try {
      await ensureAuth()

      const algodConfig = {
        server: (activeChain.connection as any).algodServer,
        port: String((activeChain.connection as any).algodPort),
        token: (activeChain.connection as any).algodToken,
      }

      const { txId } = await cancelP2POffer(
        market.appId, offer.offerId, activeAddress, signer, algodConfig
      )

      await recordP2PCancel(offer.offerId, {
        marketAppId: market.appId,
        cancelTxId: txId,
      })

      toast.success('Offer cancelled successfully')
      fetchAll()
    } catch (err: any) {
      console.error('Cancel failed:', err)
      toast.error(err?.message || 'Failed to cancel offer')
    } finally {
      setCancelling(null)
    }
  }

  // Handle accept
  const handleAcceptClick = (offer: P2POffer) => {
    setAcceptOffer(offer)
  }

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
            market={market}
            onAccept={handleAcceptClick}
            onBack={() => setSearchParams({})}
          />
        </div>
        {acceptOffer && (
          <AcceptP2POfferModal
            isOpen={!!acceptOffer}
            setIsOpen={(open) => { if (!open) setAcceptOffer(null) }}
            offer={acceptOffer}
            market={market}
            onSuccess={() => { setAcceptOffer(null); fetchAll() }}
          />
        )}
      </div>
    )
  }

  const openOfferCount = offers.length

  const tabItems = [
    {
      key: 'offers',
      label: `Open Offers${offerPagination ? ` (${offerPagination.total})` : ''}`,
      children: (
        <OfferTable
          offers={offers}
          loading={loading}
          market={market}
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
        <MyOffersTable
          offers={myOffers}
          loading={loading}
          market={market}
          onCancel={handleCancel}
        />
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
        <HistoryTable trades={trades} loading={loading} market={market} />
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
              Trade {market.offerAssetSymbol}/{market.requestAssetSymbol} directly with other users
            </p>
          </div>
          <button
            onClick={() => setCreateWizardOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-lg bg-[#DE0308] text-white font-bold hover:opacity-90 transition-opacity"
          >
            <Icon icon="mdi:plus" width={20} />
            Create Offer
          </button>
        </div>

        {/* Market info */}
        <div className="mb-6">
          <P2PMarketCard
            market={market}
            openOfferCount={offerPagination?.total || 0}
            onClick={() => setActiveTab('offers')}
            isSelected={true}
          />
        </div>

        {/* Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="p2p-tabs"
        />
      </div>

      {/* Modals */}
      <CreateP2POfferWizard
        isOpen={createWizardOpen}
        setIsOpen={setCreateWizardOpen}
        market={market}
        onSuccess={() => { setCreateWizardOpen(false); fetchAll() }}
      />

      {acceptOffer && (
        <AcceptP2POfferModal
          isOpen={!!acceptOffer}
          setIsOpen={(open) => { if (!open) setAcceptOffer(null) }}
          offer={acceptOffer}
          market={market}
          onSuccess={() => { setAcceptOffer(null); fetchAll() }}
        />
      )}
    </div>
  )
}

export default P2PSwapPage
