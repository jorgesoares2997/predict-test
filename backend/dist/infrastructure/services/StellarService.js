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
    sorobanServer;
    networkPassphrase;
    marketContractId;
    reflectorContractId;
    usdcContractAddress;
    operatorPublicKey;
    operatorSecretKey;
    constructor(horizonUrl, networkPassphrase) {
        this.server = new StellarSdk.Horizon.Server(horizonUrl);
        this.sorobanServer = new StellarSdk.rpc.Server(process.env.STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org');
        this.networkPassphrase = networkPassphrase;
        this.marketContractId =
            process.env.MARKET_CONTRACT_ADDRESS ||
                process.env.MARKET_CONTRACT_ID ||
                process.env.NEXT_PUBLIC_MARKET_CONTRACT_ID ||
                '';
        this.reflectorContractId = process.env.REFLECTOR_CONTRACT_ID || '';
        this.usdcContractAddress = process.env.USDC_CONTRACT_ADDRESS || '';
        this.operatorPublicKey = process.env.OPERATOR_PUBLIC_KEY || '';
        this.operatorSecretKey = process.env.OPERATOR_SECRET_KEY || '';
    }
    ensureContractEnv() {
        if (!this.marketContractId) {
            throw new Error('Missing contract id in backend env. Set MARKET_CONTRACT_ADDRESS (preferred) or MARKET_CONTRACT_ID.');
        }
    }
    marketIdToBytes32(marketId) {
        const cleanUuid = marketId.replace(/-/g, '').toLowerCase();
        if (!/^[0-9a-f]{32}$/.test(cleanUuid)) {
            throw new Error('Invalid market id format. Expected UUID');
        }
        const marketIdBuffer = Buffer.from(cleanUuid, 'hex'); // 16 bytes
        const bytes32 = Buffer.alloc(32);
        marketIdBuffer.copy(bytes32);
        return bytes32;
    }
    isContractErrorCode(error, code) {
        const text = String(error?.message || error || '');
        return text.includes(`Error(Contract, #${code})`);
    }
    async waitForRpcTransaction(hash, maxAttempts = 20, delayMs = 500) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const tx = await this.sorobanServer.getTransaction(hash);
            const status = String(tx?.status || '');
            if (status === 'SUCCESS')
                return;
            if (status === 'FAILED') {
                throw new Error(`Soroban transaction failed: ${JSON.stringify(tx?.resultXdr || tx)}`);
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        throw new Error('Timed out waiting for Soroban transaction confirmation');
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
    async registerMarketContract(input) {
        this.ensureContractEnv();
        if (!this.operatorPublicKey || !this.operatorSecretKey || !this.usdcContractAddress) {
            console.warn('[registerMarketContract] missing operator/usdc env vars, skipping on-chain create_market');
            return;
        }
        const source = await this.sorobanServer.getAccount(this.operatorPublicKey);
        let op;
        if (input.oracleAsset) {
            console.log(`[registerMarketContract] Creating Oracle market for asset: ${input.oracleAsset}`);
            const durationSeconds = Math.floor((input.liquidateAt.getTime() - Date.now()) / 1000);
            const oracleMockId = input.oracleContractAddress || process.env.ORACLE_MOCK_CONTRACT_ID || '';
            if (!oracleMockId) {
                throw new Error('Missing ORACLE_MOCK_CONTRACT_ID in environment variables');
            }
            // Oracle market create_market is on our deployed market contract, not the Reflector oracle
            const marketContract = new StellarSdk.Contract(this.marketContractId);
            const conditionOperatorScVal = (() => {
                const raw = input.conditionOperator || 'GREATER_THAN';
                const variantMap = {
                    GREATER_THAN: 'Greater',
                    LESS_THAN: 'Less',
                    EQUAL: 'Equal',
                };
                const variant = variantMap[raw] ?? 'Greater';
                // Soroban #[contracttype] unit enum variant → ScvVec([ScvSymbol("Variant")])
                return StellarSdk.xdr.ScVal.scvVec([StellarSdk.xdr.ScVal.scvSymbol(variant)]);
            })();
            op = marketContract.call('create_market', StellarSdk.nativeToScVal(this.marketIdToBytes32(input.marketId)), StellarSdk.nativeToScVal(input.oracleAsset, { type: 'symbol' }), StellarSdk.nativeToScVal(Math.max(durationSeconds, 60), { type: 'u64' }), new StellarSdk.Address(oracleMockId).toScVal(), StellarSdk.nativeToScVal(input.oracleDecimals ?? 14, { type: 'u32' }), StellarSdk.nativeToScVal(BigInt(input.initialPrice ?? '0'), { type: 'i128' }), StellarSdk.nativeToScVal(BigInt(input.targetPrice ?? '0'), { type: 'i128' }), conditionOperatorScVal);
        }
        else {
            const contract = new StellarSdk.Contract(this.marketContractId);
            op = contract.call('create_market', StellarSdk.nativeToScVal(this.marketIdToBytes32(input.marketId)), new StellarSdk.Address(this.operatorPublicKey).toScVal(), new StellarSdk.Address(this.usdcContractAddress).toScVal(), StellarSdk.nativeToScVal(input.outcomesCount, { type: 'u32' }), StellarSdk.nativeToScVal(Math.floor(input.closingDate.getTime() / 1000), { type: 'u64' }), StellarSdk.nativeToScVal(Math.floor(input.liquidateAt.getTime() / 1000), { type: 'u64' }));
        }
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
    async preparePlaceBetXdr(input) {
        this.ensureContractEnv();
        const source = await this.sorobanServer.getAccount(input.userPublicKey);
        let op;
        if (input.oracleAsset) {
            // Oracle markets use our deployed market contract (reflector_prediction_market)
            // outcome: 1 = UP (Sim / condition met), -1 = DOWN (Não / condition not met)
            const contract = new StellarSdk.Contract(this.marketContractId);
            op = contract.call('place_bet', new StellarSdk.Address(input.userPublicKey).toScVal(), StellarSdk.nativeToScVal(this.marketIdToBytes32(input.marketId)), StellarSdk.nativeToScVal(input.outcomeIndex, { type: 'i32' }), StellarSdk.nativeToScVal(input.amountStroops, { type: 'i128' }));
        }
        else {
            const contract = new StellarSdk.Contract(this.marketContractId);
            op = contract.call('place_bet', new StellarSdk.Address(input.userPublicKey).toScVal(), StellarSdk.nativeToScVal(this.marketIdToBytes32(input.marketId)), StellarSdk.nativeToScVal(input.outcomeIndex, { type: 'u32' }), StellarSdk.nativeToScVal(input.amountStroops, { type: 'i128' }));
        }
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
    async prepareClaimWinningsXdr(input) {
        this.ensureContractEnv();
        const source = await this.sorobanServer.getAccount(input.userPublicKey);
        // Use the contract address stored on the market record (survives redeployments)
        const contractId = input.contractAddress || this.marketContractId;
        const contract = new StellarSdk.Contract(contractId);
        const op = contract.call('claim', new StellarSdk.Address(input.userPublicKey).toScVal(), StellarSdk.nativeToScVal(this.marketIdToBytes32(input.marketId)));
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
    async submitSignedContractTransaction(signedXdr) {
        const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
        if (tx instanceof StellarSdk.FeeBumpTransaction) {
            throw new Error('Fee bump transaction not supported');
        }
        const submitted = await this.sorobanServer.sendTransaction(tx);
        if (submitted.status === 'ERROR') {
            throw new Error(submitted.errorResult ? JSON.stringify(submitted.errorResult) : 'Contract transaction submission failed');
        }
        if (!submitted.hash)
            throw new Error('Missing transaction hash from RPC');
        await this.waitForRpcTransaction(submitted.hash);
        return submitted.hash;
    }
    async settleMarketContract(marketId, winningOutcomeIndex, oracleAsset, contractAddress) {
        this.ensureContractEnv();
        if (!this.operatorPublicKey || !this.operatorSecretKey) {
            console.warn('[settleMarketContract] missing operator env vars, skipping on-chain settlement');
            return;
        }
        const source = await this.sorobanServer.getAccount(this.operatorPublicKey);
        let op;
        // Always use the contract address stored on the market (survives redeployments)
        const contractId = contractAddress || this.marketContractId;
        if (oracleAsset) {
            // settle_market on our contract calls the Reflector oracle internally to get the price
            console.log(`[settleMarketContract] Settling Oracle market: ${marketId} (Asset: ${oracleAsset}) on ${contractId}`);
            const contract = new StellarSdk.Contract(contractId);
            op = contract.call('settle_market', StellarSdk.nativeToScVal(this.marketIdToBytes32(marketId)));
        }
        else {
            const contract = new StellarSdk.Contract(contractId);
            op = contract.call('settle_market', new StellarSdk.Address(this.operatorPublicKey).toScVal(), StellarSdk.nativeToScVal(this.marketIdToBytes32(marketId)), StellarSdk.nativeToScVal(winningOutcomeIndex, { type: 'u32' }));
        }
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
            // Error(Contract, #6) = MarketAlreadySettled — idempotent, not a real error
            if (this.isContractErrorCode({ message: msg }, 6)) {
                console.log(`[settleMarketContract] Market ${marketId} already settled on-chain.`);
                return;
            }
            throw new Error(msg);
        }
        if (submitted.hash) {
            await this.waitForRpcTransaction(submitted.hash);
        }
    }
    async migrateMarketToken(marketId, newTokenAddress) {
        this.ensureContractEnv();
        if (!this.operatorPublicKey || !this.operatorSecretKey) {
            throw new Error('[migrateMarketToken] OPERATOR_PUBLIC_KEY / OPERATOR_SECRET_KEY not configured');
        }
        const source = await this.sorobanServer.getAccount(this.operatorPublicKey);
        const contract = new StellarSdk.Contract(this.marketContractId);
        const op = contract.call('migrate_market_token', new StellarSdk.Address(this.operatorPublicKey).toScVal(), StellarSdk.nativeToScVal(this.marketIdToBytes32(marketId)), new StellarSdk.Address(newTokenAddress).toScVal());
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
    getTransactionHash(xdr) {
        const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, this.networkPassphrase);
        if (tx instanceof StellarSdk.FeeBumpTransaction) {
            throw new Error('Fee bump transaction not supported');
        }
        return tx.hash().toString('hex');
    }
    async getOraclePrice(asset) {
        if (process.env.NODE_ENV === 'production') {
            return this._getOraclePriceFromCoinGecko(asset);
        }
        return this._getOraclePriceFromReflector(asset);
    }
    /**
     * Production: fetch real-time USD price from CoinGecko and convert to the
     * same fixed-point integer representation used by Reflector (10^14 units).
     */
    async _getOraclePriceFromCoinGecko(asset) {
        const SYMBOL_TO_COINGECKO_ID = {
            BTC: 'bitcoin',
            ETH: 'ethereum',
            SOL: 'solana',
            XLM: 'stellar',
            USDC: 'usd-coin',
            USDT: 'tether',
            BNB: 'binancecoin',
            ADA: 'cardano',
            DOT: 'polkadot',
            AVAX: 'avalanche-2',
            MATIC: 'matic-network',
            LINK: 'chainlink',
            UNI: 'uniswap',
            ATOM: 'cosmos',
            LTC: 'litecoin',
            XRP: 'ripple',
            DOGE: 'dogecoin',
            SHIB: 'shiba-inu',
        };
        const coinId = SYMBOL_TO_COINGECKO_ID[asset.toUpperCase()];
        if (!coinId) {
            console.warn(`[getOraclePriceFromCoinGecko] No CoinGecko mapping for asset: ${asset}`);
            return null;
        }
        try {
            const apiKey = process.env.COINGECKO_API_KEY;
            const baseUrl = apiKey
                ? 'https://pro-api.coingecko.com/api/v3'
                : 'https://api.coingecko.com/api/v3';
            const headers = apiKey ? { 'x-cg-pro-api-key': apiKey } : {};
            const url = `${baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd`;
            const response = await fetch(url, { headers });
            if (!response.ok)
                throw new Error(`CoinGecko HTTP ${response.status}`);
            const data = await response.json();
            const usdPrice = data[coinId]?.usd;
            if (usdPrice === undefined)
                return null;
            // Convert to Reflector fixed-point: price_in_usd * 10^14
            const fixedPoint = BigInt(Math.round(usdPrice * 1e14));
            console.log(`[getOraclePriceFromCoinGecko] ${asset} = $${usdPrice} → ${fixedPoint}`);
            return fixedPoint.toString();
        }
        catch (e) {
            console.error('[getOraclePriceFromCoinGecko] Failed:', e);
            return null;
        }
    }
    /**
     * Development: query the local Reflector mock contract via Soroban simulation.
     */
    async _getOraclePriceFromReflector(asset) {
        try {
            const oracleMockId = process.env.ORACLE_MOCK_CONTRACT_ID || this.reflectorContractId;
            if (!oracleMockId) {
                throw new Error('Missing ORACLE_MOCK_CONTRACT_ID / REFLECTOR_CONTRACT_ID');
            }
            const contract = new StellarSdk.Contract(oracleMockId);
            const assetArg = StellarSdk.xdr.ScVal.scvMap([
                new StellarSdk.xdr.ScMapEntry({
                    key: StellarSdk.xdr.ScVal.scvSymbol('symbol'),
                    val: StellarSdk.nativeToScVal(asset, { type: 'symbol' }),
                }),
                new StellarSdk.xdr.ScMapEntry({
                    key: StellarSdk.xdr.ScVal.scvSymbol('type_code'),
                    val: StellarSdk.nativeToScVal('crypto', { type: 'symbol' }),
                }),
            ]);
            const source = await this.sorobanServer.getAccount(this.operatorPublicKey);
            const tx = new StellarSdk.TransactionBuilder(source, {
                fee: StellarSdk.BASE_FEE,
                networkPassphrase: this.networkPassphrase,
            })
                .addOperation(contract.call('lastprice', assetArg))
                .setTimeout(30)
                .build();
            const result = await this.sorobanServer.simulateTransaction(tx);
            if (!StellarSdk.rpc.Api.isSimulationSuccess(result) || !result.result)
                return null;
            const val = StellarSdk.scValToNative(result.result.retval);
            if (!val || val.price === undefined)
                return null;
            return String(val.price);
        }
        catch (e) {
            console.error('[getOraclePriceFromReflector] Failed:', e);
            return null;
        }
    }
}
exports.StellarService = StellarService;
