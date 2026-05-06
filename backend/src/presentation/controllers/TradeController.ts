import { FastifyRequest, FastifyReply } from 'fastify';
import { TradeUseCase } from '../../application/use-cases/TradeUseCase';
import { CreateTransactionDto, RegisterTradeDto, UpdateTransactionDto } from '../../application/dtos';

export class TradeController {
  constructor(private readonly tradeUseCase: TradeUseCase) {}

  registerTrade = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const data = RegisterTradeDto.parse(request.body);
    
    const transaction = await this.tradeUseCase.registerTrade(user.sub, user.kyc_status, data);
    return reply.status(201).send(transaction);
  };

  prepareTrade = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { marketId, outcomeId, amount } = request.body as {
      marketId: string;
      outcomeId: string;
      amount: string;
    };
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

  executeTrade = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const { signedXDR, transactionId, marketId, outcomeId, amount } = request.body as {
      signedXDR: string;
      transactionId: string;
      marketId: string;
      outcomeId: string;
      amount: string;
    };
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

  createTransaction = async (request: FastifyRequest, reply: FastifyReply) => {
    const data = CreateTransactionDto.parse(request.body);
    const tx = await this.tradeUseCase.createTransaction(data);
    return reply.status(201).send(tx);
  };

  listTransactions = async (request: FastifyRequest, reply: FastifyReply) => {
    const { user_id, market_id, result_id } = request.query as {
      user_id?: string;
      market_id?: string;
      result_id?: string;
    };
    const txs = await this.tradeUseCase.listTransactions({ user_id, market_id, result_id });
    return reply.status(200).send(txs);
  };

  getTransaction = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const tx = await this.tradeUseCase.getTransactionById(id);
    return reply.status(200).send(tx);
  };

  updateTransaction = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const data = UpdateTransactionDto.parse(request.body);
    const tx = await this.tradeUseCase.updateTransaction(id, data);
    return reply.status(200).send(tx);
  };

  deleteTransaction = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    await this.tradeUseCase.deleteTransaction(id);
    return reply.status(204).send();
  };
}
