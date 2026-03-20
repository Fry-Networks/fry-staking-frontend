import { ChainConfig } from './types';

/**
 * Voi Mainnet configuration
 * Voi is AVM-compatible — same algosdk, different endpoints and asset IDs.
 * Contract IDs, FRY token, and fee recipient are null until deployed (later prompts).
 */
export const voiMainnet: ChainConfig = {
  chainId: 'voi-mainnet',
  displayName: 'Voi',
  family: 'avm',
  nativeAsset: {
    name: 'Voi',
    symbol: 'VOI',
    decimals: 6,
    id: 0,
  },
  fryTokenId: null,
  usdcEquivalent: null,
  feeRecipient: null,
  explorerBaseUrl: 'https://explorer.voi.network',
  availableDexProviders: ['nomadex'],
  supportedWallets: ['kibisis', 'lute'],
  connection: {
    algodServer: import.meta.env.VITE_VOI_ALGOD_SERVER || 'https://mainnet-api.voi.nodely.dev',
    algodPort: Number(import.meta.env.VITE_VOI_ALGOD_PORT) || 443,
    algodToken: import.meta.env.VITE_VOI_ALGOD_TOKEN || '',
    indexerServer: import.meta.env.VITE_VOI_INDEXER_SERVER || 'https://mainnet-idx.voi.nodely.dev',
    indexerPort: Number(import.meta.env.VITE_VOI_INDEXER_PORT) || 443,
    indexerToken: import.meta.env.VITE_VOI_INDEXER_TOKEN || '',
  },
  features: {
    staking: false,
    farming: false,
    nftStaking: false,
    deviceStaking: false,
    swap: false,
    predictionLp: false,
    communityEvents: false,
    zap: false,
  },
};
