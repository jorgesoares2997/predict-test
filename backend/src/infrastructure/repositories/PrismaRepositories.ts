import { PrismaClient, User, Market, Transaction, Category, KycStatus, MarketStatus, Result } from '@prisma/client';
import { IUserRepository, IMarketRepository, IResultRepository, ICategoryRepository, ITransactionRepository } from '../../application/ports';
import { DomainException } from '../../domain/exceptions';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByWalletAddress(wallet_address: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { wallet_address } });
  }

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany({ orderBy: { created_at: 'desc' } });
  }

  async create(data: { wallet_address: string; name?: string | null; email?: string | null }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(
    id: string,
    data: Partial<{
      wallet_address: string;
      didit_id: string | null;
      kyc_status: KycStatus;
      name: string | null;
      email: string | null;
    }>
  ): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async delete(id: string): Promise<User> {
    return this.prisma.user.delete({ where: { id } });
  }

  async updateKycStatus(id: string, status: KycStatus, didit_id?: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { kyc_status: status, didit_id },
    });
  }
}

export class PrismaMarketRepository implements IMarketRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Omit<Market, 'id' | 'results' | 'transactions' | 'category' | 'total_locked_value'> & { results: string[] }): Promise<Market & { results: Result[]; category: Category | null }> {
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
          create: data.results.map((name) => ({ name, total_shares: 0, current_price: 0 })),
        },
      },
      include: { results: true, category: true },
    });
  }

  async findById(id: string): Promise<(Market & { results: Result[]; category: Category | null }) | null> {
    return this.prisma.market.findUnique({
      where: { id },
      include: { results: true, category: true },
    });
  }

  async findAll(filters?: { status?: MarketStatus; category?: string }): Promise<(Market & { category: Category | null; results: Result[] })[]> {
    const categoryFilter = filters?.category
      ? {
          OR: [
            { category_id: filters.category },
            {
              category: {
                is: {
                  name: { equals: filters.category, mode: 'insensitive' as const },
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

  async update(
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
      total_locked_value: any;
    }>
  ): Promise<Market & { results: Result[]; category: Category | null }> {
    return this.prisma.market.update({
      where: { id },
      data,
      include: { results: true, category: true },
    });
  }

  async syncResults(marketId: string, results: { id?: string; name: string }[]): Promise<void> {
    const existing = await this.prisma.result.findMany({ where: { market_id: marketId } });

    for (const r of results) {
      if (!r.id) continue;
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
      if (r.id) continue;
      await this.prisma.result.create({
        data: { market_id: marketId, name: r.name.trim(), total_shares: 0, current_price: 0 },
      });
    }

    const kept = new Set(results.filter((x): x is { id: string; name: string } => !!x.id).map((x) => x.id));
    for (const er of existing) {
      if (kept.has(er.id)) continue;
      const txCount = await this.prisma.transaction.count({ where: { result_id: er.id } });
      if (txCount > 0) {
        throw new DomainException('Cannot remove an outcome that already has trades registered.');
      }
      await this.prisma.result.delete({ where: { id: er.id } });
    }
  }

  async delete(id: string): Promise<Market> {
    return this.prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { market_id: id } });
      await tx.result.deleteMany({ where: { market_id: id } });
      return tx.market.delete({ where: { id } });
    });
  }

  async updateStatus(id: string, status: MarketStatus): Promise<Market> {
    return this.prisma.market.update({
      where: { id },
      data: { status },
    });
  }

  async findMarketsToLiquidate(currentDate: Date): Promise<Market[]> {
    return this.prisma.market.findMany({
      where: {
        status: MarketStatus.ACTIVE,
        liquidate_at: { lte: currentDate },
      },
    });
  }
}

export class PrismaCategoryRepository implements ICategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { name: string }): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  async findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { id } });
  }

  async findByName(name: string): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { name } });
  }

  async findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async update(id: string, data: Partial<Pick<Category, 'name'>>): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }

  async detachMarkets(categoryId: string): Promise<void> {
    await this.prisma.market.updateMany({
      where: { category_id: categoryId },
      data: { category_id: null },
    });
  }

  async delete(id: string): Promise<Category> {
    return this.prisma.category.delete({ where: { id } });
  }
}

export class PrismaResultRepository implements IResultRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Omit<Result, 'id' | 'transactions' | 'market' | 'total_shares' | 'current_price'>): Promise<Result> {
    return this.prisma.result.create({ data });
  }

  async findById(id: string): Promise<Result | null> {
    return this.prisma.result.findUnique({ where: { id } });
  }

  async findAll(filters?: { market_id?: string }): Promise<Result[]> {
    return this.prisma.result.findMany({
      where: filters?.market_id ? { market_id: filters.market_id } : undefined,
    });
  }

  async update(
    id: string,
    data: Partial<{ name: string; market_id: string; total_shares: any; current_price: any }>
  ): Promise<Result> {
    return this.prisma.result.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Result> {
    return this.prisma.result.delete({ where: { id } });
  }
}

export class PrismaTransactionRepository implements ITransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> {
    return this.prisma.transaction.create({ data });
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({ where: { id } });
  }

  async findByUserAndMarket(userId: string, marketId: string): Promise<Transaction | null> {
    return this.prisma.transaction.findFirst({
      where: { user_id: userId, market_id: marketId },
      orderBy: { created_at: 'desc' },
    });
  }

  async findAll(filters?: { user_id?: string; market_id?: string; result_id?: string }): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: {
        user_id: filters?.user_id,
        market_id: filters?.market_id,
        result_id: filters?.result_id,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findByTxHash(tx_hash: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({ where: { tx_hash } });
  }

  async update(
    id: string,
    data: Partial<Pick<Transaction, 'tx_hash' | 'user_id' | 'market_id' | 'result_id' | 'amount'>>
  ): Promise<Transaction> {
    return this.prisma.transaction.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Transaction> {
    return this.prisma.transaction.delete({ where: { id } });
  }
}
