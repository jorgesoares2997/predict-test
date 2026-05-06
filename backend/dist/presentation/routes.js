"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = void 0;
const auth_1 = require("./middleware/auth");
const setupRoutes = (app, authController, webhookController, marketController, tradeController, userController, resultController, categoryController) => {
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
    // Protected Routes
    app.register(async (protectedApp) => {
        protectedApp.addHook('preHandler', auth_1.authMiddleware);
        protectedApp.post('/markets', marketController.createMarket);
        protectedApp.post('/trades', tradeController.registerTrade);
        protectedApp.post('/api/markets', marketController.createMarket);
        protectedApp.post('/api/trades', tradeController.registerTrade);
        protectedApp.patch('/api/markets/:id', marketController.updateMarket);
        protectedApp.delete('/api/markets/:id', marketController.deleteMarket);
        protectedApp.post('/api/users', userController.createUser);
        protectedApp.get('/api/users', userController.listUsers);
        protectedApp.get('/api/users/:id', userController.getUser);
        protectedApp.patch('/api/users/:id', userController.updateUser);
        protectedApp.delete('/api/users/:id', userController.deleteUser);
        protectedApp.post('/api/results', resultController.createResult);
        protectedApp.patch('/api/results/:id', resultController.updateResult);
        protectedApp.delete('/api/results/:id', resultController.deleteResult);
        protectedApp.post('/api/transactions', tradeController.createTransaction);
        protectedApp.patch('/api/transactions/:id', tradeController.updateTransaction);
        protectedApp.delete('/api/transactions/:id', tradeController.deleteTransaction);
        protectedApp.post('/api/trades/prepare', tradeController.prepareTrade);
        protectedApp.post('/api/trades/execute', tradeController.executeTrade);
        protectedApp.post('/api/categories', categoryController.createCategory);
        protectedApp.patch('/api/categories/:id', categoryController.updateCategory);
        protectedApp.delete('/api/categories/:id', categoryController.deleteCategory);
    });
};
exports.setupRoutes = setupRoutes;
