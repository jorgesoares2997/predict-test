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
        resolutionSource: market.resolution_source ?? '',
        categoryId: market.category_id ?? '',
        category: market.category
            ? { id: market.category.id, name: market.category.name }
            : undefined,
        status: String(market.status || '').toLowerCase(),
        contractAddress: market.contract_address ?? null,
        totalLockedValue: String(market.total_locked_value ?? '0'),
        endsAt: market.closing_date,
        liquidateAt: market.liquidate_at,
        outcomes: (market.results || []).map((r) => ({
            id: r.id,
            name: r.name,
            totalShares: String(r.total_shares ?? '0'),
            price: String(r.current_price ?? '0'),
        })),
        oracleAsset: market.oracle_asset ?? undefined,
        openPrice: market.open_price ? String(market.open_price) : undefined,
        initialPrice: market.initial_price ?? undefined,
        finalPrice: market.final_price ?? undefined,
        targetPrice: market.target_price ?? undefined,
        conditionOperator: market.condition_operator ?? undefined,
        oracleContractAddress: market.oracle_contract_address ?? undefined,
        oracleDecimals: market.oracle_decimals ?? undefined,
    });
    createMarket = async (request, reply) => {
        const data = dtos_1.CreateMarketDto.parse(request.body);
        const market = await this.marketUseCase.createMarket(data);
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
        const { closing_date, liquidate_at, results, ...rest } = data;
        const market = await this.marketUseCase.updateMarket(id, {
            ...rest,
            ...(closing_date !== undefined ? { closing_date: new Date(closing_date) } : {}),
            ...(liquidate_at !== undefined ? { liquidate_at: new Date(liquidate_at) } : {}),
            ...(results !== undefined ? { results } : {}),
        });
        return reply.status(200).send(this.toFrontendMarket(market));
    };
    deleteMarket = async (request, reply) => {
        const { id } = request.params;
        await this.marketUseCase.deleteMarket(id);
        return reply.status(204).send();
    };
    migrateMarketToken = async (request, reply) => {
        const { id } = request.params;
        const { newTokenAddress } = request.body;
        if (!newTokenAddress) {
            return reply.status(400).send({ error: 'newTokenAddress is required' });
        }
        const result = await this.marketUseCase.migrateMarketToken(id, newTokenAddress);
        return reply.status(200).send(result);
    };
}
exports.MarketController = MarketController;
