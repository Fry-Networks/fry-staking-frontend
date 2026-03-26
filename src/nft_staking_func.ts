import * as algokit from '@algorandfoundation/algokit-utils'
import algosdk, { TransactionSigner } from 'algosdk'
import { FryNftStakingClient, APP_SPEC } from './contracts/FryNftStakingClient'
import { COMPILED_APPROVAL, COMPILED_CLEAR } from './contracts/FryNftStakingCompiled'
import { getAlgodConfigFromViteEnvironment, getIndexerConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'
import { logFee } from './utils/logFee'
import type { TransactionSignerAccount } from '@algorandfoundation/algokit-utils/types/account'
import type { AppDetails } from '@algorandfoundation/algokit-utils/types/app-client'

const BOX_PRICE = 2500 + 400 * 64

const createNftStakingClient = async (signer: TransactionSigner, activeAddress: string, appId: number) => {
  algokit.Config.configure({ populateAppCallResources: true })

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const algorandClient: algokit.AlgorandClient = algokit.AlgorandClient.fromConfig({ algodConfig })
  algorandClient.setDefaultSigner(signer)

  const algodClient = algokit.getAlgoClient({
    server: algodConfig.server,
    port: algodConfig.port,
    token: algodConfig.token,
  })

  const client = new FryNftStakingClient(
    {
      resolveBy: 'id',
      id: appId,
      sender: { addr: activeAddress, signer },
    },
    algorandClient.client.algod,
  )

  return { client, algorandClient, algodClient }
}

const getAlgodClient = () => {
  const algodConfig = getAlgodConfigFromViteEnvironment()
  return algokit.getAlgoClient({
    server: algodConfig.server,
    port: algodConfig.port,
    token: algodConfig.token,
  })
}

export interface AlgodConfigOverride {
  server: string
  port: number
  token: string
}

export function getAlgodClientWithOverride(override?: AlgodConfigOverride) {
  if (override) {
    return new algosdk.Algodv2(override.token, override.server, override.port)
  }
  return getAlgodClient()
}

const getIndexerClient = () => {
  const indexerConfig = getIndexerConfigFromViteEnvironment()
  return algokit.getAlgoIndexerClient({
    server: indexerConfig.server,
    port: indexerConfig.port,
    token: indexerConfig.token,
  })
}

/**
 * Create a new NFT staking pool on-chain.
 */
export const createNftPool = async (
  rewardTokenId: number,
  rewardModel: number,
  collectionMode: number,
  collectionCreator: string,
  nftValue: number,
  ratePerDay: number,
  totalRewardPool: number,
  aprRate: number,
  valuePerNft: number,
  poolEndTime: number,
  lockPeriod: number,
  feeRecipient: string,
  depositFeeBps: number,
  withdrawFeeBps: number,
  claimFeeBps: number,
  sender: string,
  signer: TransactionSigner,
) => {
  try {
    const algodClient = getAlgodClient()

    // Build ABI method from APP_SPEC contract definition (no runtime TEAL compilation)
    const abiContract = new algosdk.ABIContract(APP_SPEC.contract as any)
    const initPoolMethod = abiContract.getMethodByName('init_pool')

    const suggestedParams = await algodClient.getTransactionParams().do()

    const atc = new algosdk.AtomicTransactionComposer()
    atc.addMethodCall({
      appID: 0,
      method: initPoolMethod,
      methodArgs: [
        rewardTokenId,
        rewardModel,
        collectionMode,
        collectionCreator || sender,
        nftValue,
        ratePerDay,
        totalRewardPool,
        aprRate,
        valuePerNft,
        poolEndTime,
        lockPeriod,
        feeRecipient || sender,
        depositFeeBps,
        withdrawFeeBps,
        claimFeeBps,
      ],
      approvalProgram: COMPILED_APPROVAL,
      clearProgram: COMPILED_CLEAR,
      numGlobalInts: 17,
      numGlobalByteSlices: 3,
      numLocalInts: 0,
      numLocalByteSlices: 0,
      sender,
      signer,
      suggestedParams,
      onComplete: algosdk.OnApplicationComplete.NoOpOC,
    })

    const result = await atc.execute(algodClient, 4)
    const appId = result.methodResults[0].txInfo?.['application-index']
    if (!appId) {
      throw new Error('Failed to create NFT staking pool.')
    }

    const { algorandClient } = await createNftStakingClient(signer, sender, Number(appId))

    // MBR payment for contract
    await algorandClient.send.payment({
      sender,
      receiver: algosdk.getApplicationAddress(BigInt(appId)),
      amount: algokit.algos(0.3),
      extraFee: algokit.algos(0.001),
    })

    await new Promise((resolve) => setTimeout(resolve, 500))

    return Number(appId)
  } catch (e) {
    console.error('Error in createNftPool:', e)
    throw e
  }
}

/**
 * Opt the contract into an NFT ASA. Must be called before first stake of each ASA.
 */
export const optInContractToNft = async (
  appId: number,
  assetId: number,
  sender: string,
  signer: TransactionSigner,
) => {
  try {
    const { client, algorandClient } = await createNftStakingClient(signer, sender, appId)

    const mbrPay = await algorandClient.transactions.payment({
      sender,
      receiver: algosdk.getApplicationAddress(appId),
      amount: algokit.algos(0.1),
      extraFee: algokit.algos(0.002),
      signer,
    })

    await client.optInAsset({ asset: assetId, mbrPayment: mbrPay })

    return true
  } catch (e) {
    console.error('Error in optInContractToNft:', e)
    throw e
  }
}

/**
 * Stake an NFT into the pool.
 */
export const stakeNft = async (
  appId: number,
  nftAsaId: number,
  sender: string,
  signer: TransactionSigner,
  feeAmount: number,
  feeTokenId: number,
  feeRecipient: string,
) => {
  try {
    const { client, algorandClient } = await createNftStakingClient(signer, sender, appId)

    const nftTransfer = await algorandClient.transactions.assetTransfer({
      sender,
      receiver: algosdk.getApplicationAddress(appId),
      assetId: BigInt(nftAsaId),
      amount: 1n,
      signer,
    })

    const boxPayment = await algorandClient.transactions.payment({
      sender,
      receiver: algosdk.getApplicationAddress(appId),
      amount: algokit.microAlgos(BOX_PRICE),
      signer,
    })

    const tx = await client
      .stakeNft(
        { nftTransfer, boxPayment },
        {
          boxes: [{ appIndex: 0, name: algosdk.decodeAddress(sender).publicKey }],
          sendParams: { fee: algokit.algos(0.003) },
        },
      )
      .catch((e: any) => e)

    if (tx instanceof Error) return tx

    // Send fee after successful contract call
    if (feeAmount > 0) {
      try {
        let feeResult
        if (feeTokenId === 0) {
          feeResult = await algorandClient.send.payment({
            sender,
            signer,
            receiver: feeRecipient,
            amount: algokit.microAlgos(feeAmount),
          })
        } else {
          feeResult = await algorandClient.send.assetTransfer({
            sender,
            signer,
            receiver: feeRecipient,
            amount: BigInt(feeAmount),
            assetId: BigInt(feeTokenId),
          })
        }
        const feeTxId = feeResult.txIds?.[0] || (feeResult as any).transaction?.txID?.()

        await logFee({
          appId,
          userId: sender,
          gasAmount: feeAmount,
          gasType: 'nftStakingStake',
          feeType: 'percentage',
          txId: feeTxId,
        })
      } catch (feeErr) {
        console.warn('Fee transfer failed after successful NFT stake:', feeErr)
      }
    }

    return tx
  } catch (e) {
    console.error('Error in stakeNft:', e)
    return e
  }
}

/**
 * Unstake an NFT from the pool (auto-claims rewards).
 */
export const unstakeNft = async (
  appId: number,
  nftAsaId: number,
  sender: string,
  signer: TransactionSigner,
  feeAmount: number,
  feeTokenId: number,
  feeRecipient: string,
) => {
  try {
    const { client, algorandClient } = await createNftStakingClient(signer, sender, appId)

    const tx = await client
      .unstakeNft(
        { nftId: nftAsaId },
        {
          boxes: [{ appIndex: 0, name: algosdk.decodeAddress(sender).publicKey }],
          sendParams: { fee: algokit.algos(0.003) },
        },
      )
      .catch((e: any) => e)

    if (tx instanceof Error) return tx

    if (feeAmount > 0) {
      try {
        let feeResult
        if (feeTokenId === 0) {
          feeResult = await algorandClient.send.payment({
            sender,
            signer,
            receiver: feeRecipient,
            amount: algokit.microAlgos(feeAmount),
          })
        } else {
          feeResult = await algorandClient.send.assetTransfer({
            sender,
            signer,
            receiver: feeRecipient,
            amount: BigInt(feeAmount),
            assetId: BigInt(feeTokenId),
          })
        }
        const feeTxId = feeResult.txIds?.[0] || (feeResult as any).transaction?.txID?.()

        await logFee({
          appId,
          userId: sender,
          gasAmount: feeAmount,
          gasType: 'nftStakingWithdraw',
          feeType: 'percentage',
          txId: feeTxId,
        })
      } catch (feeErr) {
        console.warn('Fee transfer failed after successful NFT unstake:', feeErr)
      }
    }

    return tx
  } catch (e) {
    console.error('Error in unstakeNft:', e)
    return e
  }
}

/**
 * Claim accumulated rewards from the pool.
 */
export const claimRewards = async (
  appId: number,
  sender: string,
  signer: TransactionSigner,
  feeAmount: number,
  feeTokenId: number,
  feeRecipient: string,
) => {
  try {
    const { client, algorandClient } = await createNftStakingClient(signer, sender, appId)

    const tx = await client
      .claimRewards(
        {},
        {
          boxes: [{ appIndex: 0, name: algosdk.decodeAddress(sender).publicKey }],
          sendParams: { fee: algokit.algos(0.002) },
        },
      )
      .catch((e: any) => e)

    if (tx instanceof Error) return tx

    if (feeAmount > 0) {
      try {
        let feeResult
        if (feeTokenId === 0) {
          feeResult = await algorandClient.send.payment({
            sender,
            signer,
            receiver: feeRecipient,
            amount: algokit.microAlgos(feeAmount),
          })
        } else {
          feeResult = await algorandClient.send.assetTransfer({
            sender,
            signer,
            receiver: feeRecipient,
            amount: BigInt(feeAmount),
            assetId: BigInt(feeTokenId),
          })
        }
        const feeTxId = feeResult.txIds?.[0] || (feeResult as any).transaction?.txID?.()

        await logFee({
          appId,
          userId: sender,
          gasAmount: feeAmount,
          gasType: 'nftStakingClaim',
          feeType: 'percentage',
          txId: feeTxId,
        })
      } catch (feeErr) {
        console.warn('Fee transfer failed after successful NFT claim:', feeErr)
      }
    }

    return tx
  } catch (e) {
    console.error('Error in claimRewards:', e)
    return e
  }
}

/**
 * Deposit rewards into the pool (ASA token).
 */
export const depositRewards = async (
  appId: number,
  rewardTokenId: number,
  amount: number,
  sender: string,
  signer: TransactionSigner,
) => {
  try {
    const { client, algorandClient } = await createNftStakingClient(signer, sender, appId)

    const rewardTxn = await algorandClient.transactions.assetTransfer({
      sender,
      receiver: algosdk.getApplicationAddress(appId),
      assetId: BigInt(rewardTokenId),
      amount: BigInt(amount),
      signer,
    })

    const tx = await client.depositRewards({ rewardTxn })
    return tx
  } catch (e) {
    console.error('Error in depositRewards:', e)
    throw e
  }
}

/**
 * Deposit ALGO rewards into the pool.
 */
export const depositRewardsAlgo = async (
  appId: number,
  amount: number,
  sender: string,
  signer: TransactionSigner,
) => {
  try {
    const { client, algorandClient } = await createNftStakingClient(signer, sender, appId)

    const payment = await algorandClient.transactions.payment({
      sender,
      receiver: algosdk.getApplicationAddress(appId),
      amount: algokit.microAlgos(amount),
      signer,
    })

    const tx = await client.depositRewardsAlgo({ payment })
    return tx
  } catch (e) {
    console.error('Error in depositRewardsAlgo:', e)
    throw e
  }
}

/**
 * Pause the pool (creator only).
 */
export const pausePool = async (appId: number, sender: string, signer: TransactionSigner) => {
  const { client } = await createNftStakingClient(signer, sender, appId)
  return client.pausePool({})
}

/**
 * Resume the pool (creator only).
 */
export const resumePool = async (appId: number, sender: string, signer: TransactionSigner) => {
  const { client } = await createNftStakingClient(signer, sender, appId)
  return client.resumePool({})
}

/**
 * Update pool end time (creator only).
 */
export const updateEndTime = async (appId: number, newEndTime: number, sender: string, signer: TransactionSigner) => {
  const { client } = await createNftStakingClient(signer, sender, appId)
  return client.updateEndTime({ newEndTime: BigInt(newEndTime) })
}

/**
 * Add NFT ASA to whitelist (creator only).
 */
export const addToWhitelist = async (appId: number, nftId: number, sender: string, signer: TransactionSigner) => {
  const { client } = await createNftStakingClient(signer, sender, appId)
  return client.addToWhitelist(
    { nftId },
    { boxes: [{ appIndex: 0, name: new TextEncoder().encode('wl') }] },
  )
}

/**
 * Remove NFT ASA from whitelist (creator only).
 */
export const removeFromWhitelist = async (appId: number, nftId: number, sender: string, signer: TransactionSigner) => {
  const { client } = await createNftStakingClient(signer, sender, appId)
  return client.removeFromWhitelist(
    { nftId },
    { boxes: [{ appIndex: 0, name: new TextEncoder().encode('wl') }] },
  )
}

/**
 * Calculate pending rewards for a user (client-side estimation).
 */
export const calculatePendingRewards = async (appId: number, sender: string, signer: TransactionSigner) => {
  try {
    const { client } = await createNftStakingClient(signer, sender, appId)
    const globalState: any = await client.getGlobalState()

    const rewardModel = globalState?.rewardModel?.asNumber() ?? 0
    const ratePerDay = globalState?.ratePerDay?.asNumber() ?? 0
    const totalRewardPool = globalState?.totalRewardPool?.asNumber() ?? 0
    const totalNftsStaked = globalState?.totalNftsStaked?.asNumber() ?? 0
    const aprRate = globalState?.aprRate?.asNumber() ?? 0
    const valuePerNft = globalState?.valuePerNft?.asNumber() ?? 0
    const rewardTokenId = globalState?.rewardTokenId?.asNumber() ?? 0

    // Read user box
    const algod = getAlgodClient()
    const boxName = algosdk.decodeAddress(sender).publicKey
    let userStakeTime: number

    try {
      const boxValue = await algokit.getAppBoxValue(appId, boxName, algod)
      // Box format: stakeTime(8) + nftCount(8) + totalClaimed(8)
      userStakeTime = Number(algosdk.decodeUint64(boxValue.slice(0, 8), 'mixed'))
    } catch {
      return { reward: 0, rewardTokenId }
    }

    const now = Math.floor(Date.now() / 1000)
    const stakeDuration = now - userStakeTime
    const stakeDays = stakeDuration / 86400

    let reward = 0
    switch (rewardModel) {
      case 0: // Fixed rate
        reward = ratePerDay * stakeDays
        break
      case 1: // Proportional
        if (totalNftsStaked > 0) {
          reward = (totalRewardPool / totalNftsStaked) * stakeDays
        }
        break
      case 2: // APR
        reward = (valuePerNft * (aprRate / 10000) * stakeDays) / 360
        break
    }

    return { reward: Math.floor(reward), rewardTokenId }
  } catch (e) {
    console.error('Error calculating pending rewards:', e)
    return { reward: 0, rewardTokenId: 0 }
  }
}

/**
 * Get global pool state data.
 */
export const getNftPoolData = async (appId: number, sender: string, signer: TransactionSigner) => {
  try {
    const { client } = await createNftStakingClient(signer, sender, appId)
    const globalState: any = await client.getGlobalState()
    return {
      rewardModel: globalState?.rewardModel?.asNumber(),
      rewardTokenId: globalState?.rewardTokenId?.asNumber(),
      collectionMode: globalState?.collectionMode?.asNumber(),
      ratePerDay: globalState?.ratePerDay?.asNumber(),
      totalRewardPool: globalState?.totalRewardPool?.asNumber(),
      aprRate: globalState?.aprRate?.asNumber(),
      valuePerNft: globalState?.valuePerNft?.asNumber(),
      nftValue: globalState?.nftValue?.asNumber(),
      poolEndTime: globalState?.poolEndTime?.asNumber(),
      lockPeriod: globalState?.lockPeriod?.asNumber(),
      isActive: globalState?.isActive?.asNumber(),
      totalNftsStaked: globalState?.totalNftsStaked?.asNumber(),
      totalRewardBalance: globalState?.totalRewardBalance?.asNumber(),
      totalRewardsClaimed: globalState?.totalRewardsClaimed?.asNumber(),
    }
  } catch (e) {
    console.error('getNftPoolData error:', e)
    throw e
  }
}
