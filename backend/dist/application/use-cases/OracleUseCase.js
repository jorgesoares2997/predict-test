"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OracleUseCase = void 0;
const client_1 = require("@prisma/client");
class OracleUseCase {
    marketRepository;
    oracleService;
    stellarService;
    constructor(marketRepository, oracleService, stellarService) {
        this.marketRepository = marketRepository;
        this.oracleService = oracleService;
        this.stellarService = stellarService;
    }
    async processLiquidations(currentDate = new Date()) {
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
                await this.marketRepository.updateStatus(market.id, client_1.MarketStatus.LOCKED);
                // Find the matching result ID
                // Note: the findMarketsToLiquidate doesn't include results in our port definition, 
                // but we can assume we fetch it here or include it
                const marketDetails = await this.marketRepository.findById(market.id);
                if (!marketDetails)
                    continue;
                const winningResult = marketDetails.results.find((r) => r.name.toLowerCase() === winningResultName.toLowerCase());
                if (!winningResult) {
                    console.warn(`[OracleUseCase] Winning result "${winningResultName}" not found in market ${market.id} options`);
                    continue;
                }
                if (market.contract_address) {
                    await this.stellarService.settleMarketContract(market.contract_address, winningResult.id);
                }
                // Update to resolved
                await this.marketRepository.updateStatus(market.id, client_1.MarketStatus.RESOLVED);
                console.log(`[OracleUseCase] Successfully liquidated market ${market.id}. Winner: ${winningResult.name}`);
            }
            catch (error) {
                console.error(`[OracleUseCase] Error processing market ${market.id}:`, error);
            }
        }
    }
}
exports.OracleUseCase = OracleUseCase;
