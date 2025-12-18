import { FolksRouterClient } from './FolksRouterClient';
import { VestigeLabsClient, VestigeSwapQuote, VestigeSwapParams } from './VestigeLabsClient';
import { Network, SwapMode, SwapParams, SwapQuote } from './types';
import algosdk, { Algodv2, decodeUnsignedTransaction } from 'algosdk';
import { Buffer } from 'buffer';
import { debugSwapParams } from '../utils/debugSwap';

export interface SwapServiceConfig {
  network: Network;
  algodClient: Algodv2;
  walletSignTransactions: (txns: Uint8Array[]) => Promise<Uint8Array[]>;
}

export interface SwapResult {
  success: boolean;
  txId?: string;
  error?: string;
  provider: 'folksrouter' | 'vestige';
  quote?: SwapQuote | VestigeSwapQuote;
}

export class SwapService {
  private folksRouterClient: FolksRouterClient;
  private vestigeClient: VestigeLabsClient;
  private algodClient: Algodv2;
  private walletSignTransactions: (txns: Uint8Array[]) => Promise<Uint8Array[]>;

  constructor(config: SwapServiceConfig) {
    this.folksRouterClient = new FolksRouterClient(config.network);
    this.vestigeClient = new VestigeLabsClient(config.network === Network.MAINNET ? 'mainnet' : 'testnet');
    this.algodClient = config.algodClient;
    this.walletSignTransactions = config.walletSignTransactions;
  }

  /**
   * Perform swap with automatic fallback from FolksRouter to Vestige Labs
   */
  async performSwap(
    fromAssetId: number | string,
    toAssetId: number | string,
    amount: number,
    userAddress: string,
    slippageBps: number = 10
  ): Promise<SwapResult> {
    // Ensure asset IDs are numbers
    const numericFromAssetId = typeof fromAssetId === 'string' ? parseInt(fromAssetId, 10) : fromAssetId;
    const numericToAssetId = typeof toAssetId === 'string' ? parseInt(toAssetId, 10) : toAssetId;
    try {
      // First, try FolksRouter
      const folksResult = await this.tryFolksRouterSwap(
        numericFromAssetId,
        numericToAssetId,
        amount,
        userAddress,
        slippageBps
      );
      
      if (folksResult.success) {
        return folksResult;
      }

      console.log('FolksRouter failed, trying Vestige Labs...');

      // Fallback to Vestige Labs
      const vestigeResult = await this.tryVestigeSwap(
        numericFromAssetId,
        numericToAssetId,
        amount,
        userAddress
      );

      return vestigeResult;
    } catch (error) {
      console.error('Swap failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        provider: 'folksrouter'
      };
    }
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

      // Debug swap parameters
      debugSwapParams(fromAssetId, toAssetId, amount);
      
      const quote = await this.folksRouterClient.fetchSwapQuote(swapParams, 16, 10);
      if (!quote) {
        throw new Error('Quote not available from FolksRouter');
      }
      
      console.log('✅ FolksRouter quote received:', {
        quoteAmount: quote.quoteAmount.toString(),
        priceImpact: quote.priceImpact,
        microalgoTxnsFee: quote.microalgoTxnsFee
      });

      // Prepare transactions
      console.log('🔧 Preparing FolksRouter transactions...');
      const base64Txns = await this.folksRouterClient.prepareSwapTransactions(
        swapParams,
        userAddress,
        BigInt(slippageBps),
        quote
      );
      
      console.log('✅ FolksRouter transactions prepared:', base64Txns.length, 'transactions');

      // Decode and sign transactions
      const decodedTxns = base64Txns.map((b64: string) => 
        new Uint8Array(Buffer.from(b64, 'base64'))
      );
      const signedTxns = await this.walletSignTransactions(decodedTxns);

      // Submit transaction
      const result = await this.algodClient.sendRawTransaction(signedTxns).do();

      return {
        success: true,
        txId: result.txId,
        provider: 'folksrouter',
        quote
      };
    } catch (error) {
      console.error('FolksRouter swap failed:', error);
      
      // Provide more helpful error messages
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
   * Try swap using Vestige Labs API
   */
  private async tryVestigeSwap(
    fromAssetId: number,
    toAssetId: number,
    amount: number,
    userAddress: string
  ): Promise<SwapResult> {
    try {
      // Check if Vestige supports this asset pair
      const isSupported = await this.vestigeClient.isAssetPairSupported(fromAssetId, toAssetId);
      if (!isSupported) {
        throw new Error('Asset pair not supported by Vestige Labs');
      }

      // Get quote from Vestige
      const vestigeParams: VestigeSwapParams = {
        from_asa: fromAssetId,
        to_asa: toAssetId,
        amount: amount,
        mode: 'sef',
        denominating_asset_id: 31566704 // USDC as default
      };

      const quote = await this.vestigeClient.fetchSwapQuote(vestigeParams);
      
      // For now, Vestige Labs only provides quotes, not transaction preparation
      // This is a limitation of the current Vestige Labs API
      // We'll return a helpful error message directing users to use FolksRouter
      
      return {
        success: false,
        error: `Vestige Labs quote available: ${quote.amount_out} tokens (${quote.price_impact * 100}% price impact).`,
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
   * Get quote from both providers and compare
   */
  async compareQuotes(
    fromAssetId: number | string,
    toAssetId: number | string,
    amount: number
  ): Promise<{
    folksRouter?: SwapQuote;
    vestige?: VestigeSwapQuote;
    bestProvider?: 'folksrouter' | 'vestige';
  }> {
    // Ensure asset IDs are numbers
    const numericFromAssetId = typeof fromAssetId === 'string' ? parseInt(fromAssetId, 10) : fromAssetId;
    const numericToAssetId = typeof toAssetId === 'string' ? parseInt(toAssetId, 10) : toAssetId;
    
    const results: any = {};

    try {
      // Try FolksRouter quote
      const swapParams: SwapParams = {
        fromAssetId: numericFromAssetId,
        toAssetId: numericToAssetId,
        amount: BigInt(amount),
        swapMode: SwapMode.FIXED_INPUT,
      };
      results.folksRouter = await this.folksRouterClient.fetchSwapQuote(swapParams, 16, 10);
    } catch (error) {
      console.log('FolksRouter quote failed:', error instanceof Error ? error.message : 'Unknown error');
    }

    try {
      // Try Vestige quote
      const vestigeParams: VestigeSwapParams = {
        from_asa: numericFromAssetId,
        to_asa: numericToAssetId,
        amount: amount,
        mode: 'sef',
        denominating_asset_id: 31566704
      };
      results.vestige = await this.vestigeClient.fetchSwapQuote(vestigeParams);
    } catch (error) {
      console.log('Vestige quote failed:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Determine best provider based on output amount
    if (results.folksRouter && results.vestige) {
      const folksOutput = Number(results.folksRouter.quoteAmount);
      const vestigeOutput = results.vestige.amount_out;
      results.bestProvider = vestigeOutput > folksOutput ? 'vestige' : 'folksrouter';
    } else if (results.folksRouter) {
      results.bestProvider = 'folksrouter';
    } else if (results.vestige) {
      results.bestProvider = 'vestige';
    }

    return results;
  }

  /**
   * Check which providers support the given asset pair
   */
  async getSupportedProviders(fromAssetId: number | string, toAssetId: number | string): Promise<{
    folksRouter: boolean;
    vestige: boolean;
  }> {
    // Ensure asset IDs are numbers
    const numericFromAssetId = typeof fromAssetId === 'string' ? parseInt(fromAssetId, 10) : fromAssetId;
    const numericToAssetId = typeof toAssetId === 'string' ? parseInt(toAssetId, 10) : toAssetId;
    
    const results = {
      folksRouter: false,
      vestige: false
    };

    // Check FolksRouter support
    try {
      const swapParams: SwapParams = {
        fromAssetId: numericFromAssetId,
        toAssetId: numericToAssetId,
        amount: BigInt(1000), // Small test amount
        swapMode: SwapMode.FIXED_INPUT,
      };
      await this.folksRouterClient.fetchSwapQuote(swapParams, 16, 10);
      results.folksRouter = true;
    } catch (error) {
      console.log('FolksRouter does not support this pair');
    }

    // Check Vestige support
    try {
      results.vestige = await this.vestigeClient.isAssetPairSupported(numericFromAssetId, numericToAssetId);
    } catch (error) {
      console.log('Vestige does not support this pair');
    }

    return results;
  }
}

export default SwapService;
