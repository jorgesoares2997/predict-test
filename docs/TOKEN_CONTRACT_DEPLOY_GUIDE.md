# Token Contract Deploy Guide (Soroban / Testnet)

This guide creates and deploys a Soroban token contract (mock USDC), then wires it to the backend so `place_bet` can transfer tokens correctly.

## Prerequisites

- Stellar CLI installed and configured
- A funded testnet account configured as source/admin (alias in Stellar CLI)
- Rust toolchain installed

---

## 1) Build the standard Soroban token contract

```bash
git clone https://github.com/stellar/soroban-examples.git
cd soroban-examples/token
cargo build --target wasm32v1-none --release
```

Expected WASM path:

`target/wasm32v1-none/release/soroban_token_contract.wasm`

---

## 2) Install WASM on testnet

```bash
stellar contract install \
  --network testnet \
  --source <ADMIN_ALIAS> \
  --wasm target/wasm32v1-none/release/soroban_token_contract.wasm
```

Copy the returned `WASM_HASH`.

---

## 3) Deploy token contract

```bash
stellar contract deploy \
  --network testnet \
  --source <ADMIN_ALIAS> \
  --wasm-hash <WASM_HASH>
```

Copy the returned `TOKEN_CONTRACT_ID` (`C...`).

---

## 4) Initialize token metadata/admin

```bash
stellar contract invoke \
  --network testnet \
  --source <ADMIN_ALIAS> \
  --id <TOKEN_CONTRACT_ID> \
  -- \
  initialize \
  --admin <G...ADMIN_PUBLIC_KEY> \
  --decimal 7 \
  --name "Mock USDC" \
  --symbol "mUSDC"
```

---

## 5) Mint token to betting wallet (Freighter)

```bash
stellar contract invoke \
  --network testnet \
  --source <ADMIN_ALIAS> \
  --id <TOKEN_CONTRACT_ID> \
  -- \
  mint \
  --to <G...FREIGHTER_PUBLIC_KEY> \
  --amount 1000000000
```

`1000000000` with 7 decimals = `100.0000000 mUSDC`.

---

## 6) Configure backend environment

In `backend/.env`:

```env
MARKET_CONTRACT_ADDRESS=<MARKET_CONTRACT_ID_C...>
USDC_CONTRACT_ADDRESS=<TOKEN_CONTRACT_ID_C...>
OPERATOR_PUBLIC_KEY=<G...ADMIN_PUBLIC_KEY>
OPERATOR_SECRET_KEY=<S...ADMIN_SECRET_KEY>
```

Important:

- `USDC_CONTRACT_ADDRESS` must be the token contract (`C...`).
- It must **not** be equal to `MARKET_CONTRACT_ADDRESS`.

Restart backend after changes:

```bash
cd /Users/jorgesoares/Desktop/projects/predict-io/backend
pnpm run dev
```

---

## 7) Sanity checks

### 7.1 Check wallet balance

```bash
stellar contract invoke \
  --network testnet \
  --source <ADMIN_ALIAS> \
  --id <TOKEN_CONTRACT_ID> \
  -- \
  balance \
  --id <G...FREIGHTER_PUBLIC_KEY>
```

### 7.2 Common integration errors

- `Error(Contract, #2)` (`MarketNotFound`): market not registered on-chain.
- `Error(Contract, #5)` (`MarketNotOpen`): closing time already passed.
- `Error(Context, InvalidAction)` with `transfer`: wrong `USDC_CONTRACT_ADDRESS` (often pointing to market contract).

---

## 8) Notes for integration agents

- Backend converts DB UUID `market_id` to `BytesN<32>` by:
  - removing hyphens (16 bytes hex),
  - left-copy into a 32-byte buffer.
- Bet amounts are sent in `i128` with 7 decimals (stroops-like units for token).
- Frontend signs trade transaction XDR returned by `/api/trades/prepare`.

