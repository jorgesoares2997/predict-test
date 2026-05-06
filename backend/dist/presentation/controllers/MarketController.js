"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketController = void 0;
const dtos_1 = require("../../application/dtos");
class MarketController {
    marketUseCase;
    constructor(marketUseCase) {
        this.marketUseCase = marketUseCase;
    }
    toFrontendMarket = (market) => ({
        id: market.id,
        title: market.title,
        description: market.description,
        category: market.category?.name || 'general',
        status: String(market.status || '').toLowerCase(),
        volume: String(market.volume ?? '0'),
        endsAt: market.closing_date,
        outcomes: (market.results || []).map((r) => ({
            id: r.id,
            name: r.name,
            price: String(r.price ?? '0'),
        })),
    });
    createMarket = async (request, reply) => {
        const user = request.user;
        const data = dtos_1.CreateMarketDto.parse(request.body);
        const market = await this.marketUseCase.createMarket(user.sub, user.kyc_status, data);
        return reply.status(201).send(this.toFrontendMarket(market));
    };
    listMarkets = async (request, reply) => {
        const { status, category } = request.query;
        const markets = await this.marketUseCase.listMarkets(status, category);
        return reply.status(200).send(markets.map(this.toFrontendMarket));
    };
    getMarket = async (request, reply) => {
        const { id } = request.params;
        const market = await this.marketUseCase.getMarketById(id);
        return reply.status(200).send(this.toFrontendMarket(market));
    };
    updateMarket = async (request, reply) => {
        const { id } = request.params;
        const data = dtos_1.UpdateMarketDto.parse(request.body);
        const market = await this.marketUseCase.updateMarket(id, {
            ...data,
            category_id: data.category_id === undefined ? undefined : data.category_id,
            closing_date: data.closing_date ? new Date(data.closing_date) : undefined,
            liquidate_at: data.liquidate_at ? new Date(data.liquidate_at) : undefined,
        });
        return reply.status(200).send(this.toFrontendMarket(market));
    };
    deleteMarket = async (request, reply) => {
        const { id } = request.params;
        await this.marketUseCase.deleteMarket(id);
        return reply.status(204).send();
    };
}
exports.MarketController = MarketController;
