import algosdk, { TransactionSigner } from 'algosdk';
import { getAlgodClient } from '../staking_func';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
const TOKEN_KEY = 'fry_auth_token';
const EXPIRY_KEY = 'fry_auth_expiry';

class AuthService {
  private pendingAuth: Promise<string> | null = null;

  getToken(): string | null {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const expiry = sessionStorage.getItem(EXPIRY_KEY);
    if (!token || !expiry) return null;
    // 60-second buffer before expiry
    if (Date.now() >= Number(expiry) - 60_000) {
      this.clearAuth();
      return null;
    }
    return token;
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  clearAuth(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRY_KEY);
    this.pendingAuth = null;
  }

  async authenticate(
    activeAddress: string,
    signer: TransactionSigner,
  ): Promise<string> {
    // Return existing token if still valid
    const existing = this.getToken();
    if (existing) return existing;

    // Coalesce concurrent auth attempts
    if (this.pendingAuth) return this.pendingAuth;

    this.pendingAuth = this._doAuth(activeAddress, signer);
    try {
      const token = await this.pendingAuth;
      return token;
    } finally {
      this.pendingAuth = null;
    }
  }

  private async _doAuth(
    activeAddress: string,
    signer: TransactionSigner,
  ): Promise<string> {
    // Step 1: Get nonce from backend
    const nonceRes = await fetch(`${API_BASE}/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: activeAddress }),
    });

    if (!nonceRes.ok) {
      const err = await nonceRes.json().catch(() => ({}));
      throw new Error(err.message || `Auth nonce request failed (${nonceRes.status})`);
    }

    const { nonce } = await nonceRes.json();

    // Step 2: Build a zero-ALGO self-payment transaction with nonce in note
    const algodClient = await getAlgodClient();
    const params = await algodClient.getTransactionParams().do();
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      from: activeAddress,
      to: activeAddress,
      amount: 0,
      note: new TextEncoder().encode(`fry-auth:${nonce}`),
      suggestedParams: params,
    });

    // Step 3: Sign using the wallet's transaction signer
    const signedTxns = await signer([txn], [0]);
    const signedTxnBytes = signedTxns[0];

    // Step 4: Base64-encode the signed transaction
    let signedTxnBase64: string;
    if (typeof Buffer !== 'undefined') {
      signedTxnBase64 = Buffer.from(signedTxnBytes).toString('base64');
    } else {
      let binary = '';
      for (let i = 0; i < signedTxnBytes.length; i++) {
        binary += String.fromCharCode(signedTxnBytes[i]);
      }
      signedTxnBase64 = btoa(binary);
    }

    // Step 5: Verify signed transaction with backend and get JWT
    const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: activeAddress,
        signedTxn: signedTxnBase64,
        nonce,
      }),
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({}));
      throw new Error(err.message || `Auth verify failed (${verifyRes.status})`);
    }

    const { token } = await verifyRes.json();

    // Step 6: Store token with 24h expiry
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + 24 * 60 * 60 * 1000));

    return token;
  }
}

// Singleton export
export const authService = new AuthService();
