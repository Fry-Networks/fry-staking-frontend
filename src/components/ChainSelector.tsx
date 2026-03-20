import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { useChain } from '../context/ChainContext';
import { getChainIcon, getChainColor } from './ChainIcons';
import { ChainId } from '../config/chains';

const ChainSelector: React.FC = () => {
  const { activeChain, chainId, availableChains, switchChain } = useChain();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (newChainId: ChainId) => {
    switchChain(newChainId);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
      >
        {getChainIcon(chainId, 16)}
        <span className="text-sm font-medium hidden sm:inline">{activeChain.displayName}</span>
        <Icon
          icon={isOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'}
          width={16}
          height={16}
          style={{ color: 'var(--text-secondary)' }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg z-50 overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
          }}
        >
          {availableChains.map((chain) => {
            const isActive = chain.chainId === chainId;
            return (
              <button
                key={chain.chainId}
                onClick={() => handleSelect(chain.chainId)}
                className="flex items-center gap-3 w-full px-4 py-3 text-left transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--bg-card-hover)' : 'transparent',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {getChainIcon(chain.chainId, 18)}
                <div className="flex-1">
                  <div className="text-sm font-medium">{chain.displayName}</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {chain.nativeAsset.symbol}
                  </div>
                </div>
                {isActive && (
                  <Icon icon="mdi:check" width={18} style={{ color: getChainColor(chain.chainId) }} />
                )}
                {!isActive && !Object.values(chain.features).some(Boolean) && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: getChainColor(chain.chainId) + '20',
                      color: getChainColor(chain.chainId),
                    }}
                  >
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChainSelector;
