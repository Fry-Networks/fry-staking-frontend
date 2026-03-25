import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import algosdk, { TransactionSigner } from 'algosdk';
import LuteConnect from 'lute-connect';
import { voiWalletService, VoiWalletService } from '../services/VoiWalletService';
import { useChain } from './ChainContext';

type VoiWalletProviderType = 'kibisis' | 'lute' | null;

const VOI_WALLET_STORAGE_KEY = 'voi-wallet-connection';

interface VoiWalletContextValue {
  address: string | null;
  isConnected: boolean;
  isKibisisAvailable: boolean;
  connect: () => Promise<void>;
  connectLute: () => Promise<void>;
  disconnect: () => void;
  signTransactions: (txns: Uint8Array[]) => Promise<Uint8Array[]>;
  signer: TransactionSigner;
}

const VoiWalletContext = createContext<VoiWalletContextValue | undefined>(undefined);

export const VoiWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<VoiWalletProviderType>(null);
  const luteRef = useRef<LuteConnect | null>(null);
  const restoringRef = useRef(false);
  const { chainId } = useChain();

  // Persist connection to localStorage
  const saveConnection = useCallback((addr: string, provider: VoiWalletProviderType) => {
    try {
      localStorage.setItem(VOI_WALLET_STORAGE_KEY, JSON.stringify({ address: addr, provider }));
    } catch {
      // localStorage may not be available
    }
  }, []);

  const clearConnection = useCallback(() => {
    try {
      localStorage.removeItem(VOI_WALLET_STORAGE_KEY);
    } catch {
      // localStorage may not be available
    }
  }, []);

  // Restore connection on mount
  useEffect(() => {
    const restore = async () => {
      if (restoringRef.current) return;
      restoringRef.current = true;

      try {
        const stored = localStorage.getItem(VOI_WALLET_STORAGE_KEY);
        if (!stored) return;

        const { address: storedAddr, provider } = JSON.parse(stored) as {
          address: string;
          provider: VoiWalletProviderType;
        };
        if (!storedAddr || !provider) return;

        if (provider === 'kibisis') {
          const addr = await voiWalletService.connect('voi-mainnet');
          setAddress(addr);
          setActiveProvider('kibisis');
        } else if (provider === 'lute') {
          const lute = new LuteConnect('Fry Farm');
          const addresses = await lute.connect('voimain-v1.0');
          if (addresses.length > 0) {
            luteRef.current = lute;
            setAddress(addresses[0]);
            setActiveProvider('lute');
          } else {
            clearConnection();
          }
        }
      } catch {
        clearConnection();
      }
    };
    restore();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Kibisis connect
  const connect = useCallback(async () => {
    const addr = await voiWalletService.connect(chainId);
    setAddress(addr);
    setActiveProvider('kibisis');
    saveConnection(addr, 'kibisis');
  }, [chainId, saveConnection]);

  // Lute connect
  const connectLute = useCallback(async () => {
    const lute = new LuteConnect('Fry Farm');
    const addresses = await lute.connect('voimain-v1.0');
    if (addresses.length > 0) {
      luteRef.current = lute;
      setAddress(addresses[0]);
      setActiveProvider('lute');
      saveConnection(addresses[0], 'lute');
    } else {
      throw new Error('No accounts returned from Lute');
    }
  }, [saveConnection]);

  const disconnect = useCallback(() => {
    voiWalletService.disconnect();
    luteRef.current = null;
    setAddress(null);
    setActiveProvider(null);
    clearConnection();
  }, [clearConnection]);

  const signTransactions = useCallback(async (txns: Uint8Array[]) => {
    if (activeProvider === 'lute' && luteRef.current) {
      // Lute expects WalletTransaction[] with base64-encoded txns
      const walletTxns = txns.map((txn) => ({
        txn: Buffer.from(txn).toString('base64'),
      }));
      const signed = await luteRef.current.signTxns(walletTxns);
      return signed.map((s) => {
        if (!s) throw new Error('Null signed transaction from Lute');
        return s;
      });
    }
    return voiWalletService.signTransactions(txns);
  }, [activeProvider]);

  const signer = useMemo((): TransactionSigner => {
    return async (txnGroup: algosdk.Transaction[], indexesToSign: number[]): Promise<Uint8Array[]> => {
      const encodedTxns = txnGroup.map((txn) => algosdk.encodeUnsignedTransaction(txn));
      const txnsToSign = indexesToSign.map((i) => encodedTxns[i]);
      const signedTxns = await signTransactions(txnsToSign);
      const result: Uint8Array[] = new Array(txnGroup.length).fill(new Uint8Array());
      indexesToSign.forEach((idx, i) => {
        result[idx] = signedTxns[i];
      });
      return result;
    };
  }, [signTransactions]);

  const isKibisisAvailable = useMemo(() => VoiWalletService.isAvailable(), []);

  const value = useMemo<VoiWalletContextValue>(() => ({
    address,
    isConnected: address !== null,
    isKibisisAvailable,
    connect,
    connectLute,
    disconnect,
    signTransactions,
    signer,
  }), [address, isKibisisAvailable, connect, connectLute, disconnect, signTransactions, signer]);

  return <VoiWalletContext.Provider value={value}>{children}</VoiWalletContext.Provider>;
};

export const useVoiWallet = (): VoiWalletContextValue => {
  const context = useContext(VoiWalletContext);
  if (!context) throw new Error('useVoiWallet must be used within a VoiWalletProvider');
  return context;
};
