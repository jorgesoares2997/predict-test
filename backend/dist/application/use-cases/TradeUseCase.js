"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeUseCase = void 0;
const exceptions_1 = require("../../domain/exceptions");
const client_1 = require("@prisma/client");
class TradeUseCase {
    transactionRepository;
    marketRepository;
    resultRepository;
    stellarService;
    kycEnabled = process.env.ENABLE_KYC === 'true';
    constructor(transactionRepository, marketRepository, resultRepository, stellarService) {
        this.transactionRepository = transactionRepository;
        this.marketRepository = marketRepository;
        this.resultRepository = resultRepository;
        this.stellarService = stellarService;
    }
    toStroops(amount) {
        const normalized = amount.trim();
        if (!/^\d+(\.\d+)?$/.test(normalized)) {
            throw new exceptions_1.DomainException('Invalid amount format');
        }
        const [whole, frac = ''] = normalized.split('.');
        const fracPadded = (frac + '0000000').slice(0, 7);
        return BigInt(whole) * 10000000n + BigInt(fracPadded);
    }
    async registerTrade(userId, userKycStatus, data) {
        if (this.kycEnabled && userKycStatus !== client_1.KycStatus.VERIFIED) {
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
    async prepareTrade(input) {
        const market = await this.marketRepository.findById(input.marketId);
        if (!market)
            throw new exceptions_1.NotFoundException('Market not found');
        const outcomeIndex = market.results.findIndex((r) => r.id === input.outcomeId);
        if (outcomeIndex < 0) {
            throw new exceptions_1.DomainException('Result ID does not belong to this market');
        }
        const amountStroops = this.toStroops(input.amount);
        if (amountStroops <= 0n) {
            throw new exceptions_1.DomainException('Amount must be greater than zero');
        }
        const existingPrediction = await this.transactionRepository.findByUserAndMarket(input.userId, input.marketId);
        if (existingPrediction && !existingPrediction.tx_hash.startsWith('pending:')) {
            throw new exceptions_1.DomainException('You already placed a prediction in this market');
        }
        let contractOutcomeIndex = outcomeIndex;
        if (market.oracle_asset) {
            const outcomeName = market.results[outcomeIndex].name.toLowerCase();
            if (outcomeName === 'sim' || outcomeName === 'up') {
                contractOutcomeIndex = 1;
            }
            else {
                contractOutcomeIndex = -1;
            }
        }
        let xdr;
        try {
            xdr = await this.stellarService.preparePlaceBetXdr({
                userPublicKey: input.userPublicKey,
                marketId: input.marketId,
                outcomeIndex: contractOutcomeIndex,
                amountStroops,
                oracleAsset: market.oracle_asset ?? undefined,
            });
        }
        catch (error) {
            const message = String(error?.message || error || '');
            // Contract error #5 = MarketNotOpen (closed or expired)
            if (message.includes('Error(Contract, #5)')) {
                throw new exceptions_1.DomainException('This market is no longer accepting predictions.');
            }
            // Contract error #2 = MarketNotFound — auto-register once (handles markets created before on-chain hook)
            if (!message.includes('Error(Contract, #2)')) {
                throw new exceptions_1.DomainException(`Failed to prepare transaction: ${message}`);
            }
            // Re-register passing ALL oracle fields
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
            try {
                xdr = await this.stellarService.preparePlaceBetXdr({
                    userPublicKey: input.userPublicKey,
                    marketId: input.marketId,
                    outcomeIndex: contractOutcomeIndex,
                    amountStroops,
                    oracleAsset: market.oracle_asset ?? undefined,
                });
            }
            catch (retryError) {
                throw new exceptions_1.DomainException(`Failed to prepare transaction after re-registration: ${String(retryError?.message || retryError)}`);
            }
        }
        const expectedHashHex = this.stellarService.getTransactionHash(xdr);
        const reservedTransaction = existingPrediction
            ? await this.transactionRepository.update(existingPrediction.id, {
                tx_hash: `pending:${expectedHashHex}`,
                result_id: input.outcomeId,
                amount: Number(input.amount),
            })
            : await this.transactionRepository.create({
                tx_hash: `pending:${expectedHashHex}`,
                user_id: input.userId,
                market_id: input.marketId,
                result_id: input.outcomeId,
                amount: Number(input.amount),
            });
        return {
            xdr,
            outcomeIndex,
            amountStroops: amountStroops.toString(),
            transactionId: reservedTransaction.id,
        };
    }
    async executeTrade(input) {
        const reserved = await this.transactionRepository.findById(input.transactionId);
        if (!reserved || reserved.user_id !== input.userId || reserved.market_id !== input.marketId) {
            throw new exceptions_1.DomainException('Reserved transaction not found');
        }
        const submittedHashHex = this.stellarService.getTransactionHash(input.signedXdr);
        if (reserved.tx_hash !== `pending:${submittedHashHex}`) {
            throw new exceptions_1.DomainException('Signed transaction payload does not match the prepared transaction. Tampering detected.');
        }
        let txHash;
        try {
            txHash = await this.stellarService.submitSignedContractTransaction(input.signedXdr);
        }
        catch (error) {
            const msg = String(error?.message || error || '');
            throw new exceptions_1.DomainException(`Transaction submission failed: ${msg}`);
        }
        if (this.kycEnabled && input.userKycStatus !== client_1.KycStatus.VERIFIED) {
            throw new exceptions_1.DomainException('Only KYC verified users can trade.');
        }
        const market = await this.marketRepository.findById(input.marketId);
        if (!market) {
            throw new exceptions_1.NotFoundException('Market not found');
        }
        const resultExists = market.results.some((r) => r.id === input.outcomeId);
        if (!resultExists) {
            throw new exceptions_1.DomainException('Result ID does not belong to this market');
        }
        const existingTxByHash = await this.transactionRepository.findByTxHash(txHash);
        if (existingTxByHash && existingTxByHash.id !== reserved.id) {
            throw new exceptions_1.DomainException('Transaction already registered');
        }
        const tx = await this.transactionRepository.update(reserved.id, {
            tx_hash: txHash,
            result_id: input.outcomeId,
            amount: Number(input.amount),
        });
        const marketTransactions = await this.transactionRepository.findAll({ market_id: input.marketId });
        const finalizedTransactions = marketTransactions.filter((t) => !t.tx_hash.startsWith('pending:'));
        const marketResults = await this.resultRepository.findAll({ market_id: input.marketId });
        if (marketResults.length > 0) {
            const totalLockedValue = finalizedTransactions.reduce((acc, current) => acc + Number(current.amount), 0);
            await this.marketRepository.update(input.marketId, {
                total_locked_value: totalLockedValue,
            });
            for (const result of marketResults) {
                const resultTotalShares = finalizedTransactions
                    .filter((txItem) => txItem.result_id === result.id)
                    .reduce((acc, current) => acc + Number(current.amount), 0);
                const currentPrice = totalLockedValue > 0 ? resultTotalShares / totalLockedValue : 0;
                await this.resultRepository.update(result.id, {
                    total_shares: resultTotalShares,
                    current_price: currentPrice,
                });
            }
        }
        return { txHash, transaction: tx };
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
    async prepareClaim(input) {
        const market = await this.marketRepository.findById(input.marketId);
        if (!market) {
            throw new exceptions_1.NotFoundException('Market not found');
        }
        // Prisma returns uppercase enum strings — compare accordingly
        if (String(market.status).toUpperCase() !== 'RESOLVED') {
            throw new exceptions_1.DomainException('Market is not resolved yet. Please wait for liquidation.');
        }
        let xdr;
        try {
            xdr = await this.stellarService.prepareClaimWinningsXdr({
                userPublicKey: input.userPublicKey,
                marketId: input.marketId,
                oracleAsset: market.oracle_asset ?? undefined,
                contractAddress: market.contract_address ?? null,
            });
        }
        catch (error) {
            const msg = String(error?.message || error || '');
            // Contract already settled but user has no position
            if (msg.includes('Error(Contract, #12)'))
                throw new exceptions_1.DomainException('You have no position in this market.');
            if (msg.includes('Error(Contract, #11)'))
                throw new exceptions_1.DomainException('You have already claimed your winnings.');
            if (msg.includes('Error(Contract, #6)'))
                throw new exceptions_1.DomainException('Market is not settled on-chain yet. Try again in a moment.');
            throw new exceptions_1.DomainException(`Failed to prepare claim: ${msg}`);
        }
        const expectedHashHex = this.stellarService.getTransactionHash(xdr);
        // Find any existing pending-claim for this user+market and reuse it
        const allTxs = await this.transactionRepository.findAll({ user_id: input.userId, market_id: input.marketId });
        const existingClaim = allTxs.find(tx => tx.tx_hash.startsWith('pending-claim:') || tx.tx_hash.startsWith('claim:'));
        if (existingClaim?.tx_hash.startsWith('claim:')) {
            throw new exceptions_1.DomainException('You have already claimed your winnings.');
        }
        const reservedTransaction = existingClaim
            ? await this.transactionRepository.update(existingClaim.id, { tx_hash: `pending-claim:${expectedHashHex}` })
            : await this.transactionRepository.create({
                tx_hash: `pending-claim:${expectedHashHex}`,
                user_id: input.userId,
                market_id: input.marketId,
                result_id: market.results[0]?.id || '',
                amount: 0,
            });
        return { xdr, transactionId: reservedTransaction.id };
    }
    async executeClaim(input) {
        const reserved = await this.transactionRepository.findById(input.transactionId);
        if (!reserved || reserved.user_id !== input.userId) {
            throw new exceptions_1.DomainException('Reserved claim transaction not found');
        }
        const submittedHashHex = this.stellarService.getTransactionHash(input.signedXdr);
        if (reserved.tx_hash !== `pending-claim:${submittedHashHex}`) {
            throw new exceptions_1.DomainException('Signed claim payload does not match the prepared transaction. Tampering detected.');
        }
        const txHash = await this.stellarService.submitSignedContractTransaction(input.signedXdr);
        const tx = await this.transactionRepository.update(reserved.id, {
            tx_hash: `claim:${txHash}`, // Prefix with claim: to differentiate from bet transactions
        });
        return { txHash, transaction: tx };
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
