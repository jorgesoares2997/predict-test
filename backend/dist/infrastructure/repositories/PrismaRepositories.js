"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaTransactionRepository = exports.PrismaResultRepository = exports.PrismaCategoryRepository = exports.PrismaMarketRepository = exports.PrismaUserRepository = void 0;
const client_1 = require("@prisma/client");
const exceptions_1 = require("../../domain/exceptions");
class PrismaUserRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(id) {
        return this.prisma.user.findUnique({ where: { id } });
    }
    async findByWalletAddress(wallet_address) {
        return this.prisma.user.findUnique({ where: { wallet_address } });
    }
    async findAll() {
        return this.prisma.user.findMany({ orderBy: { created_at: 'desc' } });
    }
    async create(data) {
        return this.prisma.user.create({ data });
    }
    async update(id, data) {
        return this.prisma.user.update({ where: { id }, data });
    }
    async delete(id) {
        return this.prisma.user.delete({ where: { id } });
    }
    async updateKycStatus(id, status, didit_id) {
        return this.prisma.user.update({
            where: { id },
            data: { kyc_status: status, didit_id },
        });
    }
}
exports.PrismaUserRepository = PrismaUserRepository;
class PrismaMarketRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return this.prisma.market.create({
            data: {
                title: data.title,
                description: data.description,
                category_id: data.category_id,
                resolution_source: data.resolution_source,
                closing_date: data.closing_date,
                liquidate_at: data.liquidate_at,
                status: data.status,
                contract_address: data.contract_address,
                oracle_asset: data.oracle_asset,
                initial_price: data.initial_price,
                final_price: data.final_price,
                oracle_contract_address: data.oracle_contract_address,
                oracle_decimals: data.oracle_decimals,
                target_price: data.target_price,
                condition_operator: data.condition_operator,
                results: {
                    create: data.results.map((name) => ({ name, total_shares: 0, current_price: 0 })),
                },
            },
            include: { results: true, category: true },
        });
    }
    async findById(id) {
        return this.prisma.market.findUnique({
            where: { id },
            include: { results: true, category: true },
        });
    }
    async findAll(filters) {
        const categoryFilter = filters?.category
            ? {
                OR: [
                    { category_id: filters.category },
                    {
                        category: {
                            is: {
                                name: { equals: filters.category, mode: 'insensitive' },
                            },
                        },
                    },
                ],
            }
            : undefined;
        return this.prisma.market.findMany({
            where: {
                ...(filters?.status ? { status: filters.status } : {}),
                ...(categoryFilter || {}),
            },
            include: { results: true, category: true },
        });
    }
    async update(id, data) {
        return this.prisma.market.update({
            where: { id },
            data,
            include: { results: true, category: true },
        });
    }
    async syncResults(marketId, results) {
        const existing = await this.prisma.result.findMany({ where: { market_id: marketId } });
        for (const r of results) {
            if (!r.id)
                continue;
            const row = await this.prisma.result.findFirst({
                where: { id: r.id, market_id: marketId },
            });
            if (row) {
                await this.prisma.result.update({
                    where: { id: r.id },
                    data: { name: r.name.trim() },
                });
            }
        }
        for (const r of results) {
            if (r.id)
                continue;
            await this.prisma.result.create({
                data: { market_id: marketId, name: r.name.trim(), total_shares: 0, current_price: 0 },
            });
        }
        const kept = new Set(results.filter((x) => !!x.id).map((x) => x.id));
        for (const er of existing) {
            if (kept.has(er.id))
                continue;
            const txCount = await this.prisma.transaction.count({ where: { result_id: er.id } });
            if (txCount > 0) {
                throw new exceptions_1.DomainException('Cannot remove an outcome that already has trades registered.');
            }
            await this.prisma.result.delete({ where: { id: er.id } });
        }
    }
    async delete(id) {
        return this.prisma.$transaction(async (tx) => {
            await tx.transaction.deleteMany({ where: { market_id: id } });
            await tx.result.deleteMany({ where: { market_id: id } });
            return tx.market.delete({ where: { id } });
        });
    }
    async updateStatus(id, status) {
        return this.prisma.market.update({
            where: { id },
            data: { status },
        });
    }
    async findMarketsToClose(currentDate) {
        return this.prisma.market.findMany({
            where: {
                status: client_1.MarketStatus.ACTIVE,
                closing_date: { lte: currentDate },
            },
        });
    }
    async findMarketsToLiquidate(currentDate) {
        return this.prisma.market.findMany({
            where: {
                status: client_1.MarketStatus.LOCKED,
                liquidate_at: { lte: currentDate },
            },
        });
    }
}
exports.PrismaMarketRepository = PrismaMarketRepository;
class PrismaCategoryRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return this.prisma.category.create({ data });
    }
    async findById(id) {
        return this.prisma.category.findUnique({ where: { id } });
    }
    async findByName(name) {
        return this.prisma.category.findUnique({ where: { name } });
    }
    async findAll() {
        return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
    }
    async update(id, data) {
        return this.prisma.category.update({ where: { id }, data });
    }
    async detachMarkets(categoryId) {
        await this.prisma.market.updateMany({
            where: { category_id: categoryId },
            data: { category_id: null },
        });
    }
    async delete(id) {
        return this.prisma.category.delete({ where: { id } });
    }
}
exports.PrismaCategoryRepository = PrismaCategoryRepository;
class PrismaResultRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return this.prisma.result.create({ data });
    }
    async findById(id) {
        return this.prisma.result.findUnique({ where: { id } });
    }
    async findAll(filters) {
        return this.prisma.result.findMany({
            where: filters?.market_id ? { market_id: filters.market_id } : undefined,
        });
    }
    async update(id, data) {
        return this.prisma.result.update({ where: { id }, data });
    }
    async delete(id) {
        return this.prisma.result.delete({ where: { id } });
    }
}
exports.PrismaResultRepository = PrismaResultRepository;
class PrismaTransactionRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return this.prisma.transaction.create({ data });
    }
    async findById(id) {
        return this.prisma.transaction.findUnique({ where: { id } });
    }
    async findByUserAndMarket(userId, marketId) {
        return this.prisma.transaction.findFirst({
            where: { user_id: userId, market_id: marketId },
            orderBy: { created_at: 'desc' },
        });
    }
    async findAll(filters) {
        return this.prisma.transaction.findMany({
            where: {
                user_id: filters?.user_id,
                market_id: filters?.market_id,
                result_id: filters?.result_id,
            },
            include: { market: true, result: true },
            orderBy: { created_at: 'desc' },
        });
    }
    async findByTxHash(tx_hash) {
        return this.prisma.transaction.findUnique({ where: { tx_hash } });
    }
    async update(id, data) {
        return this.prisma.transaction.update({ where: { id }, data });
    }
    async delete(id) {
        return this.prisma.transaction.delete({ where: { id } });
    }
}
exports.PrismaTransactionRepository = PrismaTransactionRepository;
