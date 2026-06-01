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
const StellarSdk = __importStar(require("@stellar/stellar-sdk"));
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv.config({ path: path_1.default.resolve(__dirname, '../../.env') });
async function main() {
    const server = new StellarSdk.rpc.Server(process.env.STELLAR_SOROBAN_RPC_URL || '', { allowHttp: true });
    const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || '';
    const oracleContractId = process.env.ORACLE_MOCK_CONTRACT_ID || '';
    const operatorSecret = process.env.OPERATOR_SECRET_KEY || '';
    const operatorKeypair = StellarSdk.Keypair.fromSecret(operatorSecret);
    const oracleContract = new StellarSdk.Contract(oracleContractId);
    const asset = 'ETH';
    const newPrice = 3500000000000000000n; // arbitrary price
    const timestamp = 1780070402n; // EXACT on-chain end_time!
    const setPriceOp = oracleContract.call('set_price', StellarSdk.nativeToScVal(asset, { type: 'symbol' }), StellarSdk.nativeToScVal(newPrice, { type: 'i128' }), StellarSdk.nativeToScVal(timestamp, { type: 'u64' }));
    const sourceAccount = await server.getAccount(operatorKeypair.publicKey());
    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase,
    })
        .addOperation(setPriceOp)
        .setTimeout(60)
        .build();
    console.log('Preparing tx...');
    const prepared = await server.prepareTransaction(tx);
    prepared.sign(operatorKeypair);
    console.log('Sending tx...');
    const submitted = await server.sendTransaction(prepared);
    let finalStatus = 'PENDING';
    while (finalStatus === 'PENDING' || finalStatus === 'NOT_FOUND') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const txInfo = await server.getTransaction(submitted.hash);
        finalStatus = txInfo.status;
    }
    console.log('Status:', finalStatus);
}
main();
