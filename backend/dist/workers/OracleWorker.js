"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OracleWorker = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
class OracleWorker {
    oracleUseCase;
    constructor(oracleUseCase) {
        this.oracleUseCase = oracleUseCase;
    }
    start() {
        console.log('[OracleWorker] Starting cron job (running every 5 minutes)');
        // Run every 5 minutes
        node_cron_1.default.schedule('*/5 * * * *', async () => {
            try {
                await this.oracleUseCase.processLiquidations();
            }
            catch (error) {
                console.error('[OracleWorker] Error during execution:', error);
            }
        });
    }
}
exports.OracleWorker = OracleWorker;
