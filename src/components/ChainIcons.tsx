import React from 'react';
import { ChainId } from '../config/chains';

const CHAIN_COLORS: Record<ChainId, string> = {
  'algorand-mainnet': '#00C2FF',
  'voi-mainnet': '#8B5CF6',
};

export const AlgorandIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="7" fill="#00C2FF" />
    <text x="8" y="11.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">A</text>
  </svg>
);

export const VoiIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="7" fill="#8B5CF6" />
    <text x="8" y="11.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">V</text>
  </svg>
);

export function getChainIcon(chainId: ChainId, size = 16): React.ReactNode {
  switch (chainId) {
    case 'algorand-mainnet': return <AlgorandIcon size={size} />;
    case 'voi-mainnet': return <VoiIcon size={size} />;
    default: return <AlgorandIcon size={size} />;
  }
}

export function getChainColor(chainId: ChainId): string {
  return CHAIN_COLORS[chainId] || '#00C2FF';
}
