import React, { useState, useEffect, useCallback } from 'react'
import { Icon } from '@iconify/react'
import { useWallet } from '@txnlab/use-wallet'
import { toast } from 'react-toastify'
import Button from './button'
import { stakeTokens as stakeFarmTokens, getAlgodClient } from '../../farming_func'
import { stakeTokens as stakePoolTokens } from '../../staking_func'
import { fetchFeeConfig, calculateFeeSimple } from '../../services/FeeService'
import { useAuth } from '../../hooks/useAuth'
import { authAxios } from '../../services/apiClient'
import {
  getPool,
  getZapQuote,
  buildAddLiquidityTxns,
  signAndSubmitAddLiquidity,
  getAssetBalance,
  getLpTokensReceived,
  isOptedIn,
  optInToAsset,
} from '../../services/ZapService'
import type { ZapQuote } from '../../services/ZapService'
import type { V2PoolInfo } from '@tinymanorg/tinyman-js-sdk'

interface StakeModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  appId: number
  stakeTokenId: number
  stakeTokenName: string
  isLpFarm: boolean
  stakeTokenBId?: number
  pairName?: string
}

type StakeStep = 'input' | 'confirm' | 'adding-liquidity' | 'staking' | 'success' | 'error'

const StakeModal: React.FC<StakeModalProps> = ({
  visible,
  onClose,
  onSuccess,
  appId,
  stakeTokenId,
  stakeTokenName,
  isLpFarm,
  stakeTokenBId,
  pairName,
}) => {
  const { activeAddress, signer, signTransactions } = useWallet()
  const { ensureAuth } = useAuth()

  const [step, setStep] = useState<StakeStep>('input')
  const [selectedSide, setSelectedSide] = useState<'A' | 'B'>('B')
  const [inputAmount, setInputAmount] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [quote, setQuote] = useState<ZapQuote | null>(null)
  const [pool, setPool] = useState<V2PoolInfo | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [balance, setBalance] = useState<bigint>(0n)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [error, setError] = useState('')
  const [lpReceived, setLpReceived] = useState(0)
  const [poolLoading, setPoolLoading] = useState(false)
  const [poolFailed, setPoolFailed] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [lpStakeAmount, setLpStakeAmount] = useState('')
  const [lpBalance, setLpBalance] = useState<bigint>(0n)
  const [lpBalanceLoading, setLpBalanceLoading] = useState(false)

  const displayName = isLpFarm ? (pairName || stakeTokenName) : stakeTokenName
  const tokenNames = isLpFarm ? (pairName || '').split('/') : []
  const tokenAName = tokenNames[0]?.trim() || 'Token A'
  const tokenBName = tokenNames[1]?.trim() || 'Token B'
  const inputAssetId = isLpFarm ? (selectedSide === 'A' ? stakeTokenId : stakeTokenBId!) : stakeTokenId
  const inputTokenName = isLpFarm ? (selectedSide === 'A' ? tokenAName : tokenBName) : stakeTokenName
  const inputDecimals = 6

  const algod = getAlgodClient()

  // Fetch pool info on open (LP farm only)
  useEffect(() => {
    if (!visible || !isLpFarm || !stakeTokenBId) return
    setPoolLoading(true)
    getPool(algod, stakeTokenId, stakeTokenBId)
      .then(setPool)
      .catch((e) => {
        console.error('Pool fetch error:', e)
        setPoolFailed(true)
      })
      .finally(() => setPoolLoading(false))
  }, [visible, stakeTokenId, stakeTokenBId, isLpFarm])

  // Fetch user balance when asset changes
  useEffect(() => {
    if (!visible || !activeAddress) return
    setBalanceLoading(true)
    getAssetBalance(algod, activeAddress, inputAssetId)
      .then(setBalance)
      .finally(() => setBalanceLoading(false))
  }, [visible, activeAddress, inputAssetId])

  // Fetch quote when input changes (LP farm ZAP mode only)
  useEffect(() => {
    if (!isLpFarm || showAdvanced || !pool || !inputAmount) {
      setQuote(null)
      setQuoteError('')
      return
    }

    const amount = parseFloat(inputAmount)
    if (isNaN(amount) || amount <= 0) {
      setQuote(null)
      return
    }

    const amountMicro = BigInt(Math.floor(amount * Math.pow(10, inputDecimals)))
    if (amountMicro <= 0n) {
      setQuote(null)
      return
    }

    setQuoteLoading(true)
    setQuoteError('')

    try {
      const q = getZapQuote(
        pool,
        inputAssetId,
        amountMicro,
        { asset1: inputDecimals, asset2: inputDecimals },
        slippage / 100,
      )
      setQuote(q)
    } catch (e: any) {
      console.error('Quote error:', e)
      setQuoteError(e.message || 'Could not get quote')
      setQuote(null)
    } finally {
      setQuoteLoading(false)
    }
  }, [pool, inputAmount, inputAssetId, slippage, isLpFarm, showAdvanced])

  const inputAmountMicro = (() => {
    const v = parseFloat(inputAmount)
    if (isNaN(v) || v <= 0) return 0n
    return BigInt(Math.floor(v * Math.pow(10, inputDecimals)))
  })()

  const insufficientBalance = inputAmountMicro > 0n && inputAmountMicro > balance

  // For simple staking pools
  const canStakeSimple = inputAmountMicro > 0n && !insufficientBalance && !!activeAddress && !!signer
  // For LP farm ZAP mode
  const canZap = !!quote && inputAmountMicro > 0n && !insufficientBalance && !!activeAddress && !!signer && !!pool

  // Fetch LP balance when advanced mode toggled
  useEffect(() => {
    if (!showAdvanced || !activeAddress || !pool) return
    setLpBalanceLoading(true)
    getAssetBalance(algod, activeAddress, pool.poolTokenID!)
      .then(setLpBalance)
      .finally(() => setLpBalanceLoading(false))
  }, [showAdvanced, activeAddress, pool])

  // Simple stake (staking pools or LP farm advanced)
  const handleSimpleStake = useCallback(async () => {
    const isAdvancedLp = isLpFarm && showAdvanced
    const amountStr = isAdvancedLp ? lpStakeAmount : inputAmount
    const amount = parseFloat(amountStr)
    if (!activeAddress || !signer || isNaN(amount) || amount <= 0) return

    setStep('staking')
    const stakeAmountMicro = Math.floor(amount * 1_000_000)

    try {
      await ensureAuth()
      const feeType = isLpFarm ? 'farmingDeposit' : 'stakingDeposit'
      const feeConfig = await fetchFeeConfig()
      const fee = calculateFeeSimple(feeType, stakeAmountMicro, feeConfig)

      const tokenId = isAdvancedLp ? pool!.poolTokenID! : stakeTokenId

      if (isLpFarm) {
        await stakeFarmTokens(appId, stakeAmountMicro, activeAddress, signer, fee.feeAmount, tokenId, fee.feeRecipient)
      } else {
        await stakePoolTokens(appId, stakeAmountMicro, activeAddress, signer, fee.feeAmount, tokenId, fee.feeRecipient)
      }

      // Log staking to backend
      try {
        if (isLpFarm) {
          await authAxios.post('/stakingfarmingtoken/add', {
            tokens: amount,
            wallet: activeAddress,
            poolId: appId,
            stakedAmount: amount,
            earnedReward: 0,
            lastStakedAt: Date.now(),
            claimedAt: null,
          })
        } else {
          await authAxios.post('/stakingtoken/add', {
            stakeTokens: stakeTokenId,
            totalStaked: stakeAmountMicro,
            appId: appId,
            wallet: activeAddress,
          })
        }
      } catch (e) {
        console.warn('Failed to log staking data:', e)
      }

      setLpReceived(amount)
      setStep('success')
    } catch (e: any) {
      console.error('Stake error:', e)
      const msg = e?.message || 'Staking failed'
      if (msg.includes('cancelled') || msg.includes('rejected') || msg.includes('User rejected')) {
        setError('Transaction cancelled by user')
      } else {
        setError(msg)
      }
      setStep('error')
    }
  }, [inputAmount, lpStakeAmount, activeAddress, signer, appId, pool, isLpFarm, showAdvanced, stakeTokenId])

  // Execute ZAP (LP farm default mode)
  const handleExecuteZap = useCallback(async () => {
    if (!quote || !pool || !activeAddress || !signer || !signTransactions) return

    setError('')

    try {
      await ensureAuth()

      // Step 1: Add liquidity
      setStep('adding-liquidity')

      const lpOptedIn = await isOptedIn(algod, activeAddress, quote.poolTokenId)
      if (!lpOptedIn) {
        await optInToAsset(algod, activeAddress, quote.poolTokenId, signer)
      }

      const lpBefore = await getLpTokensReceived(algod, activeAddress, quote.poolTokenId)

      const txnGroup = await buildAddLiquidityTxns(
        algod,
        pool,
        inputAssetId,
        inputAmountMicro,
        activeAddress,
        quote.minLpMicro,
      )

      await signAndSubmitAddLiquidity(algod, pool, txnGroup, signTransactions)

      const lpAfter = await getLpTokensReceived(algod, activeAddress, quote.poolTokenId)
      const lpDelta = lpAfter - lpBefore
      const lpDeltaNum = Number(lpDelta)

      if (lpDeltaNum <= 0) {
        throw new Error('No LP tokens received from add-liquidity')
      }

      setLpReceived(lpDeltaNum / Math.pow(10, inputDecimals))

      // Step 2: Stake LP tokens in farm
      setStep('staking')

      const feeConfig = await fetchFeeConfig()
      const fee = calculateFeeSimple('farmingDeposit', lpDeltaNum, feeConfig)

      await stakeFarmTokens(
        appId,
        lpDeltaNum,
        activeAddress,
        signer,
        fee.feeAmount,
        quote.poolTokenId,
        fee.feeRecipient,
      )

      try {
        await authAxios.post('/stakingfarmingtoken/add', {
          tokens: lpDeltaNum / Math.pow(10, inputDecimals),
          wallet: activeAddress,
          poolId: appId,
          stakedAmount: lpDeltaNum / Math.pow(10, inputDecimals),
          earnedReward: 0,
          lastStakedAt: Date.now(),
          claimedAt: null,
        })
      } catch (e) {
        console.warn('Failed to log staking data:', e)
      }

      setStep('success')
    } catch (e: any) {
      console.error('ZAP error:', e)
      const msg = e?.message || 'Transaction failed'

      if (msg.includes('cancelled') || msg.includes('rejected') || msg.includes('User rejected')) {
        setError('Transaction cancelled by user')
      } else if (step === 'staking') {
        setError(`Liquidity added successfully, but staking failed: ${msg}. Your LP tokens are in your wallet — you can stake them manually on the Farm page.`)
      } else {
        setError(msg)
      }

      setStep('error')
    }
  }, [quote, pool, activeAddress, signer, signTransactions, inputAssetId, inputAmountMicro, appId])

  const handleClose = () => {
    setStep('input')
    setInputAmount('')
    setQuote(null)
    setQuoteError('')
    setError('')
    setLpReceived(0)
    setShowAdvanced(false)
    setLpStakeAmount('')
    setLpBalance(0n)
    setPool(null)
    setPoolFailed(false)
    onClose()
  }

  const handleSuccessClose = () => {
    handleClose()
    onSuccess()
  }

  if (!visible) return null

  // ─── Staking Pool (simple) input ────────────────────────────────────────────
  const renderSimpleInput = () => (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex justify-between mb-2">
          <p className="text-sm text-[var(--text-secondary)]">Amount</p>
          <p className="text-sm text-[var(--text-secondary)]">
            Balance:{' '}
            {balanceLoading ? (
              <Icon icon="eos-icons:loading" width={12} className="inline" />
            ) : (
              <span
                className="cursor-pointer hover:text-[var(--text-primary)]"
                onClick={() => setInputAmount((Number(balance) / Math.pow(10, inputDecimals)).toString())}
              >
                {(Number(balance) / Math.pow(10, inputDecimals)).toFixed(2)} {stakeTokenName}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[var(--input-bg)] rounded-[10px] px-3 py-2.5">
          <input
            type="number"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent focus:outline-none text-[var(--text-primary)] text-lg"
          />
          <button
            onClick={() => setInputAmount((Number(balance) / Math.pow(10, inputDecimals)).toString())}
            className="text-sm text-blue-500 font-medium hover:text-blue-400"
          >
            MAX
          </button>
        </div>
        {insufficientBalance && (
          <p className="text-red-500 text-sm mt-1">Insufficient balance</p>
        )}
      </div>

      <button
        onClick={handleSimpleStake}
        disabled={!canStakeSimple}
        className="w-full py-3 rounded-lg font-bold text-white transition-colors linearGradient disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {!activeAddress ? 'Connect Wallet' : insufficientBalance ? 'Insufficient Balance' : 'Stake'}
      </button>
    </div>
  )

  // ─── LP Farm input (ZAP mode) ──────────────────────────────────────────────
  const renderLpInput = () => {
    if (poolFailed) {
      return (
        <div className="flex flex-col gap-4">
          <div className="bg-[var(--bg-secondary)] rounded-lg p-4 text-center">
            <Icon icon="mdi:information-outline" width={28} className="text-blue-500 mx-auto mb-2" />
            <p className="text-[var(--text-primary)] font-medium mb-1">ZAP Not Available</p>
            <p className="text-sm text-[var(--text-secondary)]">
              No Tinyman V2 pool found for this pair. Single-token deposit is not supported.
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Get LP tokens from Tinyman directly, then stake them on the Farm page.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-full py-3 rounded-lg font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            Close
          </button>
        </div>
      )
    }

    return (
    <div className="flex flex-col gap-4">
      {/* Token selector */}
      <div>
        <p className="text-sm text-[var(--text-secondary)] mb-2">Deposit Token</p>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedSide('A')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              selectedSide === 'A'
                ? 'bg-red text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            {tokenAName}
          </button>
          <button
            onClick={() => setSelectedSide('B')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              selectedSide === 'B'
                ? 'bg-red text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            {tokenBName}
          </button>
        </div>
      </div>

      {/* Amount input */}
      <div>
        <div className="flex justify-between mb-2">
          <p className="text-sm text-[var(--text-secondary)]">Amount</p>
          <p className="text-sm text-[var(--text-secondary)]">
            Balance:{' '}
            {balanceLoading ? (
              <Icon icon="eos-icons:loading" width={12} className="inline" />
            ) : (
              <span
                className="cursor-pointer hover:text-[var(--text-primary)]"
                onClick={() => setInputAmount((Number(balance) / Math.pow(10, inputDecimals)).toString())}
              >
                {(Number(balance) / Math.pow(10, inputDecimals)).toFixed(2)} {inputTokenName}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[var(--input-bg)] rounded-[10px] px-3 py-2.5">
          <input
            type="number"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent focus:outline-none text-[var(--text-primary)] text-lg"
          />
          <button
            onClick={() => setInputAmount((Number(balance) / Math.pow(10, inputDecimals)).toString())}
            className="text-sm text-blue-500 font-medium hover:text-blue-400"
          >
            MAX
          </button>
        </div>
        {insufficientBalance && (
          <p className="text-red-500 text-sm mt-1">Insufficient balance</p>
        )}
      </div>

      {/* Slippage */}
      <div>
        <p className="text-sm text-[var(--text-secondary)] mb-2">Slippage Tolerance</p>
        <div className="flex gap-2">
          {[0.5, 1, 2].map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                slippage === s
                  ? 'bg-red text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
              }`}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>

      {/* Quote */}
      {quoteLoading && (
        <div className="flex items-center justify-center py-3 text-blue-500 text-sm gap-2">
          <Icon icon="eos-icons:loading" width={16} />
          Getting quote...
        </div>
      )}

      {quoteError && (
        <p className="text-red-500 text-sm text-center">{quoteError}</p>
      )}

      {quote && !quoteLoading && (
        <div className="bg-[var(--bg-secondary)] rounded-lg p-4 flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">You deposit</span>
            <span className="text-[var(--text-primary)]">
              {inputAmount} {inputTokenName}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Expected LP tokens</span>
            <span className="text-[var(--text-primary)]">
              ~{(Number(quote.expectedLpMicro) / Math.pow(10, inputDecimals)).toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--text-secondary)]">Min LP (after slippage)</span>
            <span className="text-[var(--text-primary)]">
              {(Number(quote.minLpMicro) / Math.pow(10, inputDecimals)).toFixed(4)}
            </span>
          </div>
          {quote.priceImpact > 0.02 && (
            <div className="flex justify-between text-sm text-yellow-500">
              <span>Price impact</span>
              <span>{(quote.priceImpact * 100).toFixed(2)}%</span>
            </div>
          )}
        </div>
      )}

      {/* ZAP button */}
      <button
        onClick={() => setStep('confirm')}
        disabled={!canZap}
        className="w-full py-3 rounded-lg font-bold text-white transition-colors linearGradient disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {!activeAddress ? 'Connect Wallet' : insufficientBalance ? 'Insufficient Balance' : 'Deposit'}
      </button>

      <p className="text-xs text-[var(--text-secondary)] text-center">
        You will be asked to sign 2 transactions
      </p>

      {/* Advanced: direct LP stake */}
      <div className="mt-2 pt-3 border-t border-[var(--border-color)]">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
        >
          <Icon icon={showAdvanced ? 'mdi:chevron-up' : 'mdi:chevron-down'} width={16} />
          I already have LP tokens
        </button>
        {showAdvanced && (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <div className="flex justify-between mb-1">
                <p className="text-sm text-[var(--text-secondary)]">LP Token Amount</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Balance:{' '}
                  {lpBalanceLoading ? (
                    <Icon icon="eos-icons:loading" width={12} className="inline" />
                  ) : (
                    <span
                      className="cursor-pointer hover:text-[var(--text-primary)]"
                      onClick={() => setLpStakeAmount((Number(lpBalance) / 1e6).toString())}
                    >
                      {(Number(lpBalance) / 1e6).toFixed(4)}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 bg-[var(--input-bg)] rounded-[10px] px-3 py-2.5">
                <input
                  type="number"
                  value={lpStakeAmount}
                  onChange={(e) => setLpStakeAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent focus:outline-none text-[var(--text-primary)] text-lg"
                />
                <button
                  onClick={() => setLpStakeAmount((Number(lpBalance) / 1e6).toString())}
                  className="text-sm text-blue-500 font-medium hover:text-blue-400"
                >
                  MAX
                </button>
              </div>
            </div>
            <button
              onClick={handleSimpleStake}
              disabled={!activeAddress || !lpStakeAmount || parseFloat(lpStakeAmount) <= 0}
              className="w-full py-3 rounded-lg font-bold text-white transition-colors linearGradient disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Stake LP Tokens
            </button>
          </div>
        )}
      </div>
    </div>
  )
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={step === 'input' || step === 'success' || step === 'error' ? handleClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-[var(--bg-card)] rounded-[16px] w-full max-w-[440px] mx-4 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Icon icon="mdi:arrow-down-circle" className="text-blue-500" width={22} />
            <h3 className="text-[var(--text-primary)] font-bold text-lg">Stake in {displayName}</h3>
          </div>
          {(step === 'input' || step === 'success' || step === 'error') && (
            <button onClick={handleClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <Icon icon="mdi:close" width={22} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Loading pool (LP farm only) */}
          {isLpFarm && poolLoading && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Icon icon="eos-icons:loading" width={32} className="text-blue-500" />
              <p className="text-[var(--text-secondary)]">Finding Tinyman pool...</p>
            </div>
          )}

          {/* Input step */}
          {step === 'input' && !(isLpFarm && poolLoading) && (
            isLpFarm ? renderLpInput() : renderSimpleInput()
          )}

          {/* Confirm step (LP farm ZAP only) */}
          {step === 'confirm' && (
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <Icon icon="mdi:arrow-down-circle" width={48} className="text-blue-500 mx-auto" />
                <h4 className="text-[var(--text-primary)] font-bold text-lg mt-2">Confirm Deposit</h4>
              </div>

              <div className="bg-[var(--bg-secondary)] rounded-lg p-4 flex flex-col gap-3">
                <p className="text-sm text-[var(--text-secondary)]">This will:</p>
                <ol className="list-decimal list-inside text-sm text-[var(--text-primary)] space-y-2">
                  <li>
                    Deposit {inputAmount} {inputTokenName} into the {pairName} Tinyman pool
                  </li>
                  <li>Stake the received LP tokens in this farm</li>
                </ol>
                {quote && (
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Expected: ~{(Number(quote.expectedLpMicro) / Math.pow(10, inputDecimals)).toFixed(4)} LP tokens
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('input')}
                  className="flex-1 py-3 rounded-lg font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleExecuteZap}
                  className="flex-1 py-3 rounded-lg font-bold text-white linearGradient transition-colors"
                >
                  Confirm Deposit
                </button>
              </div>
            </div>
          )}

          {/* Progress steps */}
          {(step === 'adding-liquidity' || step === 'staking') && (
            <div className="flex flex-col items-center py-8 gap-4">
              <Icon icon="eos-icons:loading" width={48} className="text-blue-500" />
              <div className="text-center">
                <p className="text-[var(--text-primary)] font-bold text-lg">
                  {isLpFarm && !showAdvanced && step === 'adding-liquidity'
                    ? 'Step 1/2: Adding Liquidity'
                    : isLpFarm && !showAdvanced && step === 'staking'
                    ? 'Step 2/2: Staking LP Tokens'
                    : 'Staking...'}
                </p>
                <p className="text-[var(--text-secondary)] text-sm mt-1">
                  Please confirm in your wallet
                </p>
              </div>

              {isLpFarm && !showAdvanced && (
                <div className="flex items-center gap-3 mt-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step === 'adding-liquidity' ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'
                  }`}>
                    {step === 'adding-liquidity' ? '1' : <Icon icon="mdi:check" width={18} />}
                  </div>
                  <div className={`w-12 h-0.5 ${step === 'staking' ? 'bg-green-500' : 'bg-gray-600'}`} />
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step === 'staking' ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-400'
                  }`}>
                    2
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <Icon icon="mdi:check-circle" width={64} className="text-green-500" />
              <div className="text-center">
                <h4 className="text-[var(--text-primary)] font-bold text-xl">Stake Successful!</h4>
                <p className="text-[var(--text-secondary)] mt-2">
                  {lpReceived.toFixed(4)} {isLpFarm ? 'LP tokens' : stakeTokenName} staked
                </p>
              </div>
              <button
                onClick={handleSuccessClose}
                className="mt-2 px-8 py-3 rounded-lg font-bold text-white linearGradient transition-colors"
              >
                Done
              </button>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="flex flex-col items-center py-8 gap-4">
              <Icon icon="mdi:alert-circle" width={64} className="text-red-500" />
              <div className="text-center">
                <h4 className="text-[var(--text-primary)] font-bold text-xl">Stake Failed</h4>
                <p className="text-[var(--text-secondary)] text-sm mt-2 max-w-[350px]">{error}</p>
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => { setStep('input'); setError('') }}
                  className="px-6 py-2.5 rounded-lg font-medium text-white linearGradient transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="px-6 py-2.5 rounded-lg font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StakeModal
