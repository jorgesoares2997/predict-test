import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// Repositories
import {
  PrismaUserRepository,
  PrismaCategoryRepository,
  PrismaMarketRepository,
  PrismaResultRepository,
  PrismaTransactionRepository,
} from './infrastructure/repositories/PrismaRepositories';

// Services
import { StellarService } from './infrastructure/services/StellarService';
import { OracleService } from './infrastructure/services/OracleService';

// Use Cases
import { AuthUseCase } from './application/use-cases/AuthUseCase';
import { MarketUseCase } from './application/use-cases/MarketUseCase';
import { TradeUseCase } from './application/use-cases/TradeUseCase';
import { OracleUseCase } from './application/use-cases/OracleUseCase';
import { CategoryUseCase } from './application/use-cases/CategoryUseCase';

// Controllers
import { AuthController } from './presentation/controllers/AuthController';
import { WebhookController } from './presentation/controllers/WebhookController';
import { MarketController } from './presentation/controllers/MarketController';
import { TradeController } from './presentation/controllers/TradeController';
import { UserController } from './presentation/controllers/UserController';
import { ResultController } from './presentation/controllers/ResultController';
import { CategoryController } from './presentation/controllers/CategoryController';

// Routes and Workers
import { setupRoutes } from './presentation/routes';
import { OracleWorker } from './workers/OracleWorker';
import { DomainException } from './domain/exceptions';
import { ZodError } from 'zod';

// Force loading backend/.env regardless of current working directory.
// This prevents falling back to default port 3000 when running from repo root.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const server = Fastify({ logger: true });

async function start() {
  // Default @fastify/cors methods are only GET,HEAD,POST — browsers block PATCH/DELETE cross-origin
  // after preflight unless Allow-Methods includes them (you only saw OPTIONS in logs).
  await server.register(cors, {
    origin: '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Dependencies Initialization
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  
  const userRepository = new PrismaUserRepository(prisma);
  const categoryRepository = new PrismaCategoryRepository(prisma);
  const marketRepository = new PrismaMarketRepository(prisma);
  const resultRepository = new PrismaResultRepository(prisma);
  const transactionRepository = new PrismaTransactionRepository(prisma);

  const stellarService = new StellarService(
    process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015'
  );
  const oracleService = new OracleService();

  const authUseCase = new AuthUseCase(userRepository, stellarService, process.env.JWT_SECRET as string);
  const categoryUseCase = new CategoryUseCase(categoryRepository);
  const marketUseCase = new MarketUseCase(marketRepository, stellarService);
  const tradeUseCase = new TradeUseCase(transactionRepository, marketRepository, stellarService);
  const oracleUseCase = new OracleUseCase(marketRepository, oracleService, stellarService);

  const authController = new AuthController(authUseCase);
  const webhookController = new WebhookController(userRepository);
  const marketController = new MarketController(marketUseCase);
  const tradeController = new TradeController(tradeUseCase);
  const userController = new UserController(userRepository);
  const resultController = new ResultController(resultRepository);
  const categoryController = new CategoryController(categoryUseCase);

  // Setup Routes
  setupRoutes(
    server,
    authController,
    webhookController,
    marketController,
    tradeController,
    userController,
    resultController,
    categoryController
  );

  // Error handling
  server.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: 'Validation Error', details: (error as any).errors });
    }
    if (error instanceof DomainException) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    server.log.error(error);
    return reply.status(500).send({ error: 'Internal Server Error' });
  });

  // Start Worker
  const oracleWorker = new OracleWorker(oracleUseCase);
  oracleWorker.start();

  // Start Server
  const port = parseInt(process.env.PORT || '3000', 10);
  try {
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening at http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
