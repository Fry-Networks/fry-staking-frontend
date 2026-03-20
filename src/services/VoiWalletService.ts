import { AVMWebClient, ARC0027MethodEnum } from '@agoralabs-sh/avm-web-provider';
import algosdk, { TransactionSigner } from 'algosdk';

/**
 * Lightweight Kibisis wallet service for Voi network.
 * Uses ARC-0027 protocol via @agoralabs-sh/avm-web-provider.
 */

const VOI_GENESIS_HASH = 'IXnoWtviVVJW5LGivNFc0Dq14V3kqaXuK2u5OQrdVZo=';

export class VoiWalletService {
  private client: ReturnType<typeof AVMWebClient.init> | null = null;
  private address: string | null = null;

  private getClient() {
    if (!this.client) {
      this.client = AVMWebClient.init();
    }
    return this.client;
  }

  /**
   * Connect to Kibisis wallet extension.
   * Returns the connected address.
   */
  async connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = this.getClient();

      client.onEnable(({ error, result }) => {
        if (error) {
          reject(new Error(error.message || 'Failed to connect to Kibisis'));
          return;
        }
        if (result?.accounts && result.accounts.length > 0) {
          this.address = result.accounts[0].address;
          resolve(this.address);
        } else {
          reject(new Error('No accounts returned from Kibisis'));
        }
      });

      client.enable({ genesisHash: VOI_GENESIS_HASH });
    });
  }

  /** Disconnect from Kibisis */
  disconnect(): void {
    this.address = null;
    // AVMWebClient doesn't have a persistent session to clear —
    // just nulling the address is sufficient
  }

  /** Get connected address or null */
  getAddress(): string | null {
    return this.address;
  }

  /** Check if connected */
  isConnected(): boolean {
    return this.address !== null;
  }

  /**
   * Sign transactions via Kibisis.
   * Accepts unsigned transaction bytes, returns signed transaction bytes.
   */
  async signTransactions(txns: Uint8Array[]): Promise<Uint8Array[]> {
    return new Promise((resolve, reject) => {
      const client = this.getClient();

      client.onSignTransactions(({ error, result }) => {
        if (error) {
          reject(new Error(error.message || 'Transaction signing failed'));
          return;
        }
        if (result?.stxns) {
          const signedTxns = result.stxns.map((stxn: string | null) => {
            if (!stxn) throw new Error('Null signed transaction returned');
            return new Uint8Array(Buffer.from(stxn, 'base64'));
          });
          resolve(signedTxns);
        } else {
          reject(new Error('No signed transactions returned'));
        }
      });

      // Convert unsigned txns to base64 for ARC-0027
      const txnsBase64 = txns.map((txn) => {
        // Check if this is already an encoded transaction object or raw bytes
        return Buffer.from(txn).toString('base64');
      });

      client.signTransactions({ txns: txnsBase64.map(txn => ({ txn })) });
    });
  }

  /**
   * Get an algosdk TransactionSigner compatible with existing contract functions.
   */
  getSigner(): TransactionSigner {
    return async (txnGroup: algosdk.Transaction[], indexesToSign: number[]): Promise<Uint8Array[]> => {
      const encodedTxns = txnGroup.map((txn) => algosdk.encodeUnsignedTransaction(txn));
      const txnsToSign = indexesToSign.map((i) => encodedTxns[i]);
      const signedTxns = await this.signTransactions(txnsToSign);

      // Reconstruct full array with nulls for unsigned txns
      const result: Uint8Array[] = new Array(txnGroup.length).fill(new Uint8Array());
      indexesToSign.forEach((idx, i) => {
        result[idx] = signedTxns[i];
      });
      return result;
    };
  }

  /**
   * Check if Kibisis extension is available in the browser.
   * Kibisis injects the AVM provider — we check by attempting discovery.
   */
  static isAvailable(): boolean {
    // Kibisis uses the ARC-0027 message protocol via BroadcastChannel,
    // which is always available. We can't synchronously detect the extension.
    // Instead, we attempt connection and handle errors gracefully.
    return typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined';
  }
}

/** Singleton instance */
export const voiWalletService = new VoiWalletService();
