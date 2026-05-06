import { User, Market, Result, Transaction, Category, KycStatus, MarketStatus } from '@prisma/client';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByWalletAddress(walletAddress: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  create(data: { wallet_address: string }): Promise<User>;
  update(id: string, data: Partial<Pick<User, 'wallet_address' | 'didit_id' | 'kyc_status'>>): Promise<User>;
  delete(id: string): Promise<User>;
  updateKycStatus(id: string, status: KycStatus, didit_id?: string): Promise<User>;
}

export type MarketWithDetails = Market & { results: Result[]; category: Category | null };

export interface IMarketRepository {
  create(data: Omit<Market, 'id' | 'results' | 'transactions' | 'category'> & { results: string[] }): Promise<MarketWithDetails>;
  findById(id: string): Promise<MarketWithDetails | null>;
  findAll(filters?: { status?: MarketStatus; category?: string }): Promise<MarketWithDetails[]>;
  update(
    id: string,
    data: Partial<
      Pick<Market, 'title' | 'description' | 'status' | 'category_id' | 'contract_address' | 'resolution_source' | 'closing_date' | 'liquidate_at'>
    >
  ): Promise<MarketWithDetails>;
  syncResults(marketId: string, results: { id?: string; name: string }[]): Promise<void>;
  delete(id: string): Promise<Market>;
  updateStatus(id: string, status: MarketStatus): Promise<Market>;
  findMarketsToLiquidate(currentDate: Date): Promise<Market[]>;
}

export interface IResultRepository {
  create(data: Omit<Result, 'id' | 'transactions' | 'market'>): Promise<Result>;
  findById(id: string): Promise<Result | null>;
  findAll(filters?: { market_id?: string }): Promise<Result[]>;
  update(id: string, data: Partial<Pick<Result, 'name' | 'market_id'>>): Promise<Result>;
  delete(id: string): Promise<Result>;
}

export interface ICategoryRepository {
  create(data: { name: string }): Promise<Category>;
  findById(id: string): Promise<Category | null>;
  findByName(name: string): Promise<Category | null>;
  findAll(): Promise<Category[]>;
  update(id: string, data: Partial<Pick<Category, 'name'>>): Promise<Category>;
  /** Sets market.category_id to null for all markets using this category (before delete). */
  detachMarkets(categoryId: string): Promise<void>;
  delete(id: string): Promise<Category>;
}

export interface ITransactionRepository {
  create(data: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction>;
  findById(id: string): Promise<Transaction | null>;
  findAll(filters?: { user_id?: string; market_id?: string; result_id?: string }): Promise<Transaction[]>;
  findByTxHash(txHash: string): Promise<Transaction | null>;
  update(
    id: string,
    data: Partial<Pick<Transaction, 'tx_hash' | 'user_id' | 'market_id' | 'result_id' | 'amount'>>
  ): Promise<Transaction>;
  delete(id: string): Promise<Transaction>;
}

export interface IStellarService {
  verifySignature(publicKey: string, signature: string, message: string): boolean;
  verifyTransactionOnChain(txHash: string): Promise<boolean>;
  registerMarketContract(input: {
    marketId: string;
    outcomesCount: number;
    closingDate: Date;
    liquidateAt: Date;
  }): Promise<void>;
  preparePlaceBetXdr(input: {
    userPublicKey: string;
    marketId: string;
    outcomeIndex: number;
    amountStroops: bigint;
  }): Promise<string>;
  submitSignedContractTransaction(signedXdr: string): Promise<string>;
  settleMarketContract(contractAddress: string, winningResultId: string): Promise<void>;
}

export interface IOracleService {
  fetchResultFromSource(sourceUrl: string): Promise<string | null>; // Returns the winning result name or ID
}
