"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCategoryDto = exports.CreateCategoryDto = exports.UpdateTransactionDto = exports.CreateTransactionDto = exports.UpdateResultDto = exports.CreateResultDto = exports.UpdateMarketDto = exports.UpdateUserDto = exports.CreateUserDto = exports.DiditWebhookDto = exports.RegisterTradeDto = exports.CreateMarketDto = exports.AuthLoginDto = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.AuthLoginDto = zod_1.z.object({
    wallet_address: zod_1.z.string(),
    signature: zod_1.z.string(),
    message: zod_1.z.string(),
});
exports.CreateMarketDto = zod_1.z.object({
    title: zod_1.z.string().min(5),
    description: zod_1.z.string().min(10),
    category_id: zod_1.z.string().uuid().optional(),
    resolution_source: zod_1.z.string().url(),
    closing_date: zod_1.z.string().datetime(),
    liquidate_at: zod_1.z.string().datetime(),
    results: zod_1.z.array(zod_1.z.string()).min(2),
});
exports.RegisterTradeDto = zod_1.z.object({
    tx_hash: zod_1.z.string(),
    market_id: zod_1.z.string().uuid(),
    result_id: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
});
exports.DiditWebhookDto = zod_1.z.object({
    didit_id: zod_1.z.string(),
    wallet_address: zod_1.z.string(),
    status: zod_1.z.nativeEnum(client_1.KycStatus),
});
exports.CreateUserDto = zod_1.z.object({
    wallet_address: zod_1.z.string(),
    didit_id: zod_1.z.string().optional(),
    kyc_status: zod_1.z.nativeEnum(client_1.KycStatus).optional(),
});
exports.UpdateUserDto = zod_1.z.object({
    wallet_address: zod_1.z.string().optional(),
    didit_id: zod_1.z.string().nullable().optional(),
    kyc_status: zod_1.z.nativeEnum(client_1.KycStatus).optional(),
});
exports.UpdateMarketDto = zod_1.z.object({
    title: zod_1.z.string().min(5).optional(),
    description: zod_1.z.string().min(10).optional(),
    status: zod_1.z.nativeEnum(client_1.MarketStatus).optional(),
    category_id: zod_1.z.string().uuid().nullable().optional(),
    contract_address: zod_1.z.string().nullable().optional(),
    resolution_source: zod_1.z.string().url().optional(),
    closing_date: zod_1.z.string().datetime().optional(),
    liquidate_at: zod_1.z.string().datetime().optional(),
});
exports.CreateResultDto = zod_1.z.object({
    name: zod_1.z.string().min(1),
    market_id: zod_1.z.string().uuid(),
});
exports.UpdateResultDto = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    market_id: zod_1.z.string().uuid().optional(),
});
exports.CreateTransactionDto = zod_1.z.object({
    tx_hash: zod_1.z.string(),
    user_id: zod_1.z.string().uuid(),
    market_id: zod_1.z.string().uuid(),
    result_id: zod_1.z.string().uuid(),
    amount: zod_1.z.number().positive(),
});
exports.UpdateTransactionDto = zod_1.z.object({
    tx_hash: zod_1.z.string().optional(),
    user_id: zod_1.z.string().uuid().optional(),
    market_id: zod_1.z.string().uuid().optional(),
    result_id: zod_1.z.string().uuid().optional(),
    amount: zod_1.z.number().positive().optional(),
});
exports.CreateCategoryDto = zod_1.z.object({
    name: zod_1.z.string().min(2),
});
exports.UpdateCategoryDto = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
});
