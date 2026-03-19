import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet'
import algosdk from 'algosdk'

const FRY_ASA_ID = Number(import.meta.env.VITE_FRY_TOKEN_ID) || 2485314946
const ADMIN_WALLET = 'E2F2LT2INE75DBOYHQXTCTOP2PAP5MHAXQRXTTCCXFKHQTVG36DJONBQZE'
const ALGOD_SERVER = import.meta.env.VITE_ALGOD_SERVER || 'https://mainnet-api.algonode.cloud'

const useAiPayment = () => {
  const { activeAddress, signer } = useWallet()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const payForAnalysis = async (fryAmount: number): Promise<string | null> => {
    if (!activeAddress || !signer) {
      setError('Wallet not connected')
      return null
    }

    setIsProcessing(true)
    setError(null)

    try {
      const algod = new algosdk.Algodv2('', ALGOD_SERVER, '')
      const params = await algod.getTransactionParams().do()

      const microAmount = fryAmount * 1_000_000

      const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: activeAddress,
        to: ADMIN_WALLET,
        assetIndex: FRY_ASA_ID,
        amount: microAmount,
        suggestedParams: params,
      })

      const signedTxns: any = await signer([txn], [0])
      const { txId } = await algod.sendRawTransaction(signedTxns).do()
      await algosdk.waitForConfirmation(algod, txId, 4)

      return txId
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('CANCELLED') || msg.includes('rejected')) {
        setError('Transaction cancelled')
      } else if (msg.includes('balance') && msg.includes('below min')) {
        setError('Insufficient FRY balance')
      } else {
        setError(msg || 'Payment failed')
      }
      return null
    } finally {
      setIsProcessing(false)
    }
  }

  return { payForAnalysis, isProcessing, error }
}

export default useAiPayment
