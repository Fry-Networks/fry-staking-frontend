import axios from 'axios';

/**
 * Global axios interceptor that adds X-Chain-Id header to ALL axios requests.
 * Reads from localStorage to match ChainContext's persistence.
 * Call once at app startup (before any API calls).
 */
export function setupChainIdInterceptor(): void {
  axios.interceptors.request.use((config) => {
    try {
      const chainId = localStorage.getItem('fry-farm-chain-id') || 'algorand-mainnet';
      config.headers['X-Chain-Id'] = chainId;
    } catch {
      config.headers['X-Chain-Id'] = 'algorand-mainnet';
    }
    return config;
  });
}
