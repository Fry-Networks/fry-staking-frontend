import axios from 'axios'
import type { NftAsset, NftMetadata, NftStakingPool } from '../types/nftStaking'

const INDEXER_URL = 'https://mainnet-idx.4160.nodely.dev'
const PERA_API = 'https://mainnet.api.perawallet.app'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// In-memory cache
const nftCache = new Map<string, { data: any; timestamp: number }>()
const metadataCache = new Map<number, { data: NftMetadata; timestamp: number }>()

function getCached<T>(cache: Map<any, { data: T; timestamp: number }>, key: any): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) return entry.data
  return null
}

/**
 * Fetch all NFTs (pure collectibles: decimals=0, total=1) owned by a wallet.
 */
export async function getUserNfts(wallet: string): Promise<NftAsset[]> {
  const cacheKey = `user-nfts-${wallet}`
  const cached = getCached(nftCache, cacheKey)
  if (cached) return cached as NftAsset[]

  const nfts: NftAsset[] = []
  let nextToken: string | undefined

  do {
    const params: any = { limit: 100 }
    if (nextToken) params.next = nextToken

    const res = await axios.get(`${INDEXER_URL}/v2/accounts/${wallet}/assets`, {
      params,
      timeout: 15000,
    })

    const assets = res.data?.assets ?? []
    for (const a of assets) {
      if (a.amount > 0 && a['asset-id']) {
        // Fetch asset params to check if it's an NFT (total=1, decimals=0)
        try {
          const assetRes = await axios.get(`${INDEXER_URL}/v2/assets/${a['asset-id']}`, { timeout: 10000 })
          const params = assetRes.data?.asset?.params
          if (params && params.total === 1 && params.decimals === 0) {
            nfts.push({
              asaId: a['asset-id'],
              name: params.name || `Asset #${a['asset-id']}`,
              unitName: params['unit-name'] || '',
              creator: params.creator || '',
              total: params.total,
              decimals: params.decimals,
              url: params.url || '',
              imageUrl: '',
            })
          }
        } catch {
          // Skip assets we can't fetch
        }
      }
    }

    nextToken = res.data?.['next-token']
  } while (nextToken)

  nftCache.set(cacheKey, { data: nfts, timestamp: Date.now() })
  return nfts
}

/**
 * Filter NFTs eligible for a given pool based on collection mode.
 * collectionMode: 0 = creator_address, 1 = whitelist, 2 = both (either condition)
 */
export function filterEligibleNfts(nfts: NftAsset[], pool: NftStakingPool): NftAsset[] {
  return nfts.filter((nft) => {
    const matchesCreator = pool.collectionCreator && nft.creator === pool.collectionCreator
    const matchesWhitelist = pool.whitelistedAsaIds?.includes(nft.asaId)

    switch (pool.collectionMode) {
      case 0: // creator_address
        return matchesCreator
      case 1: // whitelist
        return matchesWhitelist
      case 2: // both (either condition)
        return matchesCreator || matchesWhitelist
      default:
        return false
    }
  })
}

/**
 * Fetch NFT metadata from Pera API (name, image, traits).
 */
export async function getNftMetadata(asaId: number): Promise<NftMetadata> {
  const cached = getCached(metadataCache, asaId)
  if (cached) return cached

  try {
    const res = await axios.get(`${PERA_API}/v1/public/assets/${asaId}/?include_collectible=true`, {
      timeout: 10000,
    })

    const asset = res.data
    const collectible = asset?.collectible

    const metadata: NftMetadata = {
      asaId,
      name: asset?.name || `Asset #${asaId}`,
      imageUrl:
        collectible?.primary_image ||
        collectible?.media?.[0]?.url ||
        asset?.logo ||
        `https://asa-list.tinyman.org/assets/${asaId}/icon.png`,
      traits: collectible?.traits || [],
    }

    metadataCache.set(asaId, { data: metadata, timestamp: Date.now() })
    return metadata
  } catch {
    return {
      asaId,
      name: `Asset #${asaId}`,
      imageUrl: `https://asa-list.tinyman.org/assets/${asaId}/icon.png`,
      traits: [],
    }
  }
}

/**
 * Batch fetch NFT metadata with concurrency limit.
 */
export async function batchGetNftMetadata(asaIds: number[], concurrency = 5): Promise<NftMetadata[]> {
  const results: NftMetadata[] = []
  const queue = [...asaIds]

  const worker = async () => {
    while (queue.length > 0) {
      const id = queue.shift()
      if (id !== undefined) {
        const meta = await getNftMetadata(id)
        results.push(meta)
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker())
  await Promise.all(workers)

  return results
}
