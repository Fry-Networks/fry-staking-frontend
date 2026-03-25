import { NomadexClient, NomadexSwapQuote } from './nomadex';
import { Algodv2 } from 'algosdk';
import { Buffer } from 'buffer';
import { VoiSwapProvider } from './types';

export interface VoiSwapServiceConfig {
  algodClient: Algodv2;
  walletSignTransactions: (txns: Uint8Array[]) => Promise<Uint8Array[]>;
}

export interface VoiSwapResult {
  success: boolean;
  txId?: string;
  error?: string;
  provider: VoiSwapProvider;
  quote?: NomadexSwapQuote;
}

export class VoiSwapService {
  private nomadexClient: NomadexClient;
  private algodClient: Algodv2;
  private walletSignTransactions: (txns: Uint8Array[]) => Promise<Uint8Array[]>;

  constructor(config: VoiSwapServiceConfig) {
    this.nomadexClient = new NomadexClient();
    this.algodClient = config.algodClient;
    this.walletSignTransactions = config.walletSignTransactions;
  }

  getNomadexClient(): NomadexClient {
    return this.nomadexClient;
  }

  /**
   * Get a swap quote from Nomadex (client-side AMM calculation).
   */
  async getQuote(
    fromTokenId: number,
    toTokenId: number,
    amount: bigint,
    slippageBps: number = 50
  ): Promise<NomadexSwapQuote> {
    return this.nomadexClient.fetchSwapQuote(fromTokenId, toTokenId, amount, slippageBps);
  }

  /**
   * Full swap flow: quote → build txns → sign → submit.
   */
  async performSwap(
    fromTokenId: number,
    toTokenId: number,
    amount: bigint,
    userAddress: string,
    slippageBps: number = 50
  ): Promise<VoiSwapResult> {
    try {
      const quote = await this.nomadexClient.fetchSwapQuote(
        fromTokenId, toTokenId, amount, slippageBps
      );

      return await this.executeSwap(quote, userAddress);
    } catch (error) {
      console.error('Nomadex swap failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Nomadex swap failed',
        provider: 'nomadex',
      };
    }
  }

  /**
   * Execute swap with a pre-fetched quote (single wallet popup).
   */
  async performSwapWithQuote(
    quote: NomadexSwapQuote,
    userAddress: string
  ): Promise<VoiSwapResult> {
    try {
      return await this.executeSwap(quote, userAddress);
    } catch (error) {
      console.error('Nomadex swap failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Nomadex swap failed',
        provider: 'nomadex',
      };
    }
  }

  private async executeSwap(
    quote: NomadexSwapQuote,
    userAddress: string
  ): Promise<VoiSwapResult> {
    // Build unsigned transactions
    const base64Txns = await this.nomadexClient.prepareSwapTransactions(
      quote, userAddress, this.algodClient
    );

    // Decode to Uint8Array for wallet signing
    const unsignedTxns = base64Txns.map(
      (b64) => new Uint8Array(Buffer.from(b64, 'base64'))
    );

    // Sign with wallet
    const signedTxns = await this.walletSignTransactions(unsignedTxns);

    // Submit to Voi algod
    const result = await this.algodClient.sendRawTransaction(signedTxns).do();

    return {
      success: true,
      txId: result.txId,
      provider: 'nomadex',
      quote,
    };
  }

  /**
   * Check if a token pair is supported.
   */
  async isAssetPairSupported(fromTokenId: number, toTokenId: number): Promise<boolean> {
    return this.nomadexClient.isAssetPairSupported(fromTokenId, toTokenId);
  }
}

export default VoiSwapService;
