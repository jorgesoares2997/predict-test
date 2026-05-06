import { FastifyRequest, FastifyReply } from 'fastify';
import { MarketUseCase } from '../../application/use-cases/MarketUseCase';
import { CreateMarketDto, UpdateMarketDto } from '../../application/dtos';
import { MarketStatus } from '@prisma/client';

export class MarketController {
  constructor(private readonly marketUseCase: MarketUseCase) {}

  private toFrontendMarket = (market: any) => ({
    id: market.id,
    title: market.title,
    description: market.description,
    resolutionSource: market.resolution_source ?? '',
    categoryId: market.category_id ?? '',
    category: market.category
      ? { id: market.category.id, name: market.category.name }
      : undefined,
    status: String(market.status || '').toLowerCase(),
    contractAddress: market.contract_address ?? null,
    volume: String(market.volume ?? '0'),
    endsAt: market.closing_date,
    liquidateAt: market.liquidate_at,
    outcomes: (market.results || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      price: String(r.price ?? '0'),
    })),
  });

  createMarket = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateMarketDto.parse(request.body);
    
    const market = await this.marketUseCase.createMarket(data);
    return reply.status(201).send(this.toFrontendMarket(market));
  };

  listMarkets = async (request: FastifyRequest, reply: FastifyReply) => {
    const { status, category } = request.query as { status?: MarketStatus; category?: string };
    const markets = await this.marketUseCase.listMarkets(status, category);
    return reply.status(200).send(markets.map(this.toFrontendMarket));
  };

  getMarket = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const market = await this.marketUseCase.getMarketById(id);
    return reply.status(200).send(this.toFrontendMarket(market));
  };

  updateMarket = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = UpdateMarketDto.parse(request.body);
    const { closing_date, liquidate_at, results, ...rest } = data;
    const market = await this.marketUseCase.updateMarket(id, {
      ...rest,
      ...(closing_date !== undefined ? { closing_date: new Date(closing_date) } : {}),
      ...(liquidate_at !== undefined ? { liquidate_at: new Date(liquidate_at) } : {}),
      ...(results !== undefined ? { results } : {}),
    });
    return reply.status(200).send(this.toFrontendMarket(market));
  };

  deleteMarket = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await this.marketUseCase.deleteMarket(id);
    return reply.status(204).send();
  };
}
