import { IMarketRepository, IResultRepository, IStellarService, ITransactionRepository } from '../ports';
import { RegisterTradeDtoType } from '../dtos';
import { DomainException, NotFoundException } from '../../domain/exceptions';
import { KycStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

export class TradeUseCase {
  private readonly kycEnabled = process.env.ENABLE_KYC === 'true';

  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly marketRepository: IMarketRepository,
    private readonly resultRepository: IResultRepository,
    private readonly stellarService: IStellarService
  ) {}

  private toStroops(amount: string): bigint {
    const normalized = amount.trim();
    if (!/^\d+(\.\d+)?$/.test(normalized)) {
      throw new DomainException('Invalid amount format');
    }
    const [whole, frac = ''] = normalized.split('.');
    const fracPadded = (frac + '0000000').slice(0, 7);
    return BigInt(whole) * 10_000_000n + BigInt(fracPadded);
  }

  async registerTrade(userId: string, userKycStatus: string, data: RegisterTradeDtoType) {
    if (this.kycEnabled && userKycStatus !== KycStatus.VERIFIED) {
      throw new DomainException('Only KYC verified users can trade.');
    }

    const market = await this.marketRepository.findById(data.market_id);
    if (!market) {
      throw new NotFoundException('Market not found');
    }

    const resultExists = market.results.some((r) => r.id === data.result_id);
    if (!resultExists) {
      throw new DomainException('Result ID does not belong to this market');
    }

    // Verify on-chain to ensure consistency
    const isTxValid = await this.stellarService.verifyTransactionOnChain(data.tx_hash);
    if (!isTxValid) {
      throw new DomainException('Transaction could not be verified on Stellar network');
    }

    const existingTx = await this.transactionRepository.findByTxHash(data.tx_hash);
    if (existingTx) {
      throw new DomainException('Transaction already registered');
    }

    const transaction = await this.transactionRepository.create({
      tx_hash: data.tx_hash,
      user_id: userId,
      market_id: data.market_id,
      result_id: data.result_id,
      amount: data.amount as any, // Decimal type handling
    });

    return transaction;
  }

  async createTransaction(data: {
    tx_hash: string;
    user_id: string;
    market_id: string;
    result_id: string;
    amount: number;
  }) {
    return this.transactionRepository.create({
      tx_hash: data.tx_hash,
      user_id: data.user_id,
      market_id: data.market_id,
      result_id: data.result_id,
      amount: data.amount as any,
    });
  }

  async prepareTrade(input: {
    userId: string;
    userPublicKey: string;
    marketId: string;
    outcomeId: string;
    amount: string;
  }) {
    const market = await this.marketRepository.findById(input.marketId);
    if (!market) throw new NotFoundException('Market not found');

    const outcomeIndex = market.results.findIndex((r) => r.id === input.outcomeId);
    if (outcomeIndex < 0) {
      throw new DomainException('Result ID does not belong to this market');
    }

    const amountStroops = this.toStroops(input.amount);
    if (amountStroops <= 0n) {
      throw new DomainException('Amount must be greater than zero');
    }

    const existingPrediction = await this.transactionRepository.findByUserAndMarket(input.userId, input.marketId);
    if (existingPrediction && !existingPrediction.tx_hash.startsWith('pending:')) {
      throw new DomainException('You already placed a prediction in this market');
    }

    let xdr: string;
    try {
      xdr = await this.stellarService.preparePlaceBetXdr({
        userPublicKey: input.userPublicKey,
        marketId: input.marketId,
        outcomeIndex,
        amountStroops,
      });
    } catch (error: any) {
      const message = String(error?.message || '');
      // Contract error #2 = MarketNotFound. Auto-register once for legacy rows created before on-chain hook.
      if (!message.includes('Error(Contract, #2)')) {
        throw error;
      }

      await this.stellarService.registerMarketContract({
        marketId: market.id,
        outcomesCount: market.results.length,
        closingDate: market.closing_date,
        liquidateAt: market.liquidate_at,
      });

      xdr = await this.stellarService.preparePlaceBetXdr({
        userPublicKey: input.userPublicKey,
        marketId: input.marketId,
        outcomeIndex,
        amountStroops,
      });
    }

    const expectedHashHex = this.stellarService.getTransactionHash(xdr);

    const reservedTransaction = existingPrediction
      ? await this.transactionRepository.update(existingPrediction.id, {
          tx_hash: `pending:${expectedHashHex}`,
          result_id: input.outcomeId,
          amount: Number(input.amount) as any,
        })
      : await this.transactionRepository.create({
          tx_hash: `pending:${expectedHashHex}`,
          user_id: input.userId,
          market_id: input.marketId,
          result_id: input.outcomeId,
          amount: Number(input.amount) as any,
        });

    return {
      xdr,
      outcomeIndex,
      amountStroops: amountStroops.toString(),
      transactionId: reservedTransaction.id,
    };
  }

  async executeTrade(input: {
    userId: string;
    userKycStatus: string;
    signedXdr: string;
    transactionId: string;
    marketId: string;
    outcomeId: string;
    amount: string;
  }) {
    const reserved = await this.transactionRepository.findById(input.transactionId);
    if (!reserved || reserved.user_id !== input.userId || reserved.market_id !== input.marketId) {
      throw new DomainException('Reserved transaction not found');
    }

    const submittedHashHex = this.stellarService.getTransactionHash(input.signedXdr);
    if (reserved.tx_hash !== `pending:${submittedHashHex}`) {
      throw new DomainException('Signed transaction payload does not match the prepared transaction. Tampering detected.');
    }

    const txHash = await this.stellarService.submitSignedContractTransaction(input.signedXdr);

    if (this.kycEnabled && input.userKycStatus !== KycStatus.VERIFIED) {
      throw new DomainException('Only KYC verified users can trade.');
    }

    const market = await this.marketRepository.findById(input.marketId);
    if (!market) {
      throw new NotFoundException('Market not found');
    }
    const resultExists = market.results.some((r) => r.id === input.outcomeId);
    if (!resultExists) {
      throw new DomainException('Result ID does not belong to this market');
    }

    const existingTxByHash = await this.transactionRepository.findByTxHash(txHash);
    if (existingTxByHash && existingTxByHash.id !== reserved.id) {
      throw new DomainException('Transaction already registered');
    }

    const tx = await this.transactionRepository.update(reserved.id, {
      tx_hash: txHash,
      result_id: input.outcomeId,
      amount: Number(input.amount) as any,
    });

    const marketTransactions = await this.transactionRepository.findAll({ market_id: input.marketId });
    const finalizedTransactions = marketTransactions.filter((t) => !t.tx_hash.startsWith('pending:'));
    const marketResults = await this.resultRepository.findAll({ market_id: input.marketId });
    if (marketResults.length > 0) {
      const totalLockedValue = finalizedTransactions.reduce((acc, current) => acc + Number(current.amount), 0);
      await this.marketRepository.update(input.marketId, {
        total_locked_value: totalLockedValue as any,
      });

      for (const result of marketResults) {
        const resultTotalShares = finalizedTransactions
          .filter((txItem) => txItem.result_id === result.id)
          .reduce((acc, current) => acc + Number(current.amount), 0);
        const currentPrice = totalLockedValue > 0 ? resultTotalShares / totalLockedValue : 0;
        await this.resultRepository.update(result.id, {
          total_shares: resultTotalShares as any,
          current_price: currentPrice as any,
        });
      }
    }

    return { txHash, transaction: tx };
  }

  async listTransactions(filters?: { user_id?: string; market_id?: string; result_id?: string }) {
    return this.transactionRepository.findAll(filters);
  }

  async getTransactionById(id: string) {
    const tx = await this.transactionRepository.findById(id);
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
    return tx;
  }

  async updateTransaction(
    id: string,
    data: Partial<{ tx_hash: string; user_id: string; market_id: string; result_id: string; amount: number }>
  ) {
    const existing = await this.transactionRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }
    return this.transactionRepository.update(id, { ...data, amount: data.amount as any });
  }

  async deleteTransaction(id: string) {
    const existing = await this.transactionRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }
    return this.transactionRepository.delete(id);
  }
}
