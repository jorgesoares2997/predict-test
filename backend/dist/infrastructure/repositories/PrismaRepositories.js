"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaTransactionRepository = exports.PrismaResultRepository = exports.PrismaCategoryRepository = exports.PrismaMarketRepository = exports.PrismaUserRepository = void 0;
const client_1 = require("@prisma/client");
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
                results: {
                    create: data.results.map((name) => ({ name })),
                },
            },
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
        return this.prisma.market.update({ where: { id }, data });
    }
    async delete(id) {
        return this.prisma.market.delete({ where: { id } });
    }
    async updateStatus(id, status) {
        return this.prisma.market.update({
            where: { id },
            data: { status },
        });
    }
    async findMarketsToLiquidate(currentDate) {
        return this.prisma.market.findMany({
            where: {
                status: client_1.MarketStatus.ACTIVE,
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
    async findAll(filters) {
        return this.prisma.transaction.findMany({
            where: {
                user_id: filters?.user_id,
                market_id: filters?.market_id,
                result_id: filters?.result_id,
            },
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
