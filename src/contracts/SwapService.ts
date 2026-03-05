import { FolksRouterClient } from './FolksRouterClient';
import { VestigeLabsClient, VestigeSwapQuote, VestigeSwapParams } from './VestigeLabsClient';
import { DeflexClient, DeflexQuote, DeflexTransactionGroup } from './DeflexClient';
import { Network, SwapMode, SwapParams, SwapQuote } from './types';
import algosdk, { Algodv2, decodeUnsignedTransaction } from 'algosdk';
import { Buffer } from 'buffer';
import { debugSwapParams } from '../utils/debugSwap';

export interface SwapServiceConfig {
  network: Network;
  algodClient: Algodv2;
  walletSignTransactions: (txns: Uint8Array[]) => Promise<Uint8Array[]>;
}

export type SwapProvider = 'folksrouter' | 'vestige' | 'deflex';

export interface SwapResult {
  success: boolean;
  txId?: string;
  error?: string;
  provider: SwapProvider;
  quote?: SwapQuote | VestigeSwapQuote | DeflexQuote;
}

export class SwapService {
  private folksRouterClient: FolksRouterClient;
  private vestigeClient: VestigeLabsClient;
  private deflexClient: DeflexClient;
  private algodClient: Algodv2;
  private walletSignTransactions: (txns: Uint8Array[]) => Promise<Uint8Array[]>;

  constructor(config: SwapServiceConfig) {
    this.folksRouterClient = new FolksRouterClient(config.network);
    this.vestigeClient = new VestigeLabsClient(config.network === Network.MAINNET ? 'mainnet' : 'testnet');

    this.deflexClient = new DeflexClient();

    this.algodClient = config.algodClient;
    this.walletSignTransactions = config.walletSignTransactions;
  }

  /**
   * Perform swap with cascading fallback: FolksRouter → Vestige → Deflex
   */
  async performSwap(
    fromAssetId: number | string,
    toAssetId: number | string,
    amount: number,
    userAddress: string,
    slippageBps: number = 10
  ): Promise<SwapResult> {
    const numericFromAssetId = typeof fromAssetId === 'string' ? parseInt(fromAssetId, 10) : fromAssetId;
    const numericToAssetId = typeof toAssetId === 'string' ? parseInt(toAssetId, 10) : toAssetId;
    const errors: string[] = [];

    // Try FolksRouter
    try {
      const result = await this.tryFolksRouterSwap(
        numericFromAssetId, numericToAssetId, amount, userAddress, slippageBps
      );
      if (result.success) return result;
      errors.push(`FolksRouter: ${result.error}`);
    } catch (e) {
      errors.push(`FolksRouter: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    console.log('FolksRouter failed, trying Vestige Labs...');

    // Try Vestige
    try {
      const result = await this.tryVestigeSwap(
        numericFromAssetId, numericToAssetId, amount, userAddress, slippageBps
      );
      if (result.success) return result;
      errors.push(`Vestige: ${result.error}`);
    } catch (e) {
      errors.push(`Vestige: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    console.log('Vestige failed, trying Deflex...');

    // Try Deflex
    try {
      const result = await this.tryDeflexSwap(
        numericFromAssetId, numericToAssetId, amount, userAddress, slippageBps
      );
      if (result.success) return result;
      errors.push(`Deflex: ${result.error}`);
    } catch (e) {
      errors.push(`Deflex: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    return {
      success: false,
      error: errors.join('; '),
      provider: 'folksrouter'
    };
  }

  /**
   * Try swap using FolksRouter
   */
  private async tryFolksRouterSwap(
    fromAssetId: number,
    toAssetId: number,
    amount: number,
    userAddress: string,
    slippageBps: number
  ): Promise<SwapResult> {
    try {
      const swapParams: SwapParams = {
        fromAssetId,
        toAssetId,
        amount: BigInt(amount),
        swapMode: SwapMode.FIXED_INPUT,
      };

      debugSwapParams(fromAssetId, toAssetId, amount);

      const quote = await this.folksRouterClient.fetchSwapQuote(swapParams, 16, 10);
      if (!quote) {
        throw new Error('Quote not available from FolksRouter');
      }

      const base64Txns = await this.folksRouterClient.prepareSwapTransactions(
        swapParams, userAddress, BigInt(slippageBps), quote
      );

      const decodedTxns = base64Txns.map((b64: string) =>
        new Uint8Array(Buffer.from(b64, 'base64'))
      );
      const signedTxns = await this.walletSignTransactions(decodedTxns);
      const result = await this.algodClient.sendRawTransaction(signedTxns).do();

      return {
        success: true,
        txId: result.txId,
        provider: 'folksrouter',
        quote
      };
    } catch (error) {
      console.error('FolksRouter swap failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'FolksRouter swap failed';
      let finalErrorMessage = errorMessage;

      if (errorMessage.includes('missing from')) {
        finalErrorMessage = 'Asset not found in wallet. Please ensure you have opted into the source asset.';
      } else if (errorMessage.includes('insufficient')) {
        finalErrorMessage = 'Insufficient balance for this swap.';
      } else if (errorMessage.includes('400')) {
        finalErrorMessage = 'Transaction rejected. Please check your asset balances and try again.';
      }

      return {
        success: false,
        error: finalErrorMessage,
        provider: 'folksrouter'
      };
    }
  }

  /**
   * Try swap using Vestige Labs API — now with full execution support
   */
  private async tryVestigeSwap(
    fromAssetId: number,
    toAssetId: number,
    amount: number,
    userAddress: string,
    slippageBps: number = 10
  ): Promise<SwapResult> {
    try {
      // Get quote from Vestige
      const vestigeParams: VestigeSwapParams = {
        from_asa: fromAssetId,
        to_asa: toAssetId,
        amount: amount,
        mode: 'sef',
        denominating_asset_id: 31566704
      };

      const quote = await this.vestigeClient.fetchSwapQuote(vestigeParams);

      // Get unsigned transactions from Vestige
      const slippage = slippageBps / 10000; // Convert bps to decimal (e.g. 10 → 0.001)
      const txnResponses = await this.vestigeClient.prepareSwapTransactions(
        quote, userAddress, slippage
      );

      // Decode base64 transactions to Uint8Array[]
      const unsignedTxns = txnResponses.map(t =>
        new Uint8Array(Buffer.from(t.txn, 'base64'))
      );

      // Sign with wallet
      const signedTxns = await this.walletSignTransactions(unsignedTxns);

      // Submit to algod
      const result = await this.algodClient.sendRawTransaction(signedTxns).do();

      return {
        success: true,
        txId: result.txId,
        provider: 'vestige',
        quote
      };
    } catch (error) {
      console.error('Vestige swap failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Vestige Labs swap failed',
        provider: 'vestige'
      };
    }
  }

  /**
   * Try swap using Deflex SDK
   */
  private async tryDeflexSwap(
    fromAssetId: number,
    toAssetId: number,
    amount: number,
    userAddress: string,
    slippageBps: number = 10
  ): Promise<SwapResult> {
    try {
      const quote = await this.deflexClient.fetchSwapQuote(fromAssetId, toAssetId, amount);
      const txnGroup = await this.deflexClient.prepareSwapTransactions(
        userAddress, quote, slippageBps
      );

      // Decode all transactions from base64
      const unsignedTxns = txnGroup.txns.map(t =>
        new Uint8Array(Buffer.from(t.data, 'base64'))
      );

      // Sign transactions (wallet signs all, then we merge lsig blobs)
      const signedTxns = await this.walletSignTransactions(unsignedTxns);

      // Merge: use pre-signed lsig blob where available, otherwise use wallet-signed txn
      const finalTxns = txnGroup.txns.map((t, i) =>
        t.hasLogicSig && t.logicSigBlob
          ? new Uint8Array(Buffer.from(t.logicSigBlob, 'base64'))
          : signedTxns[i]
      );

      const result = await this.algodClient.sendRawTransaction(finalTxns).do();

      return {
        success: true,
        txId: result.txId,
        provider: 'deflex',
        quote
      };
    } catch (error) {
      console.error('Deflex swap failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deflex swap failed',
        provider: 'deflex'
      };
    }
  }

  /**
   * Get quotes from all providers in parallel and compare
   */
  async compareQuotes(
    fromAssetId: number | string,
    toAssetId: number | string,
    amount: number
  ): Promise<{
    folksRouter?: SwapQuote;
    vestige?: VestigeSwapQuote;
    deflex?: DeflexQuote;
    bestProvider?: SwapProvider;
  }> {
    const numericFromAssetId = typeof fromAssetId === 'string' ? parseInt(fromAssetId, 10) : fromAssetId;
    const numericToAssetId = typeof toAssetId === 'string' ? parseInt(toAssetId, 10) : toAssetId;

    const results: {
      folksRouter?: SwapQuote;
      vestige?: VestigeSwapQuote;
      deflex?: DeflexQuote;
      bestProvider?: SwapProvider;
    } = {};

    // Fetch all quotes in parallel
    const [folksResult, vestigeResult, deflexResult] = await Promise.allSettled([
      // FolksRouter quote
      (async () => {
        const swapParams: SwapParams = {
          fromAssetId: numericFromAssetId,
          toAssetId: numericToAssetId,
          amount: BigInt(amount),
          swapMode: SwapMode.FIXED_INPUT,
        };
        return this.folksRouterClient.fetchSwapQuote(swapParams, 16, 10);
      })(),
      // Vestige quote
      (async () => {
        const vestigeParams: VestigeSwapParams = {
          from_asa: numericFromAssetId,
          to_asa: numericToAssetId,
          amount: amount,
          mode: 'sef',
          denominating_asset_id: 31566704,
        };
        return this.vestigeClient.fetchSwapQuote(vestigeParams);
      })(),
      // Deflex quote
      this.deflexClient.fetchSwapQuote(numericFromAssetId, numericToAssetId, amount),
    ]);

    if (folksResult.status === 'fulfilled') {
      results.folksRouter = folksResult.value;
    } else {
      console.log('FolksRouter quote failed:', folksResult.reason?.message || 'Unknown error');
    }

    if (vestigeResult.status === 'fulfilled') {
      results.vestige = vestigeResult.value;
    } else {
      console.log('Vestige quote failed:', vestigeResult.reason?.message || 'Unknown error');
    }

    if (deflexResult.status === 'fulfilled') {
      results.deflex = deflexResult.value;
    } else {
      console.log('Deflex quote failed:', deflexResult.reason?.message || 'Unknown error');
    }

    // Determine best provider based on output amount
    const outputs: { provider: SwapProvider; amount: number }[] = [];

    if (results.folksRouter) {
      outputs.push({ provider: 'folksrouter', amount: Number(results.folksRouter.quoteAmount) });
    }
    if (results.vestige) {
      outputs.push({ provider: 'vestige', amount: results.vestige.amount_out });
    }
    if (results.deflex) {
      outputs.push({ provider: 'deflex', amount: Number(results.deflex.quote || 0) });
    }

    if (outputs.length > 0) {
      outputs.sort((a, b) => b.amount - a.amount);
      results.bestProvider = outputs[0].provider;
    }

    return results;
  }

  /**
   * Check which providers support the given asset pair
   */
  async getSupportedProviders(fromAssetId: number | string, toAssetId: number | string): Promise<{
    folksRouter: boolean;
    vestige: boolean;
    deflex: boolean;
  }> {
    const numericFromAssetId = typeof fromAssetId === 'string' ? parseInt(fromAssetId, 10) : fromAssetId;
    const numericToAssetId = typeof toAssetId === 'string' ? parseInt(toAssetId, 10) : toAssetId;

    const results = {
      folksRouter: false,
      vestige: false,
      deflex: false,
    };

    const [folksResult, vestigeResult, deflexResult] = await Promise.allSettled([
      (async () => {
        const swapParams: SwapParams = {
          fromAssetId: numericFromAssetId,
          toAssetId: numericToAssetId,
          amount: BigInt(1000),
          swapMode: SwapMode.FIXED_INPUT,
        };
        await this.folksRouterClient.fetchSwapQuote(swapParams, 16, 10);
        return true;
      })(),
      this.vestigeClient.isAssetPairSupported(numericFromAssetId, numericToAssetId),
      this.deflexClient.fetchSwapQuote(numericFromAssetId, numericToAssetId, 1000).then(() => true),
    ]);

    if (folksResult.status === 'fulfilled') results.folksRouter = folksResult.value;
    if (vestigeResult.status === 'fulfilled') results.vestige = vestigeResult.value;
    if (deflexResult.status === 'fulfilled') results.deflex = true;

    return results;
  }
}

export default SwapService;
