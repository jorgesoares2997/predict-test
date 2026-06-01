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
        console.log('[OracleWorker] Starting cron job (every minute)');
        // Every minute: close markets whose closing_date has passed (ACTIVE → LOCKED)
        node_cron_1.default.schedule('* * * * *', async () => {
            try {
                await this.oracleUseCase.processClosings();
            }
            catch (error) {
                console.error('[OracleWorker] Error during processClosings:', error);
            }
        });
        // Every minute: resolve markets whose liquidate_at has passed (LOCKED → RESOLVED)
        node_cron_1.default.schedule('* * * * *', async () => {
            try {
                await this.oracleUseCase.processLiquidations();
            }
            catch (error) {
                console.error('[OracleWorker] Error during processLiquidations:', error);
            }
        });
    }
}
exports.OracleWorker = OracleWorker;
