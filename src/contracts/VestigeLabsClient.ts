import axios, { AxiosInstance } from 'axios';

// Vestige Labs API Response Types
export interface VestigeSwapQuote {
  mode: string;
  amount: number;
  asset_in: number;
  asset_in_price: number;
  asset_out: number;
  asset_out_price: number;
  asset_images: Record<string, string>;
  amount_out: number;
  network_fee: number;
  price_impact: number;
  combo: {
    asset_in: number;
    asset_out: number;
    amount_in: number;
    amount_out: number;
    network_fee: number;
    transactions: VestigeTransaction[];
  };
  single: {
    asset_in: number;
    asset_out: number;
    amount_in: number;
    amount_out: number;
    network_fee: number;
    transactions: VestigeTransaction[];
  };
}

export interface VestigeTransaction {
  asset_in: number;
  asset_out: number;
  amount_in: number;
  amount_out: number;
  network_fee: number;
  swaps: VestigeSwap[];
}

export interface VestigeSwap {
  provider: string;
  bps: number;
  application_id: number;
  amount_in: number;
  amount_out: number;
  fee: number;
  network_fee: number;
}

export interface VestigeSwapParams {
  from_asa: number;
  to_asa: number;
  amount: number;
  mode?: 'sef' | 'single';
  denominating_asset_id?: number;
}

export class VestigeLabsClient {
  private readonly api: AxiosInstance;
  private readonly baseUrl: string;

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.baseUrl = 'https://api.vestigelabs.org';
    this.api = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch swap quote from Vestige Labs API
   */
  async fetchSwapQuote(params: VestigeSwapParams): Promise<VestigeSwapQuote> {
    try {
      const response = await this.api.get('/swap/v4', {
        params: {
          from_asa: params.from_asa,
          to_asa: params.to_asa,
          amount: params.amount,
          mode: params.mode || 'sef',
          denominating_asset_id: params.denominating_asset_id || 31566704, // USDC as default
        },
      });

      if (!response.data) {
        throw new Error('No data received from Vestige Labs API');
      }

      return response.data;
    } catch (error) {
      console.error('Vestige Labs API error:', error);
      throw new Error(`Failed to fetch swap quote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if Vestige Labs supports the asset pair
   */
  async isAssetPairSupported(fromAssetId: number, toAssetId: number): Promise<boolean> {
    try {
      // Try with a small amount to check if the pair is supported
      const testAmount = 1000; // Small test amount
      await this.fetchSwapQuote({
        from_asa: fromAssetId,
        to_asa: toAssetId,
        amount: testAmount,
      });
      return true;
    } catch (error) {
      console.log(`Asset pair ${fromAssetId} -> ${toAssetId} not supported by Vestige Labs`);
      return false;
    }
  }

  /**
   * Get supported assets from Vestige Labs
   * Note: This would need to be implemented based on Vestige Labs API documentation
   */
  async getSupportedAssets(): Promise<number[]> {
    // This would need to be implemented based on Vestige Labs API
    // For now, return common assets
    return [
      0, // ALGO
      31566704, // USDC
      2160577481, // Example asset from the API response
      2485314946, // Example asset from the API response
    ];
  }
}

export default VestigeLabsClient;
