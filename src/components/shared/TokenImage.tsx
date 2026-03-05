import React, { useEffect, useState } from 'react';

const PLACEHOLDER_COLORS = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#8B5CF6', '#EF4444', '#14B8A6',
];

function colorFromId(tokenId: number): string {
  return PLACEHOLDER_COLORS[Math.abs(tokenId) % PLACEHOLDER_COLORS.length];
}

interface TokenImageProps {
  tokenId: number;
  src?: string;
  symbol?: string;
  size?: number;
  className?: string;
}

const TokenImage: React.FC<TokenImageProps> = ({ tokenId, src, symbol, size = 40, className = '' }) => {
  const [fallbackStage, setFallbackStage] = useState(0);
  // 0 = original src, 1 = Tinyman CDN, 2 = colored circle

  const tinymanUrl = `https://asa-list.tinyman.org/assets/${tokenId}/icon.png`;

  // Reset fallback when props change (prevents stale state when reused for different tokens)
  useEffect(() => {
    setFallbackStage(0);
  }, [src, tokenId]);

  const handleError = () => {
    setFallbackStage((prev) => prev + 1);
  };

  const sources: string[] = [];
  if (src) sources.push(src);
  sources.push(tinymanUrl);
  const currentSrc = fallbackStage < sources.length ? sources[fallbackStage] : null;

  if (!currentSrc) {
    const letter = (symbol || '?')[0].toUpperCase();
    const bg = colorFromId(tokenId);
    return (
      <div
        className={`rounded-full flex items-center justify-center text-white font-bold ${className}`}
        style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.4 }}
      >
        {letter}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={symbol || `Token ${tokenId}`}
      className={`rounded-full ${className}`}
      style={{ width: size, height: size }}
      loading="lazy"
      onError={handleError}
    />
  );
};

export default TokenImage;
