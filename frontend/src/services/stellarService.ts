import * as StellarSdk from '@stellar/stellar-sdk';

const NETWORK_PASSPHRASE = process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon-testnet.stellar.org';

let kitInstance: any = null;

async function hashMessageHex(message: string): Promise<string> {
  const bytes = new TextEncoder().encode(message);
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', data);
  const digestBytes = Array.from(new Uint8Array(digest));
  return digestBytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function buildAuthChallengeXdr(message: string, publicKey: string): Promise<string> {
  const messageHashHex = await hashMessageHex(message); // 64 ASCII chars, fits manageData value limit.
  const source = new StellarSdk.Account(publicKey, '0');
  const tx = new StellarSdk.TransactionBuilder(source, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.manageData({
        name: 'auth',
        value: messageHashHex,
      })
    )
    .setTimeout(0)
    .build();

  return tx.toXDR();
}

async function getKit() {
  if (typeof window === 'undefined') return null;
  if (kitInstance) return kitInstance;

  const { StellarWalletsKit, Networks } = await import('@creit.tech/stellar-wallets-kit');
  const { FreighterModule } = await import('@creit.tech/stellar-wallets-kit/modules/freighter');
  const { xBullModule } = await import('@creit.tech/stellar-wallets-kit/modules/xbull');
  const { RabetModule } = await import('@creit.tech/stellar-wallets-kit/modules/rabet');
  const { AlbedoModule } = await import('@creit.tech/stellar-wallets-kit/modules/albedo');
  const { LobstrModule } = await import('@creit.tech/stellar-wallets-kit/modules/lobstr');
  const { HanaModule } = await import('@creit.tech/stellar-wallets-kit/modules/hana');

  StellarWalletsKit.init({
    network: NETWORK_PASSPHRASE.includes('Public') ? Networks.PUBLIC : Networks.TESTNET,
    modules: [
      new FreighterModule(),
      new xBullModule(),
      new RabetModule(),
      new AlbedoModule(),
      new LobstrModule(),
      new HanaModule(),
    ],
  });

  kitInstance = { StellarWalletsKit };
  return kitInstance;
}

export const stellarService = {
  async connectWallet(): Promise<string> {
    const kit = await getKit();
    if (!kit) throw new Error('Wallet kit not available on server');

    try {
      // Some wallet-kit versions throw when no wallet is connected yet.
      // Open auth modal first, then fallback to getAddress if needed.
      try {
        const result = await kit.StellarWalletsKit.authModal();
        if (result?.address) {
          console.log('[wallet] authModal selected address:', result.address);
          return result.address;
        }
      } catch (modalError: any) {
        const message = String(modalError?.message || '');
        const isUserCancelled =
          message.toLowerCase().includes('cancel') ||
          message.toLowerCase().includes('closed');
        if (isUserCancelled) {
          throw new Error('Wallet connection was cancelled');
        }
      }

      const { address } = await kit.StellarWalletsKit.getAddress();
      if (!address) throw new Error('No wallet address returned by provider');
      console.log('[wallet] getAddress returned:', address);
      return address;
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      throw new Error(error.message || 'Failed to connect wallet');
    }
  },

  async signAuthMessage(message: string, publicKey: string): Promise<string> {
    const kit = await getKit();
    if (!kit) throw new Error('Wallet kit not available on server');
    
    try {
      // Use transaction-based challenge for all wallets to avoid provider-specific signMessage
      // payload mismatches (e.g. detached signatures with different pre-hash rules).
      console.log('[auth] signing transaction challenge', { publicKey, messageLength: message.length });
      const challengeXdr = await buildAuthChallengeXdr(message, publicKey);
      const { signedTxXdr } = await kit.StellarWalletsKit.signTransaction(challengeXdr, {
        address: publicKey,
      });

      if (!signedTxXdr) throw new Error('Failed to sign auth challenge transaction');
      console.log('[auth] signTransaction challenge success', { signedTxXdrLength: signedTxXdr.length });
      return `xdr:${signedTxXdr}`;
    } catch (error: any) {
      console.error('Signing error:', error);
      throw new Error(error.message || 'Failed to sign auth message');
    }
  },

  async signTransaction(xdr: string, publicKey: string): Promise<string> {
    const kit = await getKit();
    if (!kit) throw new Error('Wallet kit not available on server');

    const { signedTxXdr } = await kit.StellarWalletsKit.signTransaction(xdr, {
      address: publicKey,
    });

    if (!signedTxXdr) throw new Error('Failed to sign transaction');
    return signedTxXdr;
  },

  async disconnectWallet(): Promise<void> {
    if (typeof window === 'undefined') return;
    const kit = await getKit();
    if (!kit) return;

    try {
      // Wallet-kit exposes disconnect for clearing active session/module state.
      await kit.StellarWalletsKit.disconnect();
    } catch (error) {
      // Do not block local logout if wallet-side disconnect fails.
      console.warn('Wallet disconnect warning:', error);
    }
  },

  getServer() {
    return new StellarSdk.Horizon.Server(HORIZON_URL);
  },

  getNetworkPassphrase() {
    return NETWORK_PASSPHRASE;
  }
};
