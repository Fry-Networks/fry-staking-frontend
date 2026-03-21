import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { TransactionSigner } from 'algosdk';
import { voiWalletService, VoiWalletService } from '../services/VoiWalletService';
import { useChain } from './ChainContext';

interface VoiWalletContextValue {
  address: string | null;
  isConnected: boolean;
  isKibisisAvailable: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransactions: (txns: Uint8Array[]) => Promise<Uint8Array[]>;
  signer: TransactionSigner;
}

const VoiWalletContext = createContext<VoiWalletContextValue | undefined>(undefined);

export const VoiWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const { chainId } = useChain();

  const connect = useCallback(async () => {
    const addr = await voiWalletService.connect(chainId);
    setAddress(addr);
  }, [chainId]);

  const disconnect = useCallback(() => {
    voiWalletService.disconnect();
    setAddress(null);
  }, []);

  const signTransactions = useCallback(async (txns: Uint8Array[]) => {
    return voiWalletService.signTransactions(txns);
  }, []);

  const signer = useMemo(() => voiWalletService.getSigner(), []);

  const isKibisisAvailable = useMemo(() => VoiWalletService.isAvailable(), []);

  const value = useMemo<VoiWalletContextValue>(() => ({
    address,
    isConnected: address !== null,
    isKibisisAvailable,
    connect,
    disconnect,
    signTransactions,
    signer,
  }), [address, isKibisisAvailable, connect, disconnect, signTransactions, signer]);

  return <VoiWalletContext.Provider value={value}>{children}</VoiWalletContext.Provider>;
};

export const useVoiWallet = (): VoiWalletContextValue => {
  const context = useContext(VoiWalletContext);
  if (!context) throw new Error('useVoiWallet must be used within a VoiWalletProvider');
  return context;
};
