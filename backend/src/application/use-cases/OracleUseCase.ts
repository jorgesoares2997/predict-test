import { IMarketRepository, IOracleService, IStellarService } from '../ports';
import { MarketStatus } from '@prisma/client';

export class OracleUseCase {
  constructor(
    private readonly marketRepository: IMarketRepository,
    private readonly oracleService: IOracleService,
    private readonly stellarService: IStellarService
  ) {}

  async processLiquidations(currentDate: Date = new Date()) {
    console.log(`[OracleUseCase] Checking for markets to liquidate at ${currentDate.toISOString()}`);
    
    const markets = await this.marketRepository.findMarketsToLiquidate(currentDate);
    
    for (const market of markets) {
      try {
        console.log(`[OracleUseCase] Processing liquidation for market ${market.id}`);
        
        // Fetch result from source
        const winningResultName = await this.oracleService.fetchResultFromSource(market.resolution_source);
        
        if (!winningResultName) {
          console.warn(`[OracleUseCase] Could not fetch result for market ${market.id}`);
          continue;
        }

        // Lock market while settling
        await this.marketRepository.updateStatus(market.id, MarketStatus.LOCKED);

        // Find the matching result ID
        // Note: the findMarketsToLiquidate doesn't include results in our port definition, 
        // but we can assume we fetch it here or include it
        const marketDetails = await this.marketRepository.findById(market.id);
        if (!marketDetails) continue;

        const winningOutcomeIndex = marketDetails.results.findIndex(
          (r) => r.name.toLowerCase() === winningResultName.toLowerCase()
        );

        if (winningOutcomeIndex < 0) {
          console.warn(`[OracleUseCase] Winning result "${winningResultName}" not found in market ${market.id} options`);
          continue;
        }

        if (market.contract_address) {
          await this.stellarService.settleMarketContract(market.id, winningOutcomeIndex);
        }

        // Update to resolved
        await this.marketRepository.updateStatus(market.id, MarketStatus.RESOLVED);
        console.log(`[OracleUseCase] Successfully liquidated market ${market.id}. Winner: ${winningResultName}`);
      } catch (error) {
        console.error(`[OracleUseCase] Error processing market ${market.id}:`, error);
      }
    }
  }
}
