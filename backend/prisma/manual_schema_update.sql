-- Run this script in your Postgres database before restarting backend.
-- Adds user profile fields and market/result liquidity metrics.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT;

ALTER TABLE "Market"
  ADD COLUMN IF NOT EXISTS "total_locked_value" DECIMAL NOT NULL DEFAULT 0;

ALTER TABLE "Result"
  ADD COLUMN IF NOT EXISTS "total_shares" DECIMAL NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "current_price" DECIMAL NOT NULL DEFAULT 0;
