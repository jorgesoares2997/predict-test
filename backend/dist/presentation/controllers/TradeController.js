"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeController = void 0;
const dtos_1 = require("../../application/dtos");
class TradeController {
    tradeUseCase;
    constructor(tradeUseCase) {
        this.tradeUseCase = tradeUseCase;
    }
    registerTrade = async (request, reply) => {
        const user = request.user;
        const data = dtos_1.RegisterTradeDto.parse(request.body);
        const transaction = await this.tradeUseCase.registerTrade(user.sub, user.kyc_status, data);
        return reply.status(201).send(transaction);
    };
    prepareTrade = async (request, reply) => {
        const user = request.user;
        const { marketId, outcomeId, amount } = request.body;
        if (!marketId || !outcomeId || !amount) {
            return reply.status(400).send({ error: 'Missing required trade parameters' });
        }
        const prepared = await this.tradeUseCase.prepareTrade({
            userId: user.sub,
            userPublicKey: user.wallet_address,
            marketId,
            outcomeId,
            amount,
        });
        return reply.status(200).send(prepared);
    };
    executeTrade = async (request, reply) => {
        const user = request.user;
        const { signedXDR, transactionId, marketId, outcomeId, amount } = request.body;
        if (!signedXDR || !transactionId || !marketId || !outcomeId || !amount) {
            return reply.status(400).send({ error: 'Missing required execution parameters' });
        }
        const result = await this.tradeUseCase.executeTrade({
            userId: user.sub,
            userKycStatus: user.kyc_status,
            signedXdr: signedXDR,
            transactionId,
            marketId,
            outcomeId,
            amount,
        });
        return reply.status(200).send(result);
    };
    prepareClaim = async (request, reply) => {
        const user = request.user;
        const { marketId } = request.body;
        if (!marketId) {
            return reply.status(400).send({ error: 'Missing required claim parameters' });
        }
        const prepared = await this.tradeUseCase.prepareClaim({
            userId: user.sub,
            userPublicKey: user.wallet_address,
            marketId,
        });
        return reply.status(200).send(prepared);
    };
    executeClaim = async (request, reply) => {
        const user = request.user;
        const { signedXDR, transactionId } = request.body;
        if (!signedXDR || !transactionId) {
            return reply.status(400).send({ error: 'Missing required claim execution parameters' });
        }
        const result = await this.tradeUseCase.executeClaim({
            userId: user.sub,
            signedXdr: signedXDR,
            transactionId,
        });
        return reply.status(200).send(result);
    };
    createTransaction = async (request, reply) => {
        const data = dtos_1.CreateTransactionDto.parse(request.body);
        const tx = await this.tradeUseCase.createTransaction(data);
        return reply.status(201).send(tx);
    };
    listTransactions = async (request, reply) => {
        const { user_id, market_id, result_id } = request.query;
        const txs = await this.tradeUseCase.listTransactions({ user_id, market_id, result_id });
        return reply.status(200).send(txs);
    };
    getTransaction = async (request, reply) => {
        const { id } = request.params;
        const tx = await this.tradeUseCase.getTransactionById(id);
        return reply.status(200).send(tx);
    };
    updateTransaction = async (request, reply) => {
        const { id } = request.params;
        const data = dtos_1.UpdateTransactionDto.parse(request.body);
        const tx = await this.tradeUseCase.updateTransaction(id, data);
        return reply.status(200).send(tx);
    };
    deleteTransaction = async (request, reply) => {
        const { id } = request.params;
        await this.tradeUseCase.deleteTransaction(id);
        return reply.status(204).send();
    };
}
exports.TradeController = TradeController;
