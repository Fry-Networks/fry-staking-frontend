import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@txnlab/use-wallet';
import { toast } from 'react-toastify';
import { authService } from '../services/AuthService';

export function useAuth() {
  const { activeAddress, signer } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());

  // Clear auth only when wallet actually changes, not on every mount
  const prevAddressRef = useRef(activeAddress);
  useEffect(() => {
    if (prevAddressRef.current !== activeAddress) {
      authService.clearAuth();
      setIsAuthenticated(false);
      prevAddressRef.current = activeAddress;
    }
  }, [activeAddress]);

  const ensureAuth = useCallback(async (): Promise<string> => {
    if (!activeAddress) {
      throw new Error('Please connect your wallet first.');
    }

    try {
      const token = await authService.authenticate(activeAddress, signer);
      setIsAuthenticated(true);
      return token;
    } catch (err: any) {
      setIsAuthenticated(false);
      if (err.message?.includes('cancelled') || err.message?.includes('CANCELLED')) {
        toast.error('Sign-in was cancelled. Please approve the signature to continue.');
        throw err;
      }
      toast.error(err.message || 'Authentication failed. Please try again.');
      throw err;
    }
  }, [activeAddress, signer]);

  const clearAuth = useCallback(() => {
    authService.clearAuth();
    setIsAuthenticated(false);
  }, []);

  return {
    ensureAuth,
    isAuthenticated,
    clearAuth,
  };
}
