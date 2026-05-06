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
        // Placeholder for Soroban transaction assembly.
        // Frontend expects an XDR string from this endpoint.
        const { marketId, outcomeId, amount } = request.body;
        if (!marketId || !outcomeId || !amount) {
            return reply.status(400).send({ error: 'Missing required trade parameters' });
        }
        return reply.status(501).send({
            error: 'Trade preparation not implemented yet',
            message: 'Implement Soroban XDR assembly in /api/trades/prepare',
        });
    };
    executeTrade = async (_request, reply) => {
        return reply.status(501).send({
            error: 'Trade execution not implemented yet',
            message: 'Implement Soroban submission + registration in /api/trades/execute',
        });
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
