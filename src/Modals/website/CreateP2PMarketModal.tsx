import { useState } from 'react'
import { Modal, Steps, InputNumber, Input } from 'antd'
import { Icon } from '@iconify/react'
import { toast } from 'react-toastify'
import { useMultiChainWallet } from '../../hooks/useMultiChainWallet'
import { useChain } from '../../context/ChainContext'
import { useAuth } from '../../hooks/useAuth'
import { deployP2PMarket } from '../../p2p_swap_func'
import { registerP2PMarket } from '../../services/p2pSwapApi'
import { P2P_DEFAULT_FEE_BPS } from '../../config/p2pSwapConfig'

interface CreateP2PMarketModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSuccess: () => void;
}

const CreateP2PMarketModal: React.FC<CreateP2PMarketModalProps> = ({
  isOpen, setIsOpen, onSuccess,
}) => {
  const { activeAddress, signer } = useMultiChainWallet()
  const { chainId, activeChain } = useChain()
  const { ensureAuth } = useAuth()

  const [step, setStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [offerAssetId, setOfferAssetId] = useState<number | null>(null)
  const [offerAssetName, setOfferAssetName] = useState('')
  const [offerAssetSymbol, setOfferAssetSymbol] = useState('')
  const [requestAssetId, setRequestAssetId] = useState<number | null>(null)
  const [requestAssetName, setRequestAssetName] = useState('')
  const [requestAssetSymbol, setRequestAssetSymbol] = useState('')

  const nativeSymbol = activeChain.nativeAsset.symbol

  const reset = () => {
    setStep(0)
    setOfferAssetId(null)
    setOfferAssetName('')
    setOfferAssetSymbol('')
    setRequestAssetId(null)
    setRequestAssetName('')
    setRequestAssetSymbol('')
    setIsSubmitting(false)
  }

  const handleClose = () => {
    reset()
    setIsOpen(false)
  }

  const canProceedStep0 = offerAssetId !== null && offerAssetSymbol.length > 0
  const canProceedStep1 = requestAssetId !== null && requestAssetSymbol.length > 0 && requestAssetId !== offerAssetId
  const canSubmit = canProceedStep0 && canProceedStep1 && activeAddress && signer

  const pairName = offerAssetSymbol && requestAssetSymbol
    ? `${offerAssetSymbol}/${requestAssetSymbol}`
    : '—'

  const handleSubmit = async () => {
    if (!canSubmit || !signer || !activeAddress || offerAssetId === null || requestAssetId === null) return
    setIsSubmitting(true)

    try {
      await ensureAuth()

      const algodConfig = {
        server: (activeChain.connection as any).algodServer,
        port: String((activeChain.connection as any).algodPort),
        token: (activeChain.connection as any).algodToken,
      }

      const { appId, appAddress, txId } = await deployP2PMarket(
        offerAssetId, requestAssetId, P2P_DEFAULT_FEE_BPS,
        activeAddress, signer, chainId, algodConfig,
      )

      // Register with backend
      await registerP2PMarket({
        appId,
        deployTxId: txId,
        offerAssetId,
        requestAssetId,
        feeBps: P2P_DEFAULT_FEE_BPS,
        offerAssetName,
        offerAssetSymbol,
        requestAssetName: requestAssetName || (requestAssetId === 0 ? nativeSymbol : ''),
        requestAssetSymbol: requestAssetSymbol || (requestAssetId === 0 ? nativeSymbol : ''),
      })

      toast.success(`Market ${pairName} deployed! App ID: ${appId}`)
      handleClose()
      onSuccess()
    } catch (err: any) {
      console.error('Deploy market failed:', err)
      toast.error(err?.message || 'Failed to deploy market')
    } finally {
      setIsSubmitting(false)
    }
  }

  const steps = [
    {
      title: 'Offer Asset',
      content: (
        <div className="space-y-4">
          <div className="text-center text-[var(--text-secondary)] mb-2">
            Which asset will makers sell in this market?
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">ASA ID (0 for {nativeSymbol})</label>
            <InputNumber
              className="w-full"
              size="large"
              placeholder="ASA ID"
              value={offerAssetId}
              onChange={(v) => setOfferAssetId(v)}
              min={0}
              controls={false}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Name</label>
              <Input
                placeholder="e.g. Fry"
                value={offerAssetName}
                onChange={(e) => setOfferAssetName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Symbol</label>
              <Input
                placeholder="e.g. FRY"
                value={offerAssetSymbol}
                onChange={(e) => setOfferAssetSymbol(e.target.value)}
              />
            </div>
          </div>
          {offerAssetId === 0 && (
            <div className="text-xs text-[var(--text-secondary)] text-center">
              Using native {nativeSymbol} as the offer asset
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Request Asset',
      content: (
        <div className="space-y-4">
          <div className="text-center text-[var(--text-secondary)] mb-2">
            Which asset will makers receive in return?
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">ASA ID (0 for {nativeSymbol})</label>
            <InputNumber
              className="w-full"
              size="large"
              placeholder="ASA ID"
              value={requestAssetId}
              onChange={(v) => setRequestAssetId(v)}
              min={0}
              controls={false}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Name</label>
              <Input
                placeholder={`e.g. ${nativeSymbol}`}
                value={requestAssetName}
                onChange={(e) => setRequestAssetName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">Symbol</label>
              <Input
                placeholder={`e.g. ${nativeSymbol}`}
                value={requestAssetSymbol}
                onChange={(e) => setRequestAssetSymbol(e.target.value)}
              />
            </div>
          </div>
          {requestAssetId === offerAssetId && requestAssetId !== null && (
            <div className="text-xs text-[#DE0308] text-center">
              Request asset must differ from offer asset
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Deploy',
      content: (
        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-[var(--bg-secondary)] space-y-2">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Market pair</span>
              <span className="font-bold text-[var(--text-primary)]">{pairName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Offer asset ID</span>
              <span className="text-[var(--text-primary)]">{offerAssetId === 0 ? `${nativeSymbol} (native)` : offerAssetId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Request asset ID</span>
              <span className="text-[var(--text-primary)]">{requestAssetId === 0 ? `${nativeSymbol} (native)` : requestAssetId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Taker fee</span>
              <span className="text-[var(--text-primary)]">{P2P_DEFAULT_FEE_BPS / 100}% (you collect all fees)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Deploy cost</span>
              <span className="text-[var(--text-primary)]">~0.5 {nativeSymbol}</span>
            </div>
          </div>
          <div className="p-3 rounded border border-[#d4a017] bg-[#d4a01715] text-sm text-[var(--text-primary)]">
            <Icon icon="mdi:alert" className="inline mr-1 text-[#d4a017]" width={16} />
            The contract is immutable — the asset pair and fee cannot be changed after deployment.
            You will be the admin and fee recipient of this market.
          </div>
        </div>
      ),
    },
  ]

  const isLastStep = step === steps.length - 1
  const canNext = step === 0 ? canProceedStep0 : step === 1 ? canProceedStep1 : false

  return (
    <Modal
      open={isOpen}
      onCancel={handleClose}
      title={<span className="font-apex text-lg">Create P2P Market</span>}
      footer={null}
      width={500}
      destroyOnClose
    >
      <Steps current={step} size="small" className="mb-6"
        items={steps.map(s => ({ title: s.title }))}
      />

      <div className="min-h-[200px]">
        {steps[step].content}
      </div>

      <div className="flex justify-between mt-6">
        <button
          onClick={() => step > 0 ? setStep(step - 1) : handleClose()}
          className="px-4 py-2 rounded border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </button>

        {isLastStep ? (
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#DE0308] text-white font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {isSubmitting ? (
              <>
                <Icon icon="mdi:loading" className="animate-spin" width={18} />
                Deploying...
              </>
            ) : (
              'Deploy Market'
            )}
          </button>
        ) : (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canNext}
            className="px-5 py-2 rounded-lg bg-[#DE0308] text-white font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            Next
          </button>
        )}
      </div>
    </Modal>
  )
}

export default CreateP2PMarketModal
