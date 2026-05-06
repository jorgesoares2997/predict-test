import cron from 'node-cron';
import { OracleUseCase } from '../application/use-cases/OracleUseCase';

export class OracleWorker {
  constructor(private readonly oracleUseCase: OracleUseCase) {}

  start() {
    console.log('[OracleWorker] Starting cron job (running every 5 minutes)');
    
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        await this.oracleUseCase.processLiquidations();
      } catch (error) {
        console.error('[OracleWorker] Error during execution:', error);
      }
    });
  }
}
