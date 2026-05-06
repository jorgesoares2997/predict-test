"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeUseCase = void 0;
const exceptions_1 = require("../../domain/exceptions");
const client_1 = require("@prisma/client");
class TradeUseCase {
    transactionRepository;
    marketRepository;
    stellarService;
    constructor(transactionRepository, marketRepository, stellarService) {
        this.transactionRepository = transactionRepository;
        this.marketRepository = marketRepository;
        this.stellarService = stellarService;
    }
    async registerTrade(userId, userKycStatus, data) {
        if (userKycStatus !== client_1.KycStatus.VERIFIED) {
            throw new exceptions_1.DomainException('Only KYC verified users can trade.');
        }
        const market = await this.marketRepository.findById(data.market_id);
        if (!market) {
            throw new exceptions_1.NotFoundException('Market not found');
        }
        const resultExists = market.results.some((r) => r.id === data.result_id);
        if (!resultExists) {
            throw new exceptions_1.DomainException('Result ID does not belong to this market');
        }
        // Verify on-chain to ensure consistency
        const isTxValid = await this.stellarService.verifyTransactionOnChain(data.tx_hash);
        if (!isTxValid) {
            throw new exceptions_1.DomainException('Transaction could not be verified on Stellar network');
        }
        const existingTx = await this.transactionRepository.findByTxHash(data.tx_hash);
        if (existingTx) {
            throw new exceptions_1.DomainException('Transaction already registered');
        }
        const transaction = await this.transactionRepository.create({
            tx_hash: data.tx_hash,
            user_id: userId,
            market_id: data.market_id,
            result_id: data.result_id,
            amount: data.amount, // Decimal type handling
        });
        return transaction;
    }
    async createTransaction(data) {
        return this.transactionRepository.create({
            tx_hash: data.tx_hash,
            user_id: data.user_id,
            market_id: data.market_id,
            result_id: data.result_id,
            amount: data.amount,
        });
    }
    async listTransactions(filters) {
        return this.transactionRepository.findAll(filters);
    }
    async getTransactionById(id) {
        const tx = await this.transactionRepository.findById(id);
        if (!tx) {
            throw new exceptions_1.NotFoundException('Transaction not found');
        }
        return tx;
    }
    async updateTransaction(id, data) {
        const existing = await this.transactionRepository.findById(id);
        if (!existing) {
            throw new exceptions_1.NotFoundException('Transaction not found');
        }
        return this.transactionRepository.update(id, { ...data, amount: data.amount });
    }
    async deleteTransaction(id) {
        const existing = await this.transactionRepository.findById(id);
        if (!existing) {
            throw new exceptions_1.NotFoundException('Transaction not found');
        }
        return this.transactionRepository.delete(id);
    }
}
exports.TradeUseCase = TradeUseCase;
