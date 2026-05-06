"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
// Repositories
const PrismaRepositories_1 = require("./infrastructure/repositories/PrismaRepositories");
// Services
const StellarService_1 = require("./infrastructure/services/StellarService");
const OracleService_1 = require("./infrastructure/services/OracleService");
// Use Cases
const AuthUseCase_1 = require("./application/use-cases/AuthUseCase");
const MarketUseCase_1 = require("./application/use-cases/MarketUseCase");
const TradeUseCase_1 = require("./application/use-cases/TradeUseCase");
const OracleUseCase_1 = require("./application/use-cases/OracleUseCase");
const CategoryUseCase_1 = require("./application/use-cases/CategoryUseCase");
// Controllers
const AuthController_1 = require("./presentation/controllers/AuthController");
const WebhookController_1 = require("./presentation/controllers/WebhookController");
const MarketController_1 = require("./presentation/controllers/MarketController");
const TradeController_1 = require("./presentation/controllers/TradeController");
const UserController_1 = require("./presentation/controllers/UserController");
const ResultController_1 = require("./presentation/controllers/ResultController");
const CategoryController_1 = require("./presentation/controllers/CategoryController");
// Routes and Workers
const routes_1 = require("./presentation/routes");
const OracleWorker_1 = require("./workers/OracleWorker");
const exceptions_1 = require("./domain/exceptions");
const zod_1 = require("zod");
// Force loading backend/.env regardless of current working directory.
// This prevents falling back to default port 3000 when running from repo root.
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
const server = (0, fastify_1.default)({ logger: true });
async function start() {
    await server.register(cors_1.default, {
        origin: '*', // Adjust for production
    });
    // Dependencies Initialization
    const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new adapter_pg_1.PrismaPg(pool);
    const prisma = new client_1.PrismaClient({ adapter });
    const userRepository = new PrismaRepositories_1.PrismaUserRepository(prisma);
    const categoryRepository = new PrismaRepositories_1.PrismaCategoryRepository(prisma);
    const marketRepository = new PrismaRepositories_1.PrismaMarketRepository(prisma);
    const resultRepository = new PrismaRepositories_1.PrismaResultRepository(prisma);
    const transactionRepository = new PrismaRepositories_1.PrismaTransactionRepository(prisma);
    const stellarService = new StellarService_1.StellarService(process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org', process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015');
    const oracleService = new OracleService_1.OracleService();
    const authUseCase = new AuthUseCase_1.AuthUseCase(userRepository, stellarService, process.env.JWT_SECRET);
    const categoryUseCase = new CategoryUseCase_1.CategoryUseCase(categoryRepository);
    const marketUseCase = new MarketUseCase_1.MarketUseCase(marketRepository);
    const tradeUseCase = new TradeUseCase_1.TradeUseCase(transactionRepository, marketRepository, stellarService);
    const oracleUseCase = new OracleUseCase_1.OracleUseCase(marketRepository, oracleService, stellarService);
    const authController = new AuthController_1.AuthController(authUseCase);
    const webhookController = new WebhookController_1.WebhookController(userRepository);
    const marketController = new MarketController_1.MarketController(marketUseCase);
    const tradeController = new TradeController_1.TradeController(tradeUseCase);
    const userController = new UserController_1.UserController(userRepository);
    const resultController = new ResultController_1.ResultController(resultRepository);
    const categoryController = new CategoryController_1.CategoryController(categoryUseCase);
    // Setup Routes
    (0, routes_1.setupRoutes)(server, authController, webhookController, marketController, tradeController, userController, resultController, categoryController);
    // Error handling
    server.setErrorHandler((error, request, reply) => {
        if (error instanceof zod_1.ZodError) {
            return reply.status(400).send({ error: 'Validation Error', details: error.errors });
        }
        if (error instanceof exceptions_1.DomainException) {
            return reply.status(error.statusCode).send({ error: error.message });
        }
        server.log.error(error);
        return reply.status(500).send({ error: 'Internal Server Error' });
    });
    // Start Worker
    const oracleWorker = new OracleWorker_1.OracleWorker(oracleUseCase);
    oracleWorker.start();
    // Start Server
    const port = parseInt(process.env.PORT || '3000', 10);
    try {
        await server.listen({ port, host: '0.0.0.0' });
        console.log(`Server listening at http://localhost:${port}`);
    }
    catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}
start();
