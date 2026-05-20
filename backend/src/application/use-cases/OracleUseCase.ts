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
        
        // Se for mercado de Oráculo, o contrato resolve internamente via Reflector
        if (market.oracle_asset) {
          await this.marketRepository.updateStatus(market.id, MarketStatus.LOCKED);
          try {
            await this.stellarService.settleMarketContract(market.id, 0, market.oracle_asset);
            await this.marketRepository.updateStatus(market.id, MarketStatus.RESOLVED);
            console.log(`[OracleUseCase] Successfully liquidated Oracle market ${market.id} for asset ${market.oracle_asset}`);
          } catch (error) {
            console.error(`[OracleUseCase] Error liquidating Oracle market ${market.id}, rolling back to ACTIVE:`, error);
            await this.marketRepository.updateStatus(market.id, MarketStatus.ACTIVE);
          }
          continue;
        }

        // Fluxo para mercados padrão: Fetch result from source
        const winningResultName = await this.oracleService.fetchResultFromSource(market.resolution_source);
        
        if (!winningResultName) {
          console.warn(`[OracleUseCase] Could not fetch result for market ${market.id}`);
          continue;
        }

        // Lock market while settling
        await this.marketRepository.updateStatus(market.id, MarketStatus.LOCKED);

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
