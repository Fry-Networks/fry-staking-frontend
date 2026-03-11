import React, { useState, useMemo, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { Modal, Steps, DatePicker, Radio } from 'antd'
import { toast } from 'react-toastify'
import dayjs from 'dayjs'
import { useWallet } from '@txnlab/use-wallet'
import { useAuth } from '../../hooks/useAuth'
import { createNftPool, depositRewards, depositRewardsAlgo, optInContractToNft } from '../../nft_staking_func'
import { addNftPool } from '../../services/nftStakingApi'
import { fetchFeeConfig, calculateFeeSimple, FEE_RECIPIENT } from '../../services/FeeService'
import { authFetch } from '../../services/apiClient'
import * as algokit from '@algorandfoundation/algokit-utils'
import { getAlgodConfigFromViteEnvironment } from '../../utils/network/getAlgoClientConfigs'
import TokenSelector from '../../components/shared/TokenSelector'
import TokenImage from '../../components/shared/TokenImage'
import type { DiscoveredToken } from '../../services/TokenDiscoveryService'
import Input from '../../components/shared/input'
import Button from '../../components/shared/button'

interface CreateNftPoolWizardProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  fetchData: () => void
}

const LOCK_OPTIONS = [
  { label: 'None', value: 0 },
  { label: '7 Days', value: 7 },
  { label: '14 Days', value: 14 },
  { label: '30 Days', value: 30 },
  { label: 'Custom', value: -1 },
]

const REWARD_MODEL_OPTIONS = [
  { label: 'Fixed Rate', value: 0, desc: 'Fixed amount of tokens per NFT per day' },
  { label: 'Proportional', value: 1, desc: 'Total reward pool divided among stakers over time' },
  { label: 'APR', value: 2, desc: 'Annual percentage rate based on NFT value' },
]

const CreateNftPoolWizard: React.FC<CreateNftPoolWizardProps> = ({
  isOpen,
  setIsOpen,
  fetchData,
}) => {
  const { signer, activeAddress } = useWallet()
  const { ensureAuth } = useAuth()
  const isWalletConnected = !!activeAddress && !!signer

  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deployStatus, setDeployStatus] = useState('')

  // Step 0: Collection Setup
  const [poolName, setPoolName] = useState('')
  const [poolDescription, setPoolDescription] = useState('')
  const [poolImage, setPoolImage] = useState('')
  const [collectionMode, setCollectionMode] = useState(0)
  const [collectionCreator, setCollectionCreator] = useState('')
  const [whitelistInput, setWhitelistInput] = useState('')
  const [useCustomName, setUseCustomName] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Step 1: Reward Model
  const [rewardModel, setRewardModel] = useState(0)

  // Step 2: Parameters
  const [rewardToken, setRewardToken] = useState<DiscoveredToken | null>(null)
  const [ratePerDay, setRatePerDay] = useState('')
  const [totalRewardPool, setTotalRewardPool] = useState('')
  const [aprRate, setAprRate] = useState('')
  const [valuePerNft, setValuePerNft] = useState('')
  const [nftValue, setNftValue] = useState('')
  const [lockOption, setLockOption] = useState(0)
  const [customLock, setCustomLock] = useState('')
  const [poolEndDate, setPoolEndDate] = useState<Date | null>(null)

  // Step 3: Fees
  const [depositFeeBps, setDepositFeeBps] = useState('0')
  const [withdrawFeeBps, setWithdrawFeeBps] = useState('0')
  const [claimFeeBps, setClaimFeeBps] = useState('800') // 8% default

  const actualLock = lockOption === -1 ? Number(customLock) : lockOption

  const whitelistedAsaIds = useMemo(() => {
    return whitelistInput
      .split(/[\n,]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0)
  }, [whitelistInput])

  // Auto-fill creator address with connected wallet
  useEffect(() => {
    if (activeAddress && !collectionCreator) {
      setCollectionCreator(activeAddress)
    }
  }, [activeAddress])

  // Auto-generate pool name from collection + reward model
  useEffect(() => {
    if (!useCustomName) {
      const modelSuffix = rewardModel === 0 ? 'NFT Staking' : rewardModel === 1 ? 'NFT Pool' : 'NFT Farm'
      const prefix = collectionCreator.trim() ? collectionCreator.slice(0, 8) + '...' : ''
      setPoolName(prefix ? `${prefix} ${modelSuffix}` : modelSuffix)
    }
  }, [collectionCreator, rewardModel, useCustomName])

  const getDepositAmount = (): number => {
    switch (rewardModel) {
      case 0: // Fixed: calculate based on rate and duration
        if (!poolEndDate || !ratePerDay) return 0
        const days = Math.ceil((poolEndDate.getTime() / 1000 - Date.now() / 1000) / 86400)
        return Number(ratePerDay) * days * 1_000_000
      case 1: // Proportional
        return Number(totalRewardPool) * 1_000_000
      case 2: // APR: estimate based on value_per_nft and apr
        return Number(valuePerNft) * 10 * 1_000_000 // Estimate for 10 NFTs
      default:
        return 0
    }
  }

  const resetForm = () => {
    setCurrentStep(0)
    setPoolName('')
    setPoolDescription('')
    setPoolImage('')
    setCollectionMode(0)
    setCollectionCreator('')
    setWhitelistInput('')
    setRewardModel(0)
    setRewardToken(null)
    setRatePerDay('')
    setTotalRewardPool('')
    setAprRate('')
    setValuePerNft('')
    setNftValue('')
    setLockOption(0)
    setCustomLock('')
    setPoolEndDate(null)
    setDepositFeeBps('0')
    setWithdrawFeeBps('0')
    setClaimFeeBps('800')
    setDeployStatus('')
    setUseCustomName(false)
    setShowAdvanced(false)
  }

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 0: {
        const needsCreator = collectionMode === 0 || collectionMode === 2
        const needsWhitelist = collectionMode === 1 || collectionMode === 2
        return poolName.trim().length > 0
          && (!needsCreator || collectionCreator.trim().length > 0)
          && (!needsWhitelist || whitelistedAsaIds.length > 0)
      }
      case 1:
        return true // Just picking a radio
      case 2: {
        if (!rewardToken) return false
        if (rewardModel === 0) return Number(ratePerDay) > 0
        if (rewardModel === 1) return Number(totalRewardPool) > 0
        if (rewardModel === 2) return Number(aprRate) > 0 && Number(valuePerNft) > 0
        return false
      }
      case 3:
        return true
      default:
        return true
    }
  }

  const handleDeploy = async () => {
    if (!signer || !activeAddress) {
      toast.error('Wallet not connected.')
      return
    }
    if (!rewardToken) {
      toast.error('Please select a reward token.')
      return
    }

    setIsSubmitting(true)
    setDeployStatus('Authenticating...')

    try {
      await ensureAuth()

      const poolEndTime = poolEndDate ? Math.floor(poolEndDate.getTime() / 1000) : 0
      const lockPeriodSeconds = actualLock * 86400

      // Pool creation fee
      setDeployStatus('Calculating fees...')
      const feeConfig = await fetchFeeConfig()
      const depositAmount = getDepositAmount()
      const feeCalc = calculateFeeSimple('poolCreation', depositAmount, feeConfig)

      if (feeCalc.feeAmount > 0) {
        setDeployStatus('Paying creation fee...')
        const algodConfig = getAlgodConfigFromViteEnvironment()
        const algorandClient = algokit.AlgorandClient.fromConfig({ algodConfig })
        algorandClient.setDefaultSigner(signer)

        if (rewardToken.id === 0) {
          await algorandClient.send.payment({
            sender: activeAddress,
            signer,
            receiver: FEE_RECIPIENT,
            amount: algokit.microAlgos(feeCalc.feeAmount),
          })
        } else {
          await algorandClient.send.assetTransfer({
            sender: activeAddress,
            signer,
            receiver: FEE_RECIPIENT,
            amount: BigInt(feeCalc.feeAmount),
            assetId: BigInt(rewardToken.id),
          })
        }

        authFetch(`${import.meta.env.VITE_API_BASE_URL}/gasfee/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: activeAddress,
            gasAmount: feeCalc.feeAmount,
            gasType: 'nftPoolCreationFee',
            feeType: 'percentage',
          }),
        }).catch((err) => console.error('Error logging fee:', err))
      }

      // Deploy contract
      setDeployStatus('Deploying contract...')
      const appId = await createNftPool(
        rewardToken.id,
        rewardModel,
        collectionMode,
        collectionCreator || activeAddress,
        Number(nftValue) * 1_000_000 || 0,
        Number(ratePerDay) * 1_000_000 || 0,
        Number(totalRewardPool) * 1_000_000 || 0,
        Number(aprRate) * 100 || 0,
        Number(valuePerNft) * 1_000_000 || 0,
        poolEndTime,
        lockPeriodSeconds,
        FEE_RECIPIENT,
        Number(depositFeeBps),
        Number(withdrawFeeBps),
        Number(claimFeeBps),
        activeAddress,
        signer,
      )

      if (!appId) throw new Error('App ID not returned from contract.')

      // Opt contract into reward token and deposit rewards
      if (rewardToken.id > 0 && depositAmount > 0) {
        setDeployStatus('Opting contract into reward token...')
        await optInContractToNft(appId, rewardToken.id, activeAddress, signer)

        setDeployStatus('Depositing rewards...')
        await depositRewards(appId, rewardToken.id, feeCalc.netAmount, activeAddress, signer)
      } else if (rewardToken.id === 0 && depositAmount > 0) {
        setDeployStatus('Depositing ALGO rewards...')
        await depositRewardsAlgo(appId, feeCalc.netAmount, activeAddress, signer)
      }

      // Save to backend
      setDeployStatus('Saving pool data...')
      await addNftPool({
        appId,
        creatorId: activeAddress,
        poolName,
        poolDescription,
        poolImage,
        collectionMode,
        collectionCreator: collectionCreator || activeAddress,
        whitelistedAsaIds,
        rewardTokenId: rewardToken.id,
        rewardTokenName: rewardToken.name,
        rewardTokenImage: rewardToken.image,
        rewardModel,
        ratePerDay: Number(ratePerDay) * 1_000_000 || 0,
        totalRewardPool: Number(totalRewardPool) * 1_000_000 || 0,
        aprRate: Number(aprRate) * 100 || 0,
        valuePerNft: Number(valuePerNft) * 1_000_000 || 0,
        nftValue: Number(nftValue) * 1_000_000 || 0,
        poolEndTime,
        lockPeriod: lockPeriodSeconds,
        feeRecipient: FEE_RECIPIENT,
        depositFeeBps: Number(depositFeeBps),
        withdrawFeeBps: Number(withdrawFeeBps),
        claimFeeBps: Number(claimFeeBps),
      })

      toast.success('NFT staking pool created successfully!')
      resetForm()
      setIsOpen(false)
      fetchData()
    } catch (e) {
      console.error('Error creating NFT pool:', e)
      if (e instanceof Error) {
        if (e.message.includes('cancelled') || e.message.includes('CANCELLED')) return
        toast.error(e.message || 'Transaction failed or was rejected.', { autoClose: 8000 })
      } else {
        toast.error('Transaction failed or was rejected.')
      }
    } finally {
      setIsSubmitting(false)
      setDeployStatus('')
    }
  }

  const steps = [
    { title: 'Collection' },
    { title: 'Reward Model' },
    { title: 'Parameters' },
    { title: 'Fees' },
    { title: 'Deploy' },
  ]

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="flex flex-col gap-4">
            <p className="text-[var(--text-secondary)] text-sm">Set up your NFT collection and pool details.</p>

            <div className="flex flex-col gap-[10px]">
              <p className="large text-[var(--text-primary)]">Collection Mode</p>
              <Radio.Group
                value={collectionMode}
                onChange={(e) => setCollectionMode(e.target.value)}
                className="flex flex-col gap-2"
              >
                <Radio value={0}>Creator Address — Accept NFTs from a specific creator</Radio>
                <Radio value={1}>Whitelist — Accept specific NFT ASA IDs</Radio>
                <Radio value={2}>Both — Accept from creator OR whitelist</Radio>
              </Radio.Group>
            </div>

            {(collectionMode === 0 || collectionMode === 2) && (
              <div className="flex flex-col gap-[10px]">
                <p className="large text-[var(--text-primary)]">Collection Creator Address</p>
                <div className="bg-[var(--input-bg)] rounded-[12px] p-[7px]">
                  <Input
                    type="text"
                    placeholder="Algorand address of NFT creator"
                    value={collectionCreator}
                    onChange={(e) => setCollectionCreator(e.target.value)}
                    className="input-wrapper text-[16px] w-full"
                  />
                </div>
                <p className="text-xs text-[var(--text-secondary)]">Pre-filled with your connected wallet. Change if the collection was created by a different address.</p>
              </div>
            )}

            {(collectionMode === 1 || collectionMode === 2) && (
              <div className="flex flex-col gap-[10px]">
                <p className="large text-[var(--text-primary)]">Whitelisted ASA IDs</p>
                <textarea
                  placeholder="Enter ASA IDs separated by commas or newlines"
                  value={whitelistInput}
                  onChange={(e) => setWhitelistInput(e.target.value)}
                  rows={4}
                  className="w-full bg-[var(--input-bg)] rounded-[12px] p-3 text-sm text-[var(--input-text)] focus:outline-none resize-none"
                />
                {whitelistedAsaIds.length > 0 && (
                  <p className="text-xs text-[var(--text-secondary)]">{whitelistedAsaIds.length} ASA IDs parsed</p>
                )}
              </div>
            )}

            <div className="border-t border-[var(--border-color)] pt-3 mt-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Icon icon={showAdvanced ? 'mdi:chevron-up' : 'mdi:chevron-down'} className="w-4 h-4" />
                Advanced Settings
              </button>
              {showAdvanced && (
                <div className="flex flex-col gap-4 mt-3">
                  <div className="flex flex-col gap-[10px]">
                    <p className="large text-[var(--text-primary)]">Pool Name</p>
                    <div className="bg-[var(--input-bg)] rounded-[12px] p-[7px]">
                      <Input
                        type="text"
                        placeholder="Auto-generated pool name"
                        value={poolName}
                        onChange={(e) => { setPoolName(e.target.value); setUseCustomName(true) }}
                        className="input-wrapper text-[16px] w-full"
                      />
                    </div>
                    {!useCustomName && (
                      <p className="text-xs text-[var(--text-secondary)]">Auto-generated. Edit to customize.</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-[10px]">
                    <p className="large text-[var(--text-primary)]">Description (optional)</p>
                    <div className="bg-[var(--input-bg)] rounded-[12px] p-[7px]">
                      <Input
                        type="text"
                        placeholder="Describe your pool"
                        value={poolDescription}
                        onChange={(e) => setPoolDescription(e.target.value)}
                        className="input-wrapper text-[16px] w-full"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-[10px]">
                    <p className="large text-[var(--text-primary)]">Pool Image URL (optional)</p>
                    <div className="bg-[var(--input-bg)] rounded-[12px] p-[7px]">
                      <Input
                        type="text"
                        placeholder="https://..."
                        value={poolImage}
                        onChange={(e) => setPoolImage(e.target.value)}
                        className="input-wrapper text-[16px] w-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 1:
        return (
          <div className="flex flex-col gap-4">
            <p className="text-[var(--text-secondary)] text-sm">Choose how rewards are distributed to NFT stakers.</p>
            <div className="flex flex-col gap-3">
              {REWARD_MODEL_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => setRewardModel(opt.value)}
                  className={`p-4 rounded-xl cursor-pointer transition-all border-2 ${
                    rewardModel === opt.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-transparent bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)]'
                  }`}
                >
                  <p className="font-medium text-[var(--text-primary)]">{opt.label}</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="flex flex-col gap-4">
            <p className="text-[var(--text-secondary)] text-sm">Configure reward parameters for your pool.</p>

            <TokenSelector
              label="Reward Token"
              selected={rewardToken}
              onSelect={setRewardToken}
            />

            {rewardModel === 0 && (
              <div className="flex flex-col gap-[10px]">
                <p className="large text-[var(--text-primary)]">Rate Per Day (per NFT)</p>
                <div className="bg-[var(--input-bg)] rounded-[12px] p-[7px]">
                  <Input
                    type="number"
                    placeholder="Tokens per NFT per day"
                    value={ratePerDay}
                    onChange={(e) => setRatePerDay(e.target.value)}
                    className="input-wrapper text-[16px] w-full"
                    min={0}
                  />
                </div>
              </div>
            )}

            {rewardModel === 1 && (
              <div className="flex flex-col gap-[10px]">
                <p className="large text-[var(--text-primary)]">Total Reward Pool</p>
                <div className="bg-[var(--input-bg)] rounded-[12px] p-[7px]">
                  <Input
                    type="number"
                    placeholder="Total tokens to distribute"
                    value={totalRewardPool}
                    onChange={(e) => setTotalRewardPool(e.target.value)}
                    className="input-wrapper text-[16px] w-full"
                    min={0}
                  />
                </div>
              </div>
            )}

            {rewardModel === 2 && (
              <>
                <div className="flex flex-col gap-[10px]">
                  <p className="large text-[var(--text-primary)]">APR Rate (%)</p>
                  <div className="flex items-center gap-2 bg-[var(--input-bg)] rounded-[12px] p-[7px] pr-[14px]">
                    <Input
                      type="number"
                      placeholder="Annual percentage rate"
                      value={aprRate}
                      onChange={(e) => setAprRate(e.target.value)}
                      className="input-wrapper text-[16px] w-full"
                      min={0}
                    />
                    <span className="text-[var(--text-secondary)] font-medium">%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-[10px]">
                  <p className="large text-[var(--text-primary)]">Value Per NFT (in reward token)</p>
                  <div className="bg-[var(--input-bg)] rounded-[12px] p-[7px]">
                    <Input
                      type="number"
                      placeholder="Assigned value per NFT"
                      value={valuePerNft}
                      onChange={(e) => setValuePerNft(e.target.value)}
                      className="input-wrapper text-[16px] w-full"
                      min={0}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-col gap-[10px]">
              <p className="large text-[var(--text-primary)]">NFT Floor Value (optional, in reward token)</p>
              <div className="bg-[var(--input-bg)] rounded-[12px] p-[7px]">
                <Input
                  type="number"
                  placeholder="NFT value for oracle pricing"
                  value={nftValue}
                  onChange={(e) => setNftValue(e.target.value)}
                  className="input-wrapper text-[16px] w-full"
                  min={0}
                />
              </div>
            </div>

            <div className="flex flex-col gap-[10px]">
              <p className="large text-[var(--text-primary)]">Lock Period</p>
              <div className="grid grid-cols-3 gap-2">
                {LOCK_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLockOption(opt.value)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      lockOption === opt.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {lockOption === -1 && (
                <div className="algo-div flex gap-[10px] items-center justify-between bg-[var(--input-bg)] rounded-[12px] pl-[0px] pr-[18px] py-[7px]">
                  <Input
                    type="number"
                    placeholder="Custom lock period"
                    value={customLock}
                    onChange={(e) => setCustomLock(e.target.value)}
                    className="input-wrapper text-[16px] w-full"
                    min={0}
                  />
                  <p className="text-text_clr medium">Days</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-[10px]">
              <p className="large text-[var(--text-primary)]">Pool End Date (optional)</p>
              <DatePicker
                className="w-full"
                value={poolEndDate ? dayjs(poolEndDate) : null}
                onChange={(date) => setPoolEndDate(date?.toDate() || null)}
                disabledDate={(current) => current && current < dayjs().startOf('day')}
                placeholder="Select end date (leave empty for no end)"
              />
            </div>
          </div>
        )

      case 3:
        return (
          <div className="flex flex-col gap-4">
            <p className="text-[var(--text-secondary)] text-sm">Configure fee structure for the pool.</p>

            <div className="flex flex-col gap-[10px]">
              <p className="large text-[var(--text-primary)]">Deposit Fee (basis points)</p>
              <div className="bg-[var(--input-bg)] rounded-[12px] p-[7px]">
                <Input
                  type="number"
                  placeholder="0"
                  value={depositFeeBps}
                  onChange={(e) => setDepositFeeBps(e.target.value)}
                  className="input-wrapper text-[16px] w-full"
                  min={0}
                />
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{(Number(depositFeeBps) / 100).toFixed(2)}%</p>
            </div>

            <div className="flex flex-col gap-[10px]">
              <p className="large text-[var(--text-primary)]">Withdraw Fee (basis points)</p>
              <div className="bg-[var(--input-bg)] rounded-[12px] p-[7px]">
                <Input
                  type="number"
                  placeholder="0"
                  value={withdrawFeeBps}
                  onChange={(e) => setWithdrawFeeBps(e.target.value)}
                  className="input-wrapper text-[16px] w-full"
                  min={0}
                />
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{(Number(withdrawFeeBps) / 100).toFixed(2)}%</p>
            </div>

            <div className="flex flex-col gap-[10px]">
              <p className="large text-[var(--text-primary)]">Claim Fee (basis points)</p>
              <div className="bg-[var(--input-bg)] rounded-[12px] p-[7px]">
                <Input
                  type="number"
                  placeholder="800"
                  value={claimFeeBps}
                  onChange={(e) => setClaimFeeBps(e.target.value)}
                  className="input-wrapper text-[16px] w-full"
                  min={0}
                />
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{(Number(claimFeeBps) / 100).toFixed(2)}% (default: 8%)</p>
            </div>

            {/* Summary */}
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 mt-2">
              <h6 className="font-medium text-[var(--text-primary)] mb-2">Fee Summary</h6>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Deposit Fee</span>
                  <span>{(Number(depositFeeBps) / 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Withdraw Fee</span>
                  <span>{(Number(withdrawFeeBps) / 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Claim Fee</span>
                  <span>{(Number(claimFeeBps) / 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="flex flex-col gap-4">
            <p className="text-[var(--text-secondary)] text-sm mb-2">Review your NFT staking pool configuration before deploying.</p>

            <div className="flex flex-col gap-3 bg-[var(--bg-secondary)] rounded-xl p-4">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)] text-sm">Pool Name</span>
                <span className="font-medium text-sm">{poolName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)] text-sm">Collection Mode</span>
                <span className="font-medium text-sm">
                  {['Creator Address', 'Whitelist', 'Both'][collectionMode]}
                </span>
              </div>
              {collectionCreator && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)] text-sm">Creator</span>
                  <span className="font-medium text-sm text-xs">{collectionCreator.slice(0, 8)}...{collectionCreator.slice(-6)}</span>
                </div>
              )}
              {whitelistedAsaIds.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)] text-sm">Whitelisted ASAs</span>
                  <span className="font-medium text-sm">{whitelistedAsaIds.length} IDs</span>
                </div>
              )}

              <div className="border-t border-[var(--border-color)] my-1" />

              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)] text-sm">Reward Model</span>
                <span className="font-medium text-sm">{REWARD_MODEL_OPTIONS[rewardModel]?.label}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)] text-sm">Reward Token</span>
                {rewardToken ? (
                  <div className="flex items-center gap-2">
                    <TokenImage tokenId={rewardToken.id} src={rewardToken.image} symbol={rewardToken.symbol} size={20} />
                    <span className="font-medium text-sm">{rewardToken.symbol}</span>
                  </div>
                ) : (
                  <span className="text-sm text-[var(--text-secondary)]">Not selected</span>
                )}
              </div>

              {rewardModel === 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)] text-sm">Rate Per Day</span>
                  <span className="font-medium text-sm">{ratePerDay} {rewardToken?.symbol}/NFT/day</span>
                </div>
              )}
              {rewardModel === 1 && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)] text-sm">Total Reward Pool</span>
                  <span className="font-medium text-sm">{Number(totalRewardPool).toLocaleString()} {rewardToken?.symbol}</span>
                </div>
              )}
              {rewardModel === 2 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)] text-sm">APR Rate</span>
                    <span className="font-medium text-sm text-green">{aprRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)] text-sm">Value Per NFT</span>
                    <span className="font-medium text-sm">{valuePerNft} {rewardToken?.symbol}</span>
                  </div>
                </>
              )}

              <div className="border-t border-[var(--border-color)] my-1" />

              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)] text-sm">Lock Period</span>
                <span className="font-medium text-sm">{actualLock === 0 ? 'None' : `${actualLock} days`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)] text-sm">Pool End</span>
                <span className="font-medium text-sm">
                  {poolEndDate ? dayjs(poolEndDate).format('MMM D, YYYY') : 'No end date'}
                </span>
              </div>
            </div>

            {deployStatus && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-center">
                <p className="text-sm text-blue-700 dark:text-blue-400">{deployStatus}</p>
              </div>
            )}

            {!isWalletConnected && (
              <p className="text-red-500 italic text-sm text-center">
                Please connect your wallet to deploy
              </p>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Modal
      open={isOpen}
      onCancel={() => {
        if (!isSubmitting) {
          setIsOpen(false)
          resetForm()
        }
      }}
      className="del-modal"
      centered
      width={700}
      footer={null}
      maskClosable={!isSubmitting}
    >
      <div className="modal-content flex flex-col pt-[24px] pb-[24px] px-[24px]">
        <h5 className="text-[var(--text-primary)] font-apex text-center">Create NFT Staking Pool</h5>
        <div className="red-line w-full h-[1px] mt-[16px] mb-[16px]" />

        <Steps
          current={currentStep}
          size="small"
          items={steps}
          className="mb-[20px]"
          onChange={(step) => {
            if (step <= currentStep) setCurrentStep(step)
          }}
        />

        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar px-[4px] mb-[20px]">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentStep > 0 && (
            <Button
              text="Back"
              className="button btn-red-border flex-1"
              height={48}
              onClick={() => setCurrentStep(currentStep - 1)}
              disabled={isSubmitting}
            />
          )}

          {currentStep < 4 ? (
            <Button
              text="Next"
              className="button btn-primary flex-1"
              height={48}
              onClick={() => {
                if (!isWalletConnected) {
                  toast.error('Please connect your wallet first')
                  return
                }
                if (!canProceed(currentStep)) {
                  toast.error('Please complete all required fields')
                  return
                }
                setCurrentStep(currentStep + 1)
              }}
              disabled={!canProceed(currentStep) || !isWalletConnected}
            />
          ) : (
            <Button
              text={isSubmitting ? deployStatus || 'Deploying...' : 'Create NFT Pool'}
              className="button btn-primary flex-1"
              height={48}
              onClick={handleDeploy}
              disabled={isSubmitting || !isWalletConnected}
              loading={isSubmitting}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}

export default CreateNftPoolWizard
