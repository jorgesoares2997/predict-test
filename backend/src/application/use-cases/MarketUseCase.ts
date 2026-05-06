import { IMarketRepository, IStellarService } from '../ports';
import { CreateMarketDtoType } from '../dtos';
import { NotFoundException } from '../../domain/exceptions';
import { Market, MarketStatus } from '@prisma/client';

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
      resolution_source: data.resolution_source,
      closing_date: new Date(data.closing_date),
      liquidate_at: new Date(data.liquidate_at),
      status: data.status ?? MarketStatus.ACTIVE,
      contract_address: data.contract_address ?? null,
      results: data.results,
    });

    await this.stellarService.registerMarketContract({
      marketId: market.id,
      outcomesCount: market.results.length,
      closingDate: market.closing_date,
      liquidateAt: market.liquidate_at,
    });

    const contractAddress = process.env.MARKET_CONTRACT_ADDRESS || null;
    if (contractAddress && market.contract_address !== contractAddress) {
      return this.marketRepository.update(market.id, { contract_address: contractAddress });
    }

    return market;
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
    }>
  ) {
    const existing = await this.marketRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Market not found');
    }

    const { results, ...marketFields } = data;
    const payload = Object.fromEntries(
      Object.entries(marketFields).filter(([, v]) => v !== undefined)
    ) as Partial<
      Pick<
        Market,
        | 'title'
        | 'description'
        | 'status'
        | 'category_id'
        | 'contract_address'
        | 'resolution_source'
        | 'closing_date'
        | 'liquidate_at'
      >
    >;

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
}
