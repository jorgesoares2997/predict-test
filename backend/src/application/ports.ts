import { User, Market, Result, Transaction, Category, KycStatus, MarketStatus } from '@prisma/client';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByWalletAddress(walletAddress: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  create(data: { wallet_address: string; name?: string | null; email?: string | null }): Promise<User>;
  update(
    id: string,
    data: Partial<{
      wallet_address: string;
      didit_id: string | null;
      kyc_status: KycStatus;
      name: string | null;
      email: string | null;
    }>
  ): Promise<User>;
  delete(id: string): Promise<User>;
  updateKycStatus(id: string, status: KycStatus, didit_id?: string): Promise<User>;
}

export type MarketWithDetails = Market & { results: Result[]; category: Category | null };
export type TransactionWithDetails = Transaction & { market: Market; result: Result };

export interface IMarketRepository {
  create(data: Omit<Market, 'id' | 'results' | 'transactions' | 'category' | 'total_locked_value' | 'open_price'> & { results: string[] }): Promise<MarketWithDetails>;
  findById(id: string): Promise<MarketWithDetails | null>;
  findAll(filters?: { status?: MarketStatus; category?: string }): Promise<MarketWithDetails[]>;
  update(
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
      oracle_asset: string | null;
      open_price: any;
      initial_price: string | null;
      final_price: string | null;
      oracle_contract_address: string | null;
      oracle_decimals: number | null;
      target_price: string | null;
      condition_operator: string | null;
    }>
  ): Promise<MarketWithDetails>;
  syncResults(marketId: string, results: { id?: string; name: string }[]): Promise<void>;
  delete(id: string): Promise<Market>;
  updateStatus(id: string, status: MarketStatus): Promise<Market>;
  findMarketsToClose(currentDate: Date): Promise<Market[]>;
  findMarketsToLiquidate(currentDate: Date): Promise<Market[]>;
}

export interface IResultRepository {
  create(data: Omit<Result, 'id' | 'transactions' | 'market' | 'total_shares' | 'current_price'>): Promise<Result>;
  findById(id: string): Promise<Result | null>;
  findAll(filters?: { market_id?: string }): Promise<Result[]>;
  update(
    id: string,
    data: Partial<{ name: string; market_id: string; total_shares: any; current_price: any }>
  ): Promise<Result>;
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
  findByUserAndMarket(userId: string, marketId: string): Promise<Transaction | null>;
  findAll(filters?: { user_id?: string; market_id?: string; result_id?: string }): Promise<TransactionWithDetails[]>;
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
    oracleAsset?: string;
    oracleContractAddress?: string;
    oracleDecimals?: number;
    initialPrice?: string | null;
    targetPrice?: string | null;
    conditionOperator?: string | null;
  }): Promise<void>;
  preparePlaceBetXdr(input: {
    userPublicKey: string;
    marketId: string;
    outcomeIndex: number;
    amountStroops: bigint;
    oracleAsset?: string;
  }): Promise<string>;
  prepareClaimWinningsXdr(input: {
    userPublicKey: string;
    marketId: string;
    oracleAsset?: string;
    contractAddress?: string | null;
  }): Promise<string>;
  submitSignedContractTransaction(signedXdr: string): Promise<string>;
  settleMarketContract(marketId: string, winningOutcomeIndex: number, oracleAsset?: string, contractAddress?: string | null): Promise<void>;
  migrateMarketToken(marketId: string, newTokenAddress: string): Promise<void>;
  getTransactionHash(xdr: string): string;
  getOraclePrice(asset: string): Promise<string | null>;
}

export interface IOracleService {
  fetchResultFromSource(sourceUrl: string): Promise<string | null>; // Returns the winning result name or ID
}
