import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@txnlab/use-wallet';
import { toast } from 'react-toastify';
import { authService } from '../services/AuthService';

export function useAuth() {
  const { activeAddress, signer } = useWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [isAdmin, setIsAdmin] = useState(authService.isAdmin());

  // Sync state from the initial checkAuth (fired in App.tsx)
  useEffect(() => {
    authService.checkAuth().then(() => {
      setIsAuthenticated(authService.isAuthenticated());
      setIsAdmin(authService.isAdmin());
    });
  }, []);

  // Clear auth only when wallet actually changes, not on every mount
  const prevAddressRef = useRef(activeAddress);
  useEffect(() => {
    if (prevAddressRef.current !== activeAddress) {
      authService.clearAuth();
      setIsAuthenticated(false);
      setIsAdmin(false);
      prevAddressRef.current = activeAddress;
    }
  }, [activeAddress]);

  // Auto-authenticate when wallet connects (address + signer both ready)
  useEffect(() => {
    if (activeAddress && signer && !isAuthenticated) {
      authService.authenticate(activeAddress, signer)
        .then(() => {
          setIsAuthenticated(true);
          setIsAdmin(authService.isAdmin());
        })
        .catch(() => {}); // Silent — user will auth on-demand via ensureAuth
    }
  }, [activeAddress, signer, isAuthenticated]);

  const ensureAuth = useCallback(async (): Promise<void> => {
    if (!activeAddress) {
      throw new Error('Please connect your wallet first.');
    }

    try {
      await authService.authenticate(activeAddress, signer);
      setIsAuthenticated(true);
      setIsAdmin(authService.isAdmin());
    } catch (err: any) {
      setIsAuthenticated(false);
      setIsAdmin(false);
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
    setIsAdmin(false);
  }, []);

  return {
    ensureAuth,
    isAuthenticated,
    isAdmin,
    clearAuth,
  };
}
