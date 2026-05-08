import { FastifyInstance } from 'fastify';
import { AuthController } from './controllers/AuthController';
import { WebhookController } from './controllers/WebhookController';
import { MarketController } from './controllers/MarketController';
import { TradeController } from './controllers/TradeController';
import { UserController } from './controllers/UserController';
import { ResultController } from './controllers/ResultController';
import { CategoryController } from './controllers/CategoryController';
import { authMiddleware } from './middleware/auth';

const auth = { preHandler: [authMiddleware] };

export const setupRoutes = (
  app: FastifyInstance,
  authController: AuthController,
  webhookController: WebhookController,
  marketController: MarketController,
  tradeController: TradeController,
  userController: UserController,
  resultController: ResultController,
  categoryController: CategoryController
) => {
  // Legacy public routes
  app.post('/auth/login', authController.login);
  app.post('/webhooks/didit', webhookController.diditWebhook);
  app.get('/markets', marketController.listMarkets);
  app.get('/markets/:id', marketController.getMarket);

  // API-prefixed public routes (frontend-compatible)
  app.post('/api/auth/challenge', authController.challenge);
  app.post('/api/auth/verify', authController.verify);
  app.post('/api/auth/login', authController.login);
  app.post('/api/webhooks/didit', webhookController.diditWebhook);
  app.get('/api/markets', marketController.listMarkets);
  app.get('/api/markets/:id', marketController.getMarket);
  app.get('/api/categories', categoryController.listCategories);
  app.get('/api/categories/:id', categoryController.getCategory);
  app.get('/api/results', resultController.listResults);
  app.get('/api/results/:id', resultController.getResult);
  app.get('/api/transactions', tradeController.listTransactions);
  app.get('/api/transactions/:id', tradeController.getTransaction);

  // Protected routes (JWT) — registered on the root app with preHandler so methods are always reachable
  app.post('/markets', auth, marketController.createMarket);
  app.post('/trades', auth, tradeController.registerTrade);
  app.post('/api/markets', auth, marketController.createMarket);
  app.patch('/api/markets/:id', auth, marketController.updateMarket);
  app.delete('/api/markets/:id', auth, marketController.deleteMarket);
  app.post('/api/markets/:id/migrate-token', auth, marketController.migrateMarketToken);

  app.post('/api/users', auth, userController.createUser);
  app.get('/api/users', auth, userController.listUsers);
  app.get('/api/users/:id', auth, userController.getUser);
  app.patch('/api/users/:id', auth, userController.updateUser);
  app.delete('/api/users/:id', auth, userController.deleteUser);

  app.post('/api/results', auth, resultController.createResult);
  app.patch('/api/results/:id', auth, resultController.updateResult);
  app.delete('/api/results/:id', auth, resultController.deleteResult);

  app.post('/api/transactions', auth, tradeController.createTransaction);
  app.patch('/api/transactions/:id', auth, tradeController.updateTransaction);
  app.delete('/api/transactions/:id', auth, tradeController.deleteTransaction);
  app.post('/api/trades/prepare', auth, tradeController.prepareTrade);
  app.post('/api/trades/execute', auth, tradeController.executeTrade);

  app.post('/api/categories', auth, categoryController.createCategory);
  app.patch('/api/categories/:id', auth, categoryController.updateCategory);
  app.delete('/api/categories/:id', auth, categoryController.deleteCategory);
};
