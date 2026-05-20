import { IMarketRepository, IStellarService } from '../ports';
import { CreateMarketDtoType } from '../dtos';
import { NotFoundException } from '../../domain/exceptions';
import { MarketStatus } from '@prisma/client';

export class MarketUseCase {
  constructor(
    private readonly marketRepository: IMarketRepository,
    private readonly stellarService: IStellarService
  ) {}

  /** Any authenticated user may create markets (admin UI). Trading still requires KYC in {@link TradeUseCase}. */
  async createMarket(data: CreateMarketDtoType) {
    const market = await this.marketRepository.create({
      title: data.title,
      description: data.description,
      category_id: data.category_id ?? null,
      resolution_source: data.resolution_source ?? (data.oracle_asset ? `Reflector Oracle: ${data.oracle_asset}` : 'Manual Resolution'),
      closing_date: new Date(data.closing_date),
      liquidate_at: new Date(data.liquidate_at),
      status: data.status ?? MarketStatus.ACTIVE,
      contract_address: data.contract_address ?? null,
      results: data.results,
      oracle_asset: data.oracle_asset ?? null,
      initial_price: data.initial_price ?? null,
      final_price: null,
      oracle_contract_address: data.oracle_contract_address ?? null,
      oracle_decimals: data.oracle_decimals ?? null,
    });

    try {
      await this.stellarService.registerMarketContract({
        marketId: market.id,
        outcomesCount: market.results.length,
        closingDate: market.closing_date,
        liquidateAt: market.liquidate_at,
        oracleAsset: market.oracle_asset ?? undefined,
      });

      const contractAddress = process.env.MARKET_CONTRACT_ADDRESS || null;
      if (contractAddress && market.contract_address !== contractAddress) {
        return this.marketRepository.update(market.id, { contract_address: contractAddress });
      }

      return market;
    } catch (error: any) {
      console.error(`[MarketUseCase] Failed to register market on-chain. Rolling back DB...`, error);
      await this.marketRepository.delete(market.id);

      const errorMsg = String(error?.message || '');
      if (errorMsg.includes('InvalidAction') || errorMsg.includes('UnreachableCodeReached')) {
        throw new Error('Falha no Oráculo: O ativo especificado não está registrado no mock local do Reflector. Verifique os ativos disponíveis.');
      }
      throw error;
    }
  }

  async listMarkets(status?: MarketStatus, category?: string) {
    return this.marketRepository.findAll({ status, category });
  }

  async getMarketById(id: string) {
    const market = await this.marketRepository.findById(id);
    if (!market) {
      throw new NotFoundException('Market not found');
    }
    return market;
  }

  async updateMarket(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      status: MarketStatus;
      category_id: string | null;
      contract_address: string | null;
      resolution_source: string;
      closing_date: Date;
      liquidate_at: Date;
      results: { id?: string; name: string }[];
      oracle_asset: string | null;
    }>
  ) {
    const existing = await this.marketRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Market not found');
    }

    const { results, ...marketFields } = data;
    const payload = Object.fromEntries(
      Object.entries(marketFields).filter(([, v]) => v !== undefined)
    ) as Partial<{
      title: string;
      description: string;
      status: MarketStatus;
      category_id: string | null;
      contract_address: string | null;
      resolution_source: string;
      closing_date: Date;
      liquidate_at: Date;
      total_locked_value: any;
      oracle_asset: string | null;
    }>;

    if (Object.keys(payload).length > 0) {
      await this.marketRepository.update(id, payload);
    }

    if (results !== undefined) {
      await this.marketRepository.syncResults(id, results);
    }

    const fresh = await this.marketRepository.findById(id);
    if (!fresh) {
      throw new NotFoundException('Market not found');
    }
    return fresh;
  }

  async deleteMarket(id: string) {
    const existing = await this.marketRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Market not found');
    }
    return this.marketRepository.delete(id);
  }

  /** Migrate a market's token address on-chain (e.g. old test token → official USDC SAC). */
  async migrateMarketToken(marketId: string, newTokenAddress: string) {
    const existing = await this.marketRepository.findById(marketId);
    if (!existing) {
      throw new NotFoundException('Market not found');
    }
    await this.stellarService.migrateMarketToken(marketId, newTokenAddress);
    return { marketId, newTokenAddress, success: true };
  }
}
