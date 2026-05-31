-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('ACTIVE', 'LOCKED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ConditionOperator" AS ENUM ('GREATER_THAN', 'LESS_THAN', 'EQUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "didit_id" TEXT,
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "MarketStatus" NOT NULL DEFAULT 'ACTIVE',
    "total_locked_value" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "category_id" TEXT,
    "contract_address" TEXT,
    "resolution_source" TEXT NOT NULL,
    "closing_date" TIMESTAMP(3) NOT NULL,
    "liquidate_at" TIMESTAMP(3) NOT NULL,
    "oracle_asset" TEXT,
    "open_price" DECIMAL(65,30) DEFAULT 0,
    "initial_price" TEXT,
    "final_price" TEXT,
    "oracle_contract_address" TEXT,
    "oracle_decimals" INTEGER,
    "target_price" TEXT,
    "condition_operator" "ConditionOperator",

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "total_shares" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "current_price" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "market_id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_address_key" ON "User"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_tx_hash_key" ON "Transaction"("tx_hash");

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_market_id_fkey" FOREIGN KEY ("market_id") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "Result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
