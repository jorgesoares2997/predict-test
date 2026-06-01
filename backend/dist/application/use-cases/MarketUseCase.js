"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketUseCase = void 0;
const exceptions_1 = require("../../domain/exceptions");
const client_1 = require("@prisma/client");
class MarketUseCase {
    marketRepository;
    stellarService;
    constructor(marketRepository, stellarService) {
        this.marketRepository = marketRepository;
        this.stellarService = stellarService;
    }
    /** Any authenticated user may create markets (admin UI). Trading still requires KYC in {@link TradeUseCase}. */
    async createMarket(data) {
        const market = await this.marketRepository.create({
            title: data.title,
            description: data.description,
            category_id: data.category_id ?? null,
            resolution_source: data.resolution_source ?? (data.oracle_asset ? `Reflector Oracle: ${data.oracle_asset}` : 'Manual Resolution'),
            closing_date: new Date(data.closing_date),
            liquidate_at: new Date(data.liquidate_at),
            status: data.status ?? client_1.MarketStatus.ACTIVE,
            contract_address: data.contract_address ?? null,
            results: data.results,
            oracle_asset: data.oracle_asset ?? null,
            initial_price: data.oracle_asset
                ? (await this.stellarService.getOraclePrice(data.oracle_asset)) ?? null
                : null,
            final_price: null,
            oracle_contract_address: data.oracle_contract_address ?? null,
            oracle_decimals: data.oracle_decimals ?? null,
            // Convert target_price from plain USD (admin input) to Reflector fixed-point (price × 10^decimals)
            target_price: (() => {
                if (!data.target_price)
                    return null;
                const decimals = data.oracle_decimals ?? 14;
                try {
                    const usd = parseFloat(data.target_price);
                    return String(BigInt(Math.round(usd * Math.pow(10, decimals))));
                }
                catch {
                    return data.target_price; // fallback: store as-is if already fixed-point
                }
            })(),
            condition_operator: data.condition_operator ?? null,
        });
        try {
            await this.stellarService.registerMarketContract({
                marketId: market.id,
                outcomesCount: market.results.length,
                closingDate: market.closing_date,
                liquidateAt: market.liquidate_at,
                oracleAsset: market.oracle_asset ?? undefined,
                oracleContractAddress: market.oracle_contract_address ?? undefined,
                oracleDecimals: market.oracle_decimals ?? undefined,
                initialPrice: market.initial_price ?? null,
                targetPrice: market.target_price ?? null,
                conditionOperator: market.condition_operator ?? null,
            });
            const contractAddress = process.env.MARKET_CONTRACT_ADDRESS || null;
            if (contractAddress && market.contract_address !== contractAddress) {
                return this.marketRepository.update(market.id, { contract_address: contractAddress });
            }
            return market;
        }
        catch (error) {
            console.error(`[MarketUseCase] Failed to register market on-chain. Rolling back DB...`, error);
            await this.marketRepository.delete(market.id);
            const errorMsg = String(error?.message || '');
            if (errorMsg.includes('InvalidAction') || errorMsg.includes('UnreachableCodeReached')) {
                throw new Error('Falha no Oráculo: O ativo especificado não está registrado no mock local do Reflector. Verifique os ativos disponíveis.');
            }
            throw error;
        }
    }
    async listMarkets(status, category) {
        return this.marketRepository.findAll({ status, category });
    }
    async getMarketById(id) {
        const market = await this.marketRepository.findById(id);
        if (!market) {
            throw new exceptions_1.NotFoundException('Market not found');
        }
        return market;
    }
    async updateMarket(id, data) {
        const existing = await this.marketRepository.findById(id);
        if (!existing) {
            throw new exceptions_1.NotFoundException('Market not found');
        }
        const { results, ...marketFields } = data;
        const payload = Object.fromEntries(Object.entries(marketFields).filter(([, v]) => v !== undefined));
        if (Object.keys(payload).length > 0) {
            await this.marketRepository.update(id, payload);
        }
        if (results !== undefined) {
            await this.marketRepository.syncResults(id, results);
        }
        const fresh = await this.marketRepository.findById(id);
        if (!fresh) {
            throw new exceptions_1.NotFoundException('Market not found');
        }
        return fresh;
    }
    async deleteMarket(id) {
        const existing = await this.marketRepository.findById(id);
        if (!existing) {
            throw new exceptions_1.NotFoundException('Market not found');
        }
        return this.marketRepository.delete(id);
    }
    /** Migrate a market's token address on-chain (e.g. old test token → official USDC SAC). */
    async migrateMarketToken(marketId, newTokenAddress) {
        const existing = await this.marketRepository.findById(marketId);
        if (!existing) {
            throw new exceptions_1.NotFoundException('Market not found');
        }
        await this.stellarService.migrateMarketToken(marketId, newTokenAddress);
        return { marketId, newTokenAddress, success: true };
    }
}
exports.MarketUseCase = MarketUseCase;
