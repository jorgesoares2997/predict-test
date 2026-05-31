import cron from 'node-cron';
import { OracleUseCase } from '../application/use-cases/OracleUseCase';

export class OracleWorker {
  constructor(private readonly oracleUseCase: OracleUseCase) {}

  start() {
    console.log('[OracleWorker] Starting cron job (every minute)');

    // Every minute: close markets whose closing_date has passed (ACTIVE → LOCKED)
    cron.schedule('* * * * *', async () => {
      try {
        await this.oracleUseCase.processClosings();
      } catch (error) {
        console.error('[OracleWorker] Error during processClosings:', error);
      }
    });

    // Every minute: resolve markets whose liquidate_at has passed (LOCKED → RESOLVED)
    cron.schedule('* * * * *', async () => {
      try {
        await this.oracleUseCase.processLiquidations();
      } catch (error) {
        console.error('[OracleWorker] Error during processLiquidations:', error);
      }
    });
  }
}
