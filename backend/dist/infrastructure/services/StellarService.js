"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StellarService = void 0;
const StellarSdk = __importStar(require("@stellar/stellar-sdk"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const crypto_1 = require("crypto");
class StellarService {
    server;
    networkPassphrase;
    constructor(horizonUrl, networkPassphrase) {
        this.server = new StellarSdk.Horizon.Server(horizonUrl);
        this.networkPassphrase = networkPassphrase;
    }
    verifySignature(publicKey, signature, message) {
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
            if (signatureBuffer.length === tweetnacl_1.default.sign.signatureLength) {
                const valid = tweetnacl_1.default.sign.detached.verify(messageBuffer, signatureBuffer, publicKeyRaw);
                console.log('[verifySignature] detached path', { signatureLength: signatureBuffer.length, valid });
                return valid;
            }
            // Path 2: attached signature payload (signature + message bytes)
            // Some wallet integrations return nacl.sign output instead of detached signature.
            if (signatureBuffer.length > tweetnacl_1.default.sign.signatureLength) {
                const opened = tweetnacl_1.default.sign.open(signatureBuffer, publicKeyRaw);
                if (!opened)
                    return false;
                const valid = Buffer.compare(Buffer.from(opened), messageBuffer) === 0;
                console.log('[verifySignature] attached path', { signatureLength: signatureBuffer.length, valid });
                return valid;
            }
            console.log('[verifySignature] unsupported signature length', { signatureLength: signatureBuffer.length });
            return false;
        }
        catch (error) {
            console.error('Error verifying signature:', error);
            return false;
        }
    }
    verifySignedChallengeXdr(publicKey, signedXdr, message) {
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
            const expectedHashHex = (0, crypto_1.createHash)('sha256').update(message).digest('hex');
            const hasExpectedAuthOp = tx.operations.some((operation) => {
                if (operation.type !== 'manageData')
                    return false;
                const op = operation;
                const raw = op.value;
                const value = raw == null
                    ? ''
                    : typeof raw === 'string'
                        ? raw
                        : Buffer.from(raw).toString('utf8');
                return op.name === 'auth' && value === expectedHashHex;
            });
            if (!hasExpectedAuthOp) {
                console.log('[verifySignedChallengeXdr] challenge op mismatch', { expectedHashHex });
                return false;
            }
            const signatures = tx.signatures;
            if (!signatures || signatures.length === 0) {
                console.log('[verifySignedChallengeXdr] missing signatures');
                return false;
            }
            // Ensure at least one signature matches the expected key hint.
            const expectedHint = StellarSdk.StrKey.decodeEd25519PublicKey(publicKey).slice(-4);
            const validHint = signatures.some((sig) => Buffer.from(sig.hint).equals(Buffer.from(expectedHint)));
            console.log('[verifySignedChallengeXdr] signature hint check', {
                signaturesCount: signatures.length,
                validHint,
            });
            return validHint;
        }
        catch (error) {
            console.error('Error verifying signed challenge XDR:', error);
            return false;
        }
    }
    decodeSignature(signature) {
        const raw = (signature || '').trim();
        if (!raw)
            return null;
        // 1) Hex (optionally 0x-prefixed)
        const hex = raw.startsWith('0x') ? raw.slice(2) : raw;
        if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
            const fromHex = Buffer.from(hex, 'hex');
            if (fromHex.length === tweetnacl_1.default.sign.signatureLength)
                return fromHex;
        }
        // 2) Base64 / base64url (common wallet format for message signatures)
        try {
            const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
            const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
            const fromB64 = Buffer.from(padded, 'base64');
            if (fromB64.length === tweetnacl_1.default.sign.signatureLength)
                return fromB64;
        }
        catch {
            // noop
        }
        // 3) Raw UTF-8 payload (fallback for odd wallet responses)
        try {
            const fromUtf8 = Buffer.from(raw, 'utf8');
            if (fromUtf8.length >= tweetnacl_1.default.sign.signatureLength)
                return fromUtf8;
        }
        catch {
            // noop
        }
        return null;
    }
    async verifyTransactionOnChain(txHash) {
        try {
            const tx = await this.server.transactions().transaction(txHash).call();
            return tx.successful;
        }
        catch (error) {
            console.error('Error verifying transaction on chain:', error);
            return false;
        }
    }
    async settleMarketContract(contractAddress, winningResultId) {
        // Integration with Soroban Client to call the smart contract
        console.log(`Simulating settlement of contract ${contractAddress} with winner ${winningResultId}`);
        // In a real implementation:
        // 1. Build Soroban transaction using SorobanRpc
        // 2. Sign transaction with admin key
        // 3. Submit transaction
        // Example:
        // const contract = new StellarSdk.Contract(contractAddress);
        // const tx = new StellarSdk.TransactionBuilder(...)
        //   .addOperation(contract.call('settle', ...args))
        //   .build();
        // await this.sorobanServer.sendTransaction(tx);
    }
}
exports.StellarService = StellarService;
