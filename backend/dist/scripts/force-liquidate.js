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
Object.defineProperty(exports, "__esModule", { value: true });
const StellarSdk = __importStar(require("@stellar/stellar-sdk"));
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: '.env' });
async function main() {
    const rpcServer = new StellarSdk.rpc.Server(process.env.STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org', { allowHttp: true });
    const horizonServer = new StellarSdk.Horizon.Server(process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org');
    const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || '';
    const oracleContractId = process.env.ORACLE_MOCK_CONTRACT_ID || '';
    const marketContractId = process.env.MARKET_CONTRACT_ADDRESS || '';
    const operatorSecret = process.env.OPERATOR_SECRET_KEY || '';
    const operatorKeypair = StellarSdk.Keypair.fromSecret(operatorSecret);
    const oracleContract = new StellarSdk.Contract(oracleContractId);
    const marketContract = new StellarSdk.Contract(marketContractId);
    const asset = 'ETH';
    const newPrice = 3500000000000000000n; // arbitrary price
    const timestamp = 1780070402n; // EXACT on-chain end_time!
    console.log('1. Setting price on Mock Oracle...');
    const setPriceOp = oracleContract.call('set_price', StellarSdk.nativeToScVal(asset, { type: 'symbol' }), StellarSdk.nativeToScVal(newPrice, { type: 'i128' }), StellarSdk.nativeToScVal(timestamp, { type: 'u64' }));
    let sourceAccount = await horizonServer.loadAccount(operatorKeypair.publicKey());
    let tx = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase,
    })
        .addOperation(setPriceOp)
        .setTimeout(60)
        .build();
    let prepared = await rpcServer.prepareTransaction(tx);
    prepared.sign(operatorKeypair);
    let submitted = await rpcServer.sendTransaction(prepared);
    console.log('Jitter Tx Status:', submitted.status);
    if (submitted.status !== 'PENDING') {
        console.log(submitted);
        return;
    }
    let finalStatus = 'PENDING';
    while (finalStatus === 'PENDING' || finalStatus === 'NOT_FOUND') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const txInfo = await rpcServer.getTransaction(submitted.hash);
        finalStatus = txInfo.status;
    }
    console.log('Jitter Final Status:', finalStatus);
    if (finalStatus === 'SUCCESS') {
        console.log('2. Settling market on Prediction Market...');
        // uuid to bytes32
        const marketId = '2fbe377e-206b-4c5c-9ba6-4b3f60bf313f';
        const cleanUuid = marketId.replace(/-/g, '').toLowerCase();
        const marketIdBuffer = Buffer.from(cleanUuid, 'hex');
        const bytes32 = Buffer.alloc(32);
        marketIdBuffer.copy(bytes32);
        const scValMarketId = StellarSdk.nativeToScVal(bytes32);
        const settleOp = marketContract.call('settle_market', scValMarketId);
        sourceAccount = await horizonServer.loadAccount(operatorKeypair.publicKey());
        tx = new StellarSdk.TransactionBuilder(sourceAccount, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase,
        })
            .addOperation(settleOp)
            .setTimeout(60)
            .build();
        prepared = await rpcServer.prepareTransaction(tx);
        prepared.sign(operatorKeypair);
        submitted = await rpcServer.sendTransaction(prepared);
        console.log('Settle Tx Status:', submitted.status);
        finalStatus = 'PENDING';
        while (finalStatus === 'PENDING' || finalStatus === 'NOT_FOUND') {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const txInfo = await rpcServer.getTransaction(submitted.hash);
            finalStatus = txInfo.status;
        }
        console.log('Settle Final Status:', finalStatus);
    }
}
main().catch(console.error);
