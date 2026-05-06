"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketUseCase = void 0;
const exceptions_1 = require("../../domain/exceptions");
const client_1 = require("@prisma/client");
class MarketUseCase {
    marketRepository;
    constructor(marketRepository) {
        this.marketRepository = marketRepository;
    }
    async createMarket(userId, userKycStatus, data) {
        if (userKycStatus !== client_1.KycStatus.VERIFIED) {
            throw new exceptions_1.ForbiddenException('Only KYC verified users can create markets.');
        }
        const market = await this.marketRepository.create({
            title: data.title,
            description: data.description,
            category_id: data.category_id ?? null,
            resolution_source: data.resolution_source,
            closing_date: new Date(data.closing_date),
            liquidate_at: new Date(data.liquidate_at),
            status: client_1.MarketStatus.ACTIVE,
            contract_address: null, // To be set later or passed if contract is deployed beforehand
            results: data.results,
        });
        return market;
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
        return this.marketRepository.update(id, data);
    }
    async deleteMarket(id) {
        const existing = await this.marketRepository.findById(id);
        if (!existing) {
            throw new exceptions_1.NotFoundException('Market not found');
        }
        return this.marketRepository.delete(id);
    }
}
exports.MarketUseCase = MarketUseCase;
