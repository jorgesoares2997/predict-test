# Market + Token Compatibility Guide (Soroban)

This guide explains how to deploy/update **Prediction Market** and **Token** contracts so they are compatible in runtime (`place_bet`, `transfer`, settlement).

---

## Why compatibility breaks

The Market contract calls `token::Client(...).transfer(...)` internally.

If the market was created with the wrong token address (for example, using the market contract ID instead of token contract ID), `place_bet` fails with errors like:

- `Error(Context, InvalidAction)`
- `Contract re-entry is not allowed`
- event shows `transfer [..., <MARKET_CONTRACT_ID>, ...]`

---

## Compatibility rules (must all be true)

1. **Different contract IDs**
   - `MARKET_CONTRACT_ADDRESS` = Market contract (`C...`)
   - `USDC_CONTRACT_ADDRESS` = Token contract (`C...`)
   - They must never be the same value.

2. **Token must be Soroban token contract**
   - Market expects a Soroban token contract (`token::Client`), not a classic Stellar asset config.

3. **Market creation must use correct token**
   - `create_market(..., token: Address, ...)` stores token in market state.
   - If created with wrong token, that specific market entry is invalid for betting.

4. **Decimals must match app assumptions**
   - Current app uses 7 decimals (`amount * 10^7`) in backend for bets.
   - Token contract should be initialized with `--decimal 7`.

---

## Fresh compatible deploy flow

## 1) Deploy token contract

```bash
git clone https://github.com/stellar/soroban-examples.git
cd soroban-examples/token
cargo build --target wasm32v1-none --release

stellar contract install \
  --network testnet \
  --source <ADMIN_ALIAS> \
  --wasm target/wasm32v1-none/release/soroban_token_contract.wasm
```

Use returned `WASM_HASH`:

```bash
stellar contract deploy \
  --network testnet \
  --source <ADMIN_ALIAS> \
  --wasm-hash <WASM_HASH>
```

Save result as `TOKEN_CONTRACT_ID` (`C...`).

Initialize:

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

Mint test balance to Freighter wallet:

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

## 2) Deploy market contract (or keep existing)

Deploy market contract as usual; save as `MARKET_CONTRACT_ID` (`C...`).

## 3) Backend env (mandatory)

In `backend/.env`:

```env
MARKET_CONTRACT_ADDRESS=<MARKET_CONTRACT_ID>
USDC_CONTRACT_ADDRESS=<TOKEN_CONTRACT_ID>
OPERATOR_PUBLIC_KEY=<G...>
OPERATOR_SECRET_KEY=<S...>
STELLAR_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

Restart backend after env changes.

---

## Updating existing environments safely

If contracts already exist:

1. Update backend env with correct token contract ID.
2. Restart backend.
3. **Create new markets** after env is fixed.

Important:

- Existing market entries previously created on-chain with wrong `token` cannot be trusted for betting.
- For dev/staging, easiest fix is: create a new market row and let backend register it on-chain with correct token.

---

## Validation checklist (before frontend test)

1. Contract IDs are different:
   - market: `C...`
   - token: `C...`

2. Token balance exists for wallet:

```bash
stellar contract invoke \
  --network testnet \
  --source <ADMIN_ALIAS> \
  --id <TOKEN_CONTRACT_ID> \
  -- \
  balance \
  --id <G...FREIGHTER_PUBLIC_KEY>
```

3. Backend log on trade prepare should **not** show transfer target as market contract ID.

Bad (incompatible):
- `transfer [..., <MARKET_CONTRACT_ID>, ...]`

Good:
- `transfer [..., <TOKEN_CONTRACT_ID>, ...]`

4. No `Error(Context, InvalidAction)` / `Contract re-entry is not allowed`.

---

## Common errors map

- `Error(Contract, #2)` -> `MarketNotFound`
  - Market not created on-chain yet.

- `Error(Contract, #5)` -> `MarketNotOpen`
  - Closing date already passed for this market.

- `Error(Context, InvalidAction)` with `transfer` and re-entry
  - Wrong token contract address linked to market state.

---

## Recommended operational policy

For any environment (dev/staging/prod):

1. Deploy token contract first.
2. Set backend env with token + market IDs.
3. Only then create markets from admin UI/API.
4. Never rotate token contract ID without plan for existing market migration.

