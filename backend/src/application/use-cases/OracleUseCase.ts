import { IMarketRepository, IOracleService, IStellarService } from '../ports';
import { MarketStatus } from '@prisma/client';

export class OracleUseCase {
  constructor(
    private readonly marketRepository: IMarketRepository,
    private readonly oracleService: IOracleService,
    private readonly stellarService: IStellarService
  ) {}

  /**
   * Phase 1 — Close markets whose closing_date has passed (ACTIVE → LOCKED).
   * Called on every cron tick so betting is frozen as soon as the market window ends.
   */
  async processClosings(currentDate: Date = new Date()) {
    console.log(`[OracleUseCase] Checking for markets to close at ${currentDate.toISOString()}`);
    const markets = await this.marketRepository.findMarketsToClose(currentDate);

    for (const market of markets) {
      try {
        await this.marketRepository.updateStatus(market.id, MarketStatus.LOCKED);
        console.log(`[OracleUseCase] Market ${market.id} LOCKED (closing_date passed)`);
      } catch (error) {
        console.error(`[OracleUseCase] Failed to lock market ${market.id}:`, error);
      }
    }
  }

  /**
   * Phase 2 — Resolve markets whose liquidate_at has passed (LOCKED → RESOLVED).
   * For oracle markets, fetches the real mainnet price and compares against target_price
   * using condition_operator to determine the winner.
   */
  async processLiquidations(currentDate: Date = new Date()) {
    console.log(`[OracleUseCase] Checking for markets to liquidate at ${currentDate.toISOString()}`);
    // Also retry on-chain settlement for RESOLVED oracle markets (handles cases where settle_market
    // failed during resolution but DB was updated — users cannot claim until on-chain is settled)
    const resolvedPending = await this.marketRepository.findAll({ status: 'RESOLVED' as any });
    for (const m of resolvedPending) {
      if (!(m as any).oracle_asset || !(m as any).final_price) continue;
      // Try settle — idempotent (MarketAlreadySettled is caught and ignored in settleMarketContract)
      try {
        await this.stellarService.settleMarketContract(
          m.id, 0, (m as any).oracle_asset, (m as any).contract_address ?? null
        );
      } catch { /* already settled or still failing — logged inside */ }
    }

    const markets = await this.marketRepository.findMarketsToLiquidate(currentDate);

    for (const market of markets) {
      try {
        console.log(`[OracleUseCase] Processing liquidation for market ${market.id}`);

        if (market.oracle_asset) {
          await this._resolveOracleMarket(market);
          continue;
        }

        // Standard markets — resolve via resolution_source URL
        const winningResultName = await this.oracleService.fetchResultFromSource(market.resolution_source);
        if (!winningResultName) {
          console.warn(`[OracleUseCase] Could not fetch result for market ${market.id}`);
          continue;
        }

        const marketDetails = await this.marketRepository.findById(market.id);
        if (!marketDetails) continue;

        const winningOutcomeIndex = marketDetails.results.findIndex(
          (r) => r.name.toLowerCase() === winningResultName.toLowerCase()
        );
        if (winningOutcomeIndex < 0) {
          console.warn(`[OracleUseCase] Winning result "${winningResultName}" not found in market ${market.id}`);
          continue;
        }

        await this.stellarService.settleMarketContract(market.id, winningOutcomeIndex);

        await this.marketRepository.updateStatus(market.id, MarketStatus.RESOLVED);
        console.log(`[OracleUseCase] Market ${market.id} RESOLVED. Winner: ${winningResultName}`);
      } catch (error) {
        console.error(`[OracleUseCase] Error processing market ${market.id}:`, error);
      }
    }
  }

  private async _resolveOracleMarket(market: any) {
    // --- Step 1: fetch price (this must succeed to resolve) ---
    let rawPrice: string | null = null;
    try {
      rawPrice = await this.stellarService.getOraclePrice(market.oracle_asset);
    } catch (e) {
      console.error(`[OracleUseCase] Price fetch failed for ${market.oracle_asset}:`, e);
    }

    if (!rawPrice) {
      console.warn(`[OracleUseCase] Could not fetch price for ${market.oracle_asset}, skipping market ${market.id}`);
      return; // leave LOCKED, retry next cron tick
    }

    // --- Step 2: evaluate condition ---
    const currentPrice = BigInt(rawPrice);
    const targetPrice = market.target_price ? BigInt(market.target_price) : null;
    const referencePrice = targetPrice ?? (market.initial_price ? BigInt(market.initial_price) : null);

    if (!referencePrice) {
      console.warn(`[OracleUseCase] No reference price for oracle market ${market.id}, resolving as GREATER_THAN initial`);
    }

    const operator: string = market.condition_operator ?? 'GREATER_THAN';
    let conditionMet = false;
    if (referencePrice) {
      switch (operator) {
        case 'GREATER_THAN': conditionMet = currentPrice > referencePrice; break;
        case 'LESS_THAN':    conditionMet = currentPrice < referencePrice; break;
        case 'EQUAL':        conditionMet = currentPrice === referencePrice; break;
        default:             conditionMet = currentPrice > referencePrice;
      }
    }

    // outcome index: 0 = "Sim" (condition met), 1 = "Não" (condition not met)
    const winningOutcomeIndex = conditionMet ? 0 : 1;

    console.log(
      `[OracleUseCase] Oracle market ${market.id} | asset=${market.oracle_asset} | ` +
      `price=${currentPrice} | ref=${referencePrice} | op=${operator} | ` +
      `conditionMet=${conditionMet} → outcome[${winningOutcomeIndex}] ("${conditionMet ? 'Sim' : 'Não'}")`
    );

    // --- Step 3: on-chain settlement (best-effort — failure does NOT block DB resolution) ---
    try {
      await this.stellarService.settleMarketContract(market.id, winningOutcomeIndex, market.oracle_asset, market.contract_address ?? null);
      console.log(`[OracleUseCase] On-chain settle_market succeeded for ${market.id}`);
    } catch (onChainError) {
      console.error(
        `[OracleUseCase] On-chain settle_market failed for ${market.id} (DB will still resolve):`,
        onChainError
      );
    }

    // --- Step 4: persist resolution in DB (always) ---
    try {
      await this.marketRepository.update(market.id, { final_price: rawPrice });
      const contractAddress = process.env.MARKET_CONTRACT_ADDRESS || process.env.MARKET_CONTRACT_ID || null;
      if (contractAddress && market.contract_address !== contractAddress) {
        await this.marketRepository.update(market.id, { contract_address: contractAddress });
      }
      await this.marketRepository.updateStatus(market.id, MarketStatus.RESOLVED);
      console.log(`[OracleUseCase] Oracle market ${market.id} RESOLVED in DB. Winner: outcome[${winningOutcomeIndex}] (${conditionMet ? 'Sim' : 'Não'})`);
    } catch (dbError) {
      console.error(`[OracleUseCase] DB resolution failed for ${market.id}:`, dbError);
    }
  }
}
