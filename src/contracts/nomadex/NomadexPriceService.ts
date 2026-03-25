import axios from 'axios';
import { loadMarketData, findPool, findToken } from './api';

const VOI_ID = 0;
const WVOI_ID = 390001;
const AUSDC_ID = 395614;
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

const priceCache = new Map<string, { price: number; timestamp: number }>();

function getCachedPrice(key: string): number | null {
  const entry = priceCache.get(key);
  if (entry && Date.now() - entry.timestamp < PRICE_CACHE_TTL_MS) return entry.price;
  return null;
}

function setCachedPrice(key: string, price: number): void {
  priceCache.set(key, { price, timestamp: Date.now() });
}

/**
 * Fetch VOI/USD price.
 * No VOI/aUSDC pool exists on Nomadex — use CoinGecko as primary source.
 */
export async function fetchVoiUsd(): Promise<number> {
  const cached = getCachedPrice('voi-usd');
  if (cached !== null) return cached;

  // Primary: CoinGecko
  try {
    const r = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: 'voi-network', vs_currencies: 'usd' },
      timeout: 8000,
    });
    const price = r.data?.['voi-network']?.usd;
    if (price && price > 0) { setCachedPrice('voi-usd', price); return price; }
  } catch { /* fallback */ }

  // Fallback: CoinPaprika
  try {
    const r = await axios.get('https://api.coinpaprika.com/v1/tickers/voi-voi-network', { timeout: 8000 });
    const price = r.data?.quotes?.USD?.price;
    if (price && price > 0) { setCachedPrice('voi-usd', price); return price; }
  } catch { /* fallback */ }

  // Fallback: Derive from Nomadex pool if VOI/aUSDC pool ever appears
  try {
    await loadMarketData();
    const pool = findPool(VOI_ID, AUSDC_ID);
    if (pool) {
      const isVoiAlpha = pool.alphaId === VOI_ID;
      const voiReserve = BigInt(isVoiAlpha ? pool.balances[0] : pool.balances[1]);
      const usdcReserve = BigInt(isVoiAlpha ? pool.balances[1] : pool.balances[0]);
      if (voiReserve > 0n) {
        const usdcToken = findToken(AUSDC_ID);
        const usdcDecimals = usdcToken?.decimals ?? 6;
        const price = (Number(usdcReserve) / 10 ** usdcDecimals) / (Number(voiReserve) / 1e6);
        if (price > 0) { setCachedPrice('voi-usd', price); return price; }
      }
    }
  } catch { /* ignore */ }

  return 0;
}

/**
 * Get USD price for any Voi-chain token.
 * Strategy:
 *   1. VOI or wVOI → fetchVoiUsd()
 *   2. TOKEN/VOI pool → price_in_voi * voiUsd
 *   3. TOKEN/aUSDC pool → direct USD
 *   4. Return 0
 */
export async function getVoiTokenUsdPrice(tokenId: number): Promise<number> {
  if (tokenId === VOI_ID || tokenId === WVOI_ID) return fetchVoiUsd();

  const cached = getCachedPrice(`voi-token-${tokenId}`);
  if (cached !== null) return cached;

  await loadMarketData();

  // Strategy 1: TOKEN/VOI pool
  const voiPool = findPool(tokenId, VOI_ID);
  if (voiPool) {
    const isTokenAlpha = voiPool.alphaId === tokenId;
    const tokenReserve = BigInt(isTokenAlpha ? voiPool.balances[0] : voiPool.balances[1]);
    const voiReserve = BigInt(isTokenAlpha ? voiPool.balances[1] : voiPool.balances[0]);

    if (tokenReserve > 0n && voiReserve > 0n) {
      const token = findToken(tokenId);
      const tokenDecimals = token?.decimals ?? 6;
      const priceInVoi = (Number(voiReserve) / 1e6) / (Number(tokenReserve) / 10 ** tokenDecimals);
      const voiUsd = await fetchVoiUsd();
      const price = priceInVoi * voiUsd;
      if (price > 0) { setCachedPrice(`voi-token-${tokenId}`, price); return price; }
    }
  }

  // Strategy 2: TOKEN/aUSDC pool (direct USD price)
  const usdcPool = findPool(tokenId, AUSDC_ID);
  if (usdcPool) {
    const isTokenAlpha = usdcPool.alphaId === tokenId;
    const tokenReserve = BigInt(isTokenAlpha ? usdcPool.balances[0] : usdcPool.balances[1]);
    const usdcReserve = BigInt(isTokenAlpha ? usdcPool.balances[1] : usdcPool.balances[0]);

    if (tokenReserve > 0n && usdcReserve > 0n) {
      const token = findToken(tokenId);
      const tokenDecimals = token?.decimals ?? 6;
      const usdcToken = findToken(AUSDC_ID);
      const usdcDecimals = usdcToken?.decimals ?? 6;
      const price = (Number(usdcReserve) / 10 ** usdcDecimals) / (Number(tokenReserve) / 10 ** tokenDecimals);
      if (price > 0) { setCachedPrice(`voi-token-${tokenId}`, price); return price; }
    }
  }

  return 0;
}

/**
 * Batch-fetch USD prices for a list of Voi token IDs.
 * Mirrors PriceService.fetchPriceMap() interface.
 */
export async function fetchVoiPriceMap(tokenIds: number[]): Promise<Record<string, number>> {
  await loadMarketData();
  const unique = [...new Set(tokenIds)];
  const results = await Promise.allSettled(
    unique.map(async (id) => ({ id, price: await getVoiTokenUsdPrice(id) }))
  );
  const priceMap: Record<string, number> = {};
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      priceMap[result.value.id.toString()] = result.value.price;
    }
  });
  return priceMap;
}
