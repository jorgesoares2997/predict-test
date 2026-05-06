import { z } from 'zod';
import { KycStatus, MarketStatus } from '@prisma/client';

export const AuthLoginDto = z.object({
  wallet_address: z.string(),
  signature: z.string(),
  message: z.string(),
});

export const CreateMarketDto = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  category_id: z.string().uuid().optional(),
  status: z.nativeEnum(MarketStatus).optional(),
  contract_address: z.string().nullable().optional(),
  resolution_source: z.string().url(),
  closing_date: z.string().datetime(),
  liquidate_at: z.string().datetime(),
  results: z.array(z.string()).min(2),
});

export const RegisterTradeDto = z.object({
  tx_hash: z.string(),
  market_id: z.string().uuid(),
  result_id: z.string().uuid(),
  amount: z.number().positive(),
});

export const DiditWebhookDto = z.object({
  didit_id: z.string(),
  wallet_address: z.string(),
  status: z.nativeEnum(KycStatus),
});

export const CreateUserDto = z.object({
  wallet_address: z.string(),
  didit_id: z.string().optional(),
  kyc_status: z.nativeEnum(KycStatus).optional(),
});

export const UpdateUserDto = z.object({
  wallet_address: z.string().optional(),
  didit_id: z.string().nullable().optional(),
  kyc_status: z.nativeEnum(KycStatus).optional(),
});

export const UpdateMarketDto = z.object({
  title: z.string().min(5).optional(),
  description: z.string().min(10).optional(),
  status: z.nativeEnum(MarketStatus).optional(),
  category_id: z.string().uuid().nullable().optional(),
  contract_address: z.string().nullable().optional(),
  resolution_source: z.string().url().optional(),
  closing_date: z.string().datetime().optional(),
  liquidate_at: z.string().datetime().optional(),
  results: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
      })
    )
    .min(2)
    .optional(),
});

export const CreateResultDto = z.object({
  name: z.string().min(1),
  market_id: z.string().uuid(),
});

export const UpdateResultDto = z.object({
  name: z.string().min(1).optional(),
  market_id: z.string().uuid().optional(),
});

export const CreateTransactionDto = z.object({
  tx_hash: z.string(),
  user_id: z.string().uuid(),
  market_id: z.string().uuid(),
  result_id: z.string().uuid(),
  amount: z.number().positive(),
});

export const UpdateTransactionDto = z.object({
  tx_hash: z.string().optional(),
  user_id: z.string().uuid().optional(),
  market_id: z.string().uuid().optional(),
  result_id: z.string().uuid().optional(),
  amount: z.number().positive().optional(),
});

export const CreateCategoryDto = z.object({
  name: z.string().min(2),
});

export const UpdateCategoryDto = z.object({
  name: z.string().min(2),
});

export type AuthLoginDtoType = z.infer<typeof AuthLoginDto>;
export type CreateMarketDtoType = z.infer<typeof CreateMarketDto>;
export type RegisterTradeDtoType = z.infer<typeof RegisterTradeDto>;
export type DiditWebhookDtoType = z.infer<typeof DiditWebhookDto>;
export type CreateUserDtoType = z.infer<typeof CreateUserDto>;
export type UpdateUserDtoType = z.infer<typeof UpdateUserDto>;
export type UpdateMarketDtoType = z.infer<typeof UpdateMarketDto>;
export type CreateResultDtoType = z.infer<typeof CreateResultDto>;
export type UpdateResultDtoType = z.infer<typeof UpdateResultDto>;
export type CreateTransactionDtoType = z.infer<typeof CreateTransactionDto>;
export type UpdateTransactionDtoType = z.infer<typeof UpdateTransactionDto>;
export type CreateCategoryDtoType = z.infer<typeof CreateCategoryDto>;
export type UpdateCategoryDtoType = z.infer<typeof UpdateCategoryDto>;
