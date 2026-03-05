import algosdk, { TransactionSigner } from 'algosdk';
import { getAlgodClient } from '../staking_func';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

class AuthService {
  private pendingAuth: Promise<void> | null = null;
  private _authenticated = false;
  private _wallet: string | null = null;

  isAuthenticated(): boolean {
    return this._authenticated;
  }

  getWallet(): string | null {
    return this._wallet;
  }

  clearAuth(): void {
    this._authenticated = false;
    this._wallet = null;
    this.pendingAuth = null;
    // Tell backend to clear the HttpOnly cookie
    fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  }

  /**
   * Check if a valid auth cookie exists (on page load / tab restore).
   */
  async checkAuth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
      const data = await res.json();
      this._authenticated = data.authenticated === true;
      this._wallet = data.wallet || null;
      return this._authenticated;
    } catch {
      this._authenticated = false;
      this._wallet = null;
      return false;
    }
  }

  async authenticate(
    activeAddress: string,
    signer: TransactionSigner,
  ): Promise<void> {
    if (this._authenticated && this._wallet === activeAddress) return;

    // Coalesce concurrent auth attempts
    if (this.pendingAuth) return this.pendingAuth;

    this.pendingAuth = this._doAuth(activeAddress, signer);
    try {
      await this.pendingAuth;
    } finally {
      this.pendingAuth = null;
    }
  }

  private async _doAuth(
    activeAddress: string,
    signer: TransactionSigner,
  ): Promise<void> {
    // Step 1: Get nonce from backend
    const nonceRes = await fetch(`${API_BASE}/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet: activeAddress }),
      credentials: 'include',
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

    // Step 5: Verify signed transaction with backend — JWT set as HttpOnly cookie
    const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: activeAddress,
        signedTxn: signedTxnBase64,
        nonce,
      }),
      credentials: 'include',
    });

    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({}));
      throw new Error(err.message || `Auth verify failed (${verifyRes.status})`);
    }

    this._authenticated = true;
    this._wallet = activeAddress;
  }
}

// Singleton export
export const authService = new AuthService();
