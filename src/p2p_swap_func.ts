// @ts-nocheck — WIP: requestAssetId type not yet in generated client
import * as algokit from '@algorandfoundation/algokit-utils'
import algosdk, { TransactionSigner } from 'algosdk'
import { FryP2PSwapClient } from './contracts/FryP2PSwapClient'
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs'
import { P2P_BOX_MBR, P2P_FEE_CREATE, P2P_FEE_ACCEPT, P2P_FEE_CANCEL, P2P_FEE_UPDATE } from './config/p2pSwapConfig'

export interface AlgodConfigOverride {
  server: string;
  port: string | number;
  token: string;
}

const ZERO_ADDRESS = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'

/**
 * Encode an offer ID as 8-byte big-endian Uint8Array for box references.
 */
export function encodeOfferId(offerId: number): Uint8Array {
  const buf = new ArrayBuffer(8)
  new DataView(buf).setBigUint64(0, BigInt(offerId))
  return new Uint8Array(buf)
}

/**
 * Create a P2P swap client for an existing market contract.
 */
const createP2PSwapClient = async (
  signer: TransactionSigner,
  activeAddress: string,
  appId: number,
  algodConfigOverride?: AlgodConfigOverride,
) => {
  algokit.Config.configure({ populateAppCallResources: true })

  const algodConfig = algodConfigOverride
    ? { ...algodConfigOverride, network: '' }
    : getAlgodConfigFromViteEnvironment()
  const algorandClient = algokit.AlgorandClient.fromConfig({ algodConfig })
  algorandClient.setDefaultSigner(signer)

  const algodClient = algokit.getAlgoClient({
    server: algodConfig.server,
    port: algodConfig.port,
    token: algodConfig.token,
  })

  const p2pClient = new FryP2PSwapClient(
    {
      resolveBy: 'id',
      id: appId,
      sender: { addr: activeAddress!, signer },
    },
    algorandClient.client.algod,
  )

  return { p2pClient, algorandClient, algodClient }
}

// ────────────────────────────────────────────────────────────────
// CREATE OFFER (ASA → native, e.g. FRY → ALGO)
// ────────────────────────────────────────────────────────────────

export const createOfferAsa = async (
  appId: number,
  offerAssetId: number,
  offerAmount: number,
  requestAmount: number,
  counterparty: string,
  expiry: number,
  sender: string,
  signer: TransactionSigner,
  algodConfig?: AlgodConfigOverride,
) => {
  try {
    const appAddress = algosdk.getApplicationAddress(appId)
    const { p2pClient, algorandClient, algodClient } = await createP2PSwapClient(signer, sender, appId, algodConfig)

    // Read request_asset_id from global state
    const globalState = await p2pClient.getGlobalState()
    const requestAssetId = globalState.requestAssetId?.asNumber() ?? 0

    // Build asset transfer (escrow the offered ASA)
    const assetTransfer = await algorandClient.transactions.assetTransfer({
      sender,
      receiver: appAddress,
      amount: BigInt(offerAmount),
      assetId: BigInt(offerAssetId),
      signer,
    })

    // Build box MBR payment
    const boxPayment = await algorandClient.transactions.payment({
      sender,
      receiver: appAddress,
      amount: algokit.microAlgos(P2P_BOX_MBR),
      signer,
    })

    const result = await p2pClient.createOfferAsa(
      {
        assetTransfer,
        boxPayment,
        requestAssetId,
        requestAmount,
        counterparty: counterparty || ZERO_ADDRESS,
        expiry,
      },
      {
        sendParams: { fee: algokit.microAlgos(P2P_FEE_CREATE) },
      },
    )

    // Wait for confirmation
    const txId = result.transaction.txID()
    await algosdk.waitForConfirmation(algodClient, txId, 4)

    // Parse returned offer ID
    const offerId = Number(result.return)

    return { offerId, txId }
  } catch (e) {
    console.error('Error in createOfferAsa:', e)
    throw e
  }
}

// ────────────────────────────────────────────────────────────────
// CREATE OFFER (native → ASA, e.g. ALGO → FRY)
// ────────────────────────────────────────────────────────────────

export const createOfferAlgo = async (
  appId: number,
  offerAmount: number,
  requestAmount: number,
  counterparty: string,
  expiry: number,
  sender: string,
  signer: TransactionSigner,
  algodConfig?: AlgodConfigOverride,
) => {
  try {
    const appAddress = algosdk.getApplicationAddress(appId)
    const { p2pClient, algorandClient, algodClient } = await createP2PSwapClient(signer, sender, appId, algodConfig)

    const globalState = await p2pClient.getGlobalState()
    const requestAssetId = globalState.requestAssetId?.asNumber() ?? 0

    // Offer payment (native ALGO/VOI)
    const offerPayment = await algorandClient.transactions.payment({
      sender,
      receiver: appAddress,
      amount: algokit.microAlgos(offerAmount),
      signer,
    })

    // Box MBR payment
    const boxPayment = await algorandClient.transactions.payment({
      sender,
      receiver: appAddress,
      amount: algokit.microAlgos(P2P_BOX_MBR),
      signer,
    })

    const result = await p2pClient.createOfferAlgo(
      {
        offerPayment,
        boxPayment,
        offerAmount,
        requestAssetId,
        requestAmount,
        counterparty: counterparty || ZERO_ADDRESS,
        expiry,
      },
      {
        sendParams: { fee: algokit.microAlgos(P2P_FEE_CREATE) },
      },
    )

    const txId = result.transaction.txID()
    await algosdk.waitForConfirmation(algodClient, txId, 4)
    const offerId = Number(result.return)

    return { offerId, txId }
  } catch (e) {
    console.error('Error in createOfferAlgo:', e)
    throw e
  }
}

// ────────────────────────────────────────────────────────────────
// ACCEPT OFFER (taker sends native, e.g. ALGO → get FRY)
// ────────────────────────────────────────────────────────────────

export const acceptOfferAlgo = async (
  appId: number,
  offerId: number,
  requestAmount: number,
  feeRecipient: string,
  makerAddress: string,
  sender: string,
  signer: TransactionSigner,
  algodConfig?: AlgodConfigOverride,
) => {
  try {
    const appAddress = algosdk.getApplicationAddress(appId)
    const { p2pClient, algorandClient, algodClient } = await createP2PSwapClient(signer, sender, appId, algodConfig)

    // Taker payment (send ALGO/VOI to contract)
    const takerPayment = await algorandClient.transactions.payment({
      sender,
      receiver: appAddress,
      amount: algokit.microAlgos(requestAmount),
      signer,
    })

    const result = await p2pClient.acceptOfferAlgo(
      {
        offerId,
        takerPayment,
      },
      {
        sendParams: {
          fee: algokit.microAlgos(P2P_FEE_ACCEPT),
        },
        // CRITICAL: include fee_recipient and maker in foreign accounts
        accounts: [feeRecipient, makerAddress],
        boxes: [{ appIndex: 0, name: encodeOfferId(offerId) }],
      },
    )

    const txId = result.transaction.txID()
    await algosdk.waitForConfirmation(algodClient, txId, 4)

    return { txId }
  } catch (e) {
    console.error('Error in acceptOfferAlgo:', e)
    throw e
  }
}

// ────────────────────────────────────────────────────────────────
// ACCEPT OFFER (taker sends ASA, e.g. FRY → get ALGO)
// ────────────────────────────────────────────────────────────────

export const acceptOfferAsa = async (
  appId: number,
  offerId: number,
  requestAssetId: number,
  requestAmount: number,
  feeRecipient: string,
  makerAddress: string,
  sender: string,
  signer: TransactionSigner,
  algodConfig?: AlgodConfigOverride,
) => {
  try {
    const appAddress = algosdk.getApplicationAddress(appId)
    const { p2pClient, algorandClient, algodClient } = await createP2PSwapClient(signer, sender, appId, algodConfig)

    const takerTransfer = await algorandClient.transactions.assetTransfer({
      sender,
      receiver: appAddress,
      amount: BigInt(requestAmount),
      assetId: BigInt(requestAssetId),
      signer,
    })

    const result = await p2pClient.acceptOfferAsa(
      {
        offerId,
        takerTransfer,
      },
      {
        sendParams: {
          fee: algokit.microAlgos(P2P_FEE_ACCEPT),
        },
        accounts: [feeRecipient, makerAddress],
        boxes: [{ appIndex: 0, name: encodeOfferId(offerId) }],
      },
    )

    const txId = result.transaction.txID()
    await algosdk.waitForConfirmation(algodClient, txId, 4)

    return { txId }
  } catch (e) {
    console.error('Error in acceptOfferAsa:', e)
    throw e
  }
}

// ────────────────────────────────────────────────────────────────
// CANCEL OFFER
// ────────────────────────────────────────────────────────────────

export const cancelP2POffer = async (
  appId: number,
  offerId: number,
  sender: string,
  signer: TransactionSigner,
  algodConfig?: AlgodConfigOverride,
) => {
  try {
    const { p2pClient, algodClient } = await createP2PSwapClient(signer, sender, appId, algodConfig)

    const result = await p2pClient.cancelOffer(
      { offerId },
      {
        sendParams: { fee: algokit.microAlgos(P2P_FEE_CANCEL) },
        boxes: [{ appIndex: 0, name: encodeOfferId(offerId) }],
      },
    )

    const txId = result.transaction.txID()
    await algosdk.waitForConfirmation(algodClient, txId, 4)

    return { txId }
  } catch (e) {
    console.error('Error in cancelP2POffer:', e)
    throw e
  }
}

// ────────────────────────────────────────────────────────────────
// UPDATE OFFER (reprice)
// ────────────────────────────────────────────────────────────────

export const updateP2POffer = async (
  appId: number,
  offerId: number,
  newRequestAmount: number,
  sender: string,
  signer: TransactionSigner,
  algodConfig?: AlgodConfigOverride,
) => {
  try {
    const { p2pClient, algodClient } = await createP2PSwapClient(signer, sender, appId, algodConfig)

    const result = await p2pClient.updateOffer(
      { offerId, newRequestAmount },
      {
        sendParams: { fee: algokit.microAlgos(P2P_FEE_UPDATE) },
        boxes: [{ appIndex: 0, name: encodeOfferId(offerId) }],
      },
    )

    const txId = result.transaction.txID()
    await algosdk.waitForConfirmation(algodClient, txId, 4)

    return { txId }
  } catch (e) {
    console.error('Error in updateP2POffer:', e)
    throw e
  }
}

// ────────────────────────────────────────────────────────────────
// RECLAIM EXPIRED
// ────────────────────────────────────────────────────────────────

export const reclaimExpiredOffer = async (
  appId: number,
  offerId: number,
  sender: string,
  signer: TransactionSigner,
  algodConfig?: AlgodConfigOverride,
) => {
  try {
    const { p2pClient, algodClient } = await createP2PSwapClient(signer, sender, appId, algodConfig)

    const result = await p2pClient.reclaimExpired(
      { offerId },
      {
        sendParams: { fee: algokit.microAlgos(P2P_FEE_CANCEL) },
        boxes: [{ appIndex: 0, name: encodeOfferId(offerId) }],
      },
    )

    const txId = result.transaction.txID()
    await algosdk.waitForConfirmation(algodClient, txId, 4)

    return { txId }
  } catch (e) {
    console.error('Error in reclaimExpiredOffer:', e)
    throw e
  }
}
