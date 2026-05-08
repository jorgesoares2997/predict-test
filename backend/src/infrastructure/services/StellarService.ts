import { IStellarService } from '../../application/ports';
import * as StellarSdk from '@stellar/stellar-sdk';
import nacl from 'tweetnacl';
import { createHash } from 'crypto';

export class StellarService implements IStellarService {
  private server: StellarSdk.Horizon.Server;
  private sorobanServer: StellarSdk.rpc.Server;
  private networkPassphrase: string;
  private marketContractId: string;
  private usdcContractAddress: string;
  private operatorPublicKey: string;
  private operatorSecretKey: string;

  constructor(horizonUrl: string, networkPassphrase: string) {
    this.server = new StellarSdk.Horizon.Server(horizonUrl);
    this.sorobanServer = new StellarSdk.rpc.Server(
      process.env.STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'
    );
    this.networkPassphrase = networkPassphrase;
    this.marketContractId =
      process.env.MARKET_CONTRACT_ADDRESS ||
      process.env.MARKET_CONTRACT_ID ||
      process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID ||
      '';
    this.usdcContractAddress = process.env.USDC_CONTRACT_ADDRESS || '';
    this.operatorPublicKey = process.env.OPERATOR_PUBLIC_KEY || '';
    this.operatorSecretKey = process.env.OPERATOR_SECRET_KEY || '';
  }

  private ensureContractEnv() {
    if (!this.marketContractId) {
      throw new Error(
        'Missing contract id in backend env. Set MARKET_CONTRACT_ADDRESS (preferred) or MARKET_CONTRACT_ID.'
      );
    }
  }

  private marketIdToBytes32(marketId: string): Buffer {
    const cleanUuid = marketId.replace(/-/g, '').toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(cleanUuid)) {
      throw new Error('Invalid market id format. Expected UUID');
    }
    const marketIdBuffer = Buffer.from(cleanUuid, 'hex'); // 16 bytes
    const bytes32 = Buffer.alloc(32);
    marketIdBuffer.copy(bytes32);
    return bytes32;
  }

  private isContractErrorCode(error: unknown, code: number): boolean {
    const text = String((error as any)?.message || error || '');
    return text.includes(`Error(Contract, #${code})`);
  }

  private async waitForRpcTransaction(hash: string, maxAttempts = 20, delayMs = 500): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const tx = await this.sorobanServer.getTransaction(hash);
      const status = String((tx as any)?.status || '');
      if (status === 'SUCCESS') return;
      if (status === 'FAILED') {
        throw new Error(`Soroban transaction failed: ${JSON.stringify((tx as any)?.resultXdr || tx)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error('Timed out waiting for Soroban transaction confirmation');
  }

  verifySignature(publicKey: string, signature: string, message: string): boolean {
    if ((signature || '').startsWith('xdr:')) {
      console.log('[verifySignature] using xdr path');
      return this.verifySignedChallengeXdr(publicKey, signature.slice(4), message);
    }

    try {
      const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);
      const signatureBuffer = this.decodeSignature(signature);
      if (!signatureBuffer) {
        console.log('[verifySignature] could not decode signature buffer');
        return false;
      }
      const messageBuffer = Buffer.from(message);
      const publicKeyRaw = keypair.rawPublicKey();

      // Path 1: detached signature (64 bytes)
      if (signatureBuffer.length === nacl.sign.signatureLength) {
        const valid = nacl.sign.detached.verify(messageBuffer, signatureBuffer, publicKeyRaw);
        console.log('[verifySignature] detached path', { signatureLength: signatureBuffer.length, valid });
        return valid;
      }

      // Path 2: attached signature payload (signature + message bytes)
      // Some wallet integrations return nacl.sign output instead of detached signature.
      if (signatureBuffer.length > nacl.sign.signatureLength) {
        const opened = nacl.sign.open(signatureBuffer, publicKeyRaw);
        if (!opened) return false;
        const valid = Buffer.compare(Buffer.from(opened), messageBuffer) === 0;
        console.log('[verifySignature] attached path', { signatureLength: signatureBuffer.length, valid });
        return valid;
      }

      console.log('[verifySignature] unsupported signature length', { signatureLength: signatureBuffer.length });
      return false;
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }

  private verifySignedChallengeXdr(publicKey: string, signedXdr: string, message: string): boolean {
    try {
      const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
      if (tx instanceof StellarSdk.FeeBumpTransaction) {
        console.log('[verifySignedChallengeXdr] fee bump tx not supported');
        return false;
      }
      const sourceAccount = tx.source;
      if (sourceAccount !== publicKey) {
        console.log('[verifySignedChallengeXdr] source mismatch', { sourceAccount, publicKey });
        return false;
      }

      const expectedHashHex = createHash('sha256').update(message).digest('hex');

      const hasExpectedAuthOp = tx.operations.some((operation) => {
        if (operation.type !== 'manageData') return false;
        const op = operation as StellarSdk.Operation.ManageData;
        const raw = op.value as string | Buffer | Uint8Array | null | undefined;
        const value =
          raw == null
            ? ''
            : typeof raw === 'string'
              ? raw
              : Buffer.from(raw as Uint8Array).toString('utf8');
        return op.name === 'auth' && value === expectedHashHex;
      });

      if (!hasExpectedAuthOp) {
        console.log('[verifySignedChallengeXdr] challenge op mismatch', { expectedHashHex });
        return false;
      }

      const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);
      const payload = tx.hash();
      const decorated = tx.signatures;
      if (!decorated?.length) {
        console.log('[verifySignedChallengeXdr] missing signatures');
        return false;
      }

      // Same as Transaction#addSignature / Keypair#verify: signatures are over tx.hash().
      const valid = decorated.some((ds) => {
        const sigBuf = Buffer.from(ds.signature());
        return keypair.verify(payload, sigBuf);
      });

      console.log('[verifySignedChallengeXdr] crypto verify', {
        signaturesCount: decorated.length,
        valid,
      });
      return valid;
    } catch (error) {
      console.error('Error verifying signed challenge XDR:', error);
      return false;
    }
  }

  private decodeSignature(signature: string): Buffer | null {
    const raw = (signature || '').trim();
    if (!raw) return null;

    // 1) Hex (optionally 0x-prefixed)
    const hex = raw.startsWith('0x') ? raw.slice(2) : raw;
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
      const fromHex = Buffer.from(hex, 'hex');
      if (fromHex.length === nacl.sign.signatureLength) return fromHex;
    }

    // 2) Base64 / base64url (common wallet format for message signatures)
    try {
      const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      const fromB64 = Buffer.from(padded, 'base64');
      if (fromB64.length === nacl.sign.signatureLength) return fromB64;
    } catch {
      // noop
    }

    // 3) Raw UTF-8 payload (fallback for odd wallet responses)
    try {
      const fromUtf8 = Buffer.from(raw, 'utf8');
      if (fromUtf8.length >= nacl.sign.signatureLength) return fromUtf8;
    } catch {
      // noop
    }

    return null;
  }

  async verifyTransactionOnChain(txHash: string): Promise<boolean> {
    try {
      const tx = await this.server.transactions().transaction(txHash).call();
      return tx.successful;
    } catch (error) {
      console.error('Error verifying transaction on chain:', error);
      return false;
    }
  }

  async registerMarketContract(input: {
    marketId: string;
    outcomesCount: number;
    closingDate: Date;
    liquidateAt: Date;
  }): Promise<void> {
    this.ensureContractEnv();
    if (!this.operatorPublicKey || !this.operatorSecretKey || !this.usdcContractAddress) {
      console.warn('[registerMarketContract] missing operator/usdc env vars, skipping on-chain create_market');
      return;
    }

    const source = await this.sorobanServer.getAccount(this.operatorPublicKey);
    const contract = new StellarSdk.Contract(this.marketContractId);
    const op = contract.call(
      'create_market',
      StellarSdk.nativeToScVal(this.marketIdToBytes32(input.marketId)),
      new StellarSdk.Address(this.operatorPublicKey).toScVal(),
      new StellarSdk.Address(this.usdcContractAddress).toScVal(),
      StellarSdk.nativeToScVal(input.outcomesCount, { type: 'u32' }),
      StellarSdk.nativeToScVal(Math.floor(input.closingDate.getTime() / 1000), { type: 'u64' }),
      StellarSdk.nativeToScVal(Math.floor(input.liquidateAt.getTime() / 1000), { type: 'u64' })
    );

    const tx = new StellarSdk.TransactionBuilder(source, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();

    const prepared = await this.sorobanServer.prepareTransaction(tx);
    prepared.sign(StellarSdk.Keypair.fromSecret(this.operatorSecretKey));
    const submitted = await this.sorobanServer.sendTransaction(prepared);
    if (submitted.status === 'ERROR') {
      const msg = submitted.errorResult
        ? JSON.stringify(submitted.errorResult)
        : 'create_market submission failed';
      // Contract error #1 = MarketAlreadyExists, which is safe/idempotent for our backend flow.
      if (this.isContractErrorCode({ message: msg }, 1)) {
        return;
      }
      throw new Error(msg);
    }
    if (submitted.hash) {
      await this.waitForRpcTransaction(submitted.hash);
    }
  }

  async preparePlaceBetXdr(input: {
    userPublicKey: string;
    marketId: string;
    outcomeIndex: number;
    amountStroops: bigint;
  }): Promise<string> {
    this.ensureContractEnv();
    const source = await this.sorobanServer.getAccount(input.userPublicKey);
    const contract = new StellarSdk.Contract(this.marketContractId);
    const op = contract.call(
      'place_bet',
      new StellarSdk.Address(input.userPublicKey).toScVal(),
      StellarSdk.nativeToScVal(this.marketIdToBytes32(input.marketId)),
      StellarSdk.nativeToScVal(input.outcomeIndex, { type: 'u32' }),
      StellarSdk.nativeToScVal(input.amountStroops, { type: 'i128' })
    );

    const tx = new StellarSdk.TransactionBuilder(source, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();

    const prepared = await this.sorobanServer.prepareTransaction(tx);
    return prepared.toXDR();
  }

  async submitSignedContractTransaction(signedXdr: string): Promise<string> {
    const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
    if (tx instanceof StellarSdk.FeeBumpTransaction) {
      throw new Error('Fee bump transaction not supported');
    }
    const submitted = await this.sorobanServer.sendTransaction(tx);
    if (submitted.status === 'ERROR') {
      throw new Error(
        submitted.errorResult ? JSON.stringify(submitted.errorResult) : 'Contract transaction submission failed'
      );
    }
    if (!submitted.hash) throw new Error('Missing transaction hash from RPC');
    await this.waitForRpcTransaction(submitted.hash);
    return submitted.hash;
  }

  async settleMarketContract(marketId: string, winningOutcomeIndex: number): Promise<void> {
    this.ensureContractEnv();
    if (!this.operatorPublicKey || !this.operatorSecretKey) {
      console.warn('[settleMarketContract] missing operator env vars, skipping on-chain settlement');
      return;
    }

    const source = await this.sorobanServer.getAccount(this.operatorPublicKey);
    const contract = new StellarSdk.Contract(this.marketContractId);
    
    const op = contract.call(
      'settle_market',
      new StellarSdk.Address(this.operatorPublicKey).toScVal(),
      StellarSdk.nativeToScVal(this.marketIdToBytes32(marketId)),
      StellarSdk.nativeToScVal(winningOutcomeIndex, { type: 'u32' })
    );

    const tx = new StellarSdk.TransactionBuilder(source, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();

    const prepared = await this.sorobanServer.prepareTransaction(tx);
    prepared.sign(StellarSdk.Keypair.fromSecret(this.operatorSecretKey));
    
    const submitted = await this.sorobanServer.sendTransaction(prepared);
    if (submitted.status === 'ERROR') {
      const msg = submitted.errorResult
        ? JSON.stringify(submitted.errorResult)
        : 'settle_market submission failed';
      throw new Error(msg);
    }
    if (submitted.hash) {
      await this.waitForRpcTransaction(submitted.hash);
    }
  }

  async migrateMarketToken(marketId: string, newTokenAddress: string): Promise<void> {
    this.ensureContractEnv();
    if (!this.operatorPublicKey || !this.operatorSecretKey) {
      throw new Error('[migrateMarketToken] OPERATOR_PUBLIC_KEY / OPERATOR_SECRET_KEY not configured');
    }

    const source = await this.sorobanServer.getAccount(this.operatorPublicKey);
    const contract = new StellarSdk.Contract(this.marketContractId);

    const op = contract.call(
      'migrate_market_token',
      new StellarSdk.Address(this.operatorPublicKey).toScVal(),
      StellarSdk.nativeToScVal(this.marketIdToBytes32(marketId)),
      new StellarSdk.Address(newTokenAddress).toScVal()
    );

    const tx = new StellarSdk.TransactionBuilder(source, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();

    const prepared = await this.sorobanServer.prepareTransaction(tx);
    prepared.sign(StellarSdk.Keypair.fromSecret(this.operatorSecretKey));

    const submitted = await this.sorobanServer.sendTransaction(prepared);
    if (submitted.status === 'ERROR') {
      const msg = submitted.errorResult
        ? JSON.stringify(submitted.errorResult)
        : 'migrate_market_token submission failed';
      throw new Error(msg);
    }
    if (submitted.hash) {
      await this.waitForRpcTransaction(submitted.hash);
    }
    console.log(`[migrateMarketToken] Market ${marketId} token migrated to ${newTokenAddress}`);
  }

  getTransactionHash(xdr: string): string {
    const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, this.networkPassphrase);
    if (tx instanceof StellarSdk.FeeBumpTransaction) {
      throw new Error('Fee bump transaction not supported');
    }
    return tx.hash().toString('hex');
  }
}
