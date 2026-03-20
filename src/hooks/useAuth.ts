import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { authService } from '../services/AuthService';
import { useMultiChainWallet } from './useMultiChainWallet';

export function useAuth() {
  const { activeAddress, signer, chainId } = useMultiChainWallet();
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated());
  const [isAdmin, setIsAdmin] = useState(authService.isAdmin());

  // Clear auth only on genuine wallet change (same chain), not on chain switch
  const prevAddressRef = useRef(activeAddress);
  const prevChainRef = useRef(chainId);
  useEffect(() => {
    const chainChanged = prevChainRef.current !== chainId;
    prevChainRef.current = chainId;

    if (prevAddressRef.current !== activeAddress) {
      // Only clear auth if address changed on the SAME chain (genuine wallet switch).
      // When chain switches, activeAddress changes (null↔address) but the session is still valid.
      if (prevAddressRef.current !== undefined && !chainChanged) {
        authService.clearAuth();
        setIsAuthenticated(false);
        setIsAdmin(false);
      }
      prevAddressRef.current = activeAddress;
    }
  }, [activeAddress, chainId]);

  // Auto-authenticate when wallet connects (address + signer both ready)
  // First checks if existing session cookie is still valid to avoid unnecessary signature popup
  useEffect(() => {
    if (activeAddress && signer && !isAuthenticated) {
      authService.checkSession(activeAddress)
        .then(async (session) => {
          if (session.authenticated) {
            setIsAuthenticated(true);
            setIsAdmin(session.isAdmin);
          } else {
            await authService.authenticate(activeAddress, signer, chainId);
            setIsAuthenticated(true);
            setIsAdmin(authService.isAdmin());
          }
        })
        .catch(() => {}); // Silent — user will auth on-demand via ensureAuth
    }
  }, [activeAddress, signer, isAuthenticated, chainId]);

  const ensureAuth = useCallback(async (): Promise<void> => {
    if (!activeAddress) {
      throw new Error('Please connect your wallet first.');
    }

    try {
      await authService.authenticate(activeAddress, signer!, chainId);
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
  }, [activeAddress, signer, chainId]);

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
