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
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const PrismaRepositories_1 = require("../infrastructure/repositories/PrismaRepositories");
const StellarService_1 = require("../infrastructure/services/StellarService");
const OracleUseCase_1 = require("../application/use-cases/OracleUseCase");
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    const marketRepo = new PrismaRepositories_1.PrismaMarketRepository(prisma);
    const stellarService = new StellarService_1.StellarService(process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org', process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015');
    const mockOracleService = {
        fetchResultFromSource: async () => null,
        startPolling: () => { }
    };
    const oracleUseCase = new OracleUseCase_1.OracleUseCase(marketRepo, mockOracleService, stellarService);
    console.log('Forcing liquidation check now...');
    await oracleUseCase.processLiquidations();
    console.log('Done!');
}
main().finally(() => {
    prisma.$disconnect();
    pool.end();
});
