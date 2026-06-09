# Predict-IO 🔮

Predict-IO is a truly trustless, decentralized Prediction Market platform built on the **Stellar Network (Soroban)**. It allows users to create, trade, and settle prediction markets seamlessly using standard API events or **On-chain Oracles (Reflector Network)**.

This repository is structured as a full-stack monorepo containing the Smart Contracts, a Fastify Backend, and a modern React Frontend.

---

## ✨ Features

- **Dual Market Types:**
  - **Standard Markets:** Sourced via custom API endpoints and resolved by the backend.
  - **Oracle Markets (Reflector):** 100% Trustless and automated markets that fetch real-time cryptocurrency asset prices directly from the official Reflector Oracle Network on Stellar.
- **Trustless Settlement:** Smart contracts ensure that payouts, refunds, and resolution logic are handled strictly on-chain without centralized interference.
- **Micro-Fluctuation Handling:** Supports up to 14 decimal places of precision for granular asset price comparisons (e.g., BTC, ETH), eliminating false ties on minute timeframe markets.
- **Refunds on Draws:** If a market ends in a perfect tie, the smart contract elegantly unlocks the pool and allows participants to safely claim a 100% refund of their original stakes.
- **Clean Architecture:** Built using Domain-Driven Design (DDD), providing a resilient, testable, and highly scalable Node.js/Fastify backend API.

---

## 🏗 System Architecture

The project consists of three main pillars:

1.  **Frontend (`/frontend`)**
    - Built with React, TailwindCSS, and shadcn/ui.
    - Connects to user wallets via Stellar Freighter.
    - Handles market exploration, bet placement, and winnings claiming directly on-chain.
2.  **Backend (`/backend`)**
    - Built with Fastify, Prisma ORM, and PostgreSQL.
    - Acts as an indexer and gateway, caching on-chain market states to provide fast APIs for the frontend.
    - Contains Cron workers to monitor market expirations and trigger liquidation calls.
3.  **Smart Contracts (`/contracts`)**
    - Written in Rust for Soroban.
    - `prediction_market`: Manages standard custom API markets.
    - `reflector_prediction_market`: Integrates directly with the Reflector SEP-40 interface to fetch target prices, compare conditions (Greater, Less, Equal), and automatically allocate the winning pool.

---

## 🚀 Step-by-Step Setup Guide

### 1. Prerequisites
Ensure you have the following installed on your local machine:
- **Node.js** (v18+) & **pnpm**
- **Rust** & `wasm32-unknown-unknown` target
- **Soroban CLI** (`soroban`)
- **Docker** (for running the PostgreSQL database locally)

### 2. Smart Contracts Setup
You need to compile and deploy the contracts to the Stellar Testnet.

```bash
cd contracts
rustup target add wasm32-unknown-unknown
cargo build --target wasm32-unknown-unknown --release
```

Deploy the `prediction_market` and `reflector_prediction_market` WASMs using your Soroban CLI to Testnet and save the generated Contract IDs.

### 3. Backend Setup
The backend serves as the bridge between the database, the blockchain, and the frontend.

```bash
cd backend

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
```
Update your `.env` with the deployed Contract IDs, your Admin Wallet Secret, and DB credentials. 
We use **Supabase** for our PostgreSQL database.

```bash
# Link your local CLI to your remote Supabase Project
npx supabase login
npx supabase link --project-ref <YOUR_PROJECT_REF>

# Push the database schema to Supabase and seed initial categories
npx prisma db push
npx prisma db seed

# Start the development server
pnpm run dev
```

### 4. Frontend Setup
The frontend provides the UI for Admins to create markets and Users to place bets.

```bash
cd frontend

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local
```
Ensure your `.env.local` points to `NEXT_PUBLIC_API_URL=http://localhost:3333` and includes the correct Contract IDs.

```bash
# Start the development server
pnpm run dev
```

Visit `http://localhost:3000` to interact with Predict-IO.

---

## 🔮 Oracle Flow & Trustless Resolution

Predict-IO's crowning feature is its integration with the **Reflector Oracle**.

**How it works:**
1.  **Creation:** An Admin creates a market specifying an asset (e.g., "BTC", which is mapped to the exact stellar token address), a target price, and a condition (e.g., "> $65,000").
2.  **Trading:** Users bet "Yes" or "No" by locking USDC directly into the smart contract.
3.  **Liquidation:** When the deadline is reached, anyone (or the backend cron worker) can invoke the `settle_market` function on-chain.
4.  **Trustless Judgment:** The contract *internally* calls the Reflector Oracle Contract's `lastprice(asset)` function to fetch the unadulterated, consensus-driven price of the asset.
5.  **Payout / Refund:** The contract evaluates the condition. If a winner is determined, the pool is unlocked for proportional claiming. If there is an exact tie, the contract unlocks refunds, allowing users to withdraw their exact deposited amount.

*Note on Environments: In Testnet, you may utilize a `ReflectorMock` contract using `Asset::Other(Symbol)`. In Production (Mainnet), the system queries the official Reflector Network directly using `Asset::Stellar(Address)`, guaranteeing 100% decentralized data.*
