# prediction.io Contracts - Build, Deploy, Invoke Guide

This repository contains four Soroban smart contracts for a modular prediction market:

- `token_share`: SEP-41 style token contract for YES/NO/LP shares.
- `prediction_pool`: per-market AMM pool (`xy = k`) with oracle settlement.
- `prediction_router`: user entrypoint with slippage guardrails.
- `market_plane`: factory/registry to deploy and register new pools.

This guide is a practical step-by-step runbook to:

1. build Wasm artifacts,
2. deploy contracts,
3. wire RBAC/minter permissions,
4. invoke core market flows.

---

## 1) Prerequisites

Install:

- Rust (stable) and `wasm32-unknown-unknown` target
- Soroban CLI (`soroban`)
- A funded account on your target network (Testnet recommended for dev)

```bash
rustup target add wasm32-unknown-unknown
```

Configure Soroban network alias (example: Testnet):

```bash
soroban config network add --global testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
```

Generate/import identities (examples):

```bash
soroban keys generate owner
soroban keys generate ops
soroban keys generate pauser
soroban keys generate oracle
soroban keys generate trader
```

---

## 2) Build all contracts

From repo root:

```bash
cargo build --target wasm32-unknown-unknown --release
```

Expected artifacts:

- `target/wasm32-unknown-unknown/release/token_share.wasm`
- `target/wasm32-unknown-unknown/release/prediction_pool.wasm`
- `target/wasm32-unknown-unknown/release/prediction_router.wasm`
- `target/wasm32-unknown-unknown/release/market_plane.wasm`

Optional validation:

```bash
cargo check
```

---

## 3) Environment variables (recommended)

Use this shell template to avoid repeating values:

```bash
export NETWORK=testnet
export OWNER=owner
export OPS=ops
export PAUSER=pauser
export ORACLE=oracle
export TRADER=trader
```

Resolve addresses for identities:

```bash
export OWNER_ADDR="$(soroban keys address $OWNER)"
export OPS_ADDR="$(soroban keys address $OPS)"
export PAUSER_ADDR="$(soroban keys address $PAUSER)"
export ORACLE_ADDR="$(soroban keys address $ORACLE)"
export TRADER_ADDR="$(soroban keys address $TRADER)"
```

---

## 4) Deploy `token_share` contracts (YES, NO, LP)

Deploy three instances of the same Wasm:

```bash
export TOKEN_WASM=target/wasm32-unknown-unknown/release/token_share.wasm

export YES_TOKEN_ID="$(soroban contract deploy --network $NETWORK --source $OWNER --wasm $TOKEN_WASM)"
export NO_TOKEN_ID="$(soroban contract deploy --network $NETWORK --source $OWNER --wasm $TOKEN_WASM)"
export LP_TOKEN_ID="$(soroban contract deploy --network $NETWORK --source $OWNER --wasm $TOKEN_WASM)"
```

Initialize each token.

Important: set a temporary minter first (owner). After pool deployment, rotate minter to the pool contract.

```bash
soroban contract invoke --id $YES_TOKEN_ID --network $NETWORK --source $OWNER -- \
  initialize \
  --owner "$OWNER_ADDR" \
  --minter "$OWNER_ADDR" \
  --name "Prediction YES" \
  --symbol "pYES" \
  --decimals 7

soroban contract invoke --id $NO_TOKEN_ID --network $NETWORK --source $OWNER -- \
  initialize \
  --owner "$OWNER_ADDR" \
  --minter "$OWNER_ADDR" \
  --name "Prediction NO" \
  --symbol "pNO" \
  --decimals 7

soroban contract invoke --id $LP_TOKEN_ID --network $NETWORK --source $OWNER -- \
  initialize \
  --owner "$OWNER_ADDR" \
  --minter "$OWNER_ADDR" \
  --name "Prediction LP" \
  --symbol "pLP" \
  --decimals 7
```

---

## 5) USDC token setup

You need a SEP-41 compatible token contract representing USDC on your environment.

- If using existing Testnet asset contract, set `USDC_TOKEN_ID` to that contract.
- If local/dev, deploy another token contract and mint balances to test users.

```bash
export USDC_TOKEN_ID="<USDC_TOKEN_CONTRACT_ID>"
```

---

## 6) Deploy router and pool

```bash
export ROUTER_WASM=target/wasm32-unknown-unknown/release/prediction_router.wasm
export POOL_WASM=target/wasm32-unknown-unknown/release/prediction_pool.wasm

export ROUTER_ID="$(soroban contract deploy --network $NETWORK --source $OWNER --wasm $ROUTER_WASM)"
export POOL_ID="$(soroban contract deploy --network $NETWORK --source $OWNER --wasm $POOL_WASM)"
```

Initialize router:

```bash
soroban contract invoke --id $ROUTER_ID --network $NETWORK --source $OWNER -- \
  initialize \
  --owner "$OWNER_ADDR" \
  --ops_admin "$OPS_ADDR" \
  --emergency_pauser "$PAUSER_ADDR"
```

Initialize pool:

```bash
soroban contract invoke --id $POOL_ID --network $NETWORK --source $OWNER -- \
  initialize \
  --owner "$OWNER_ADDR" \
  --ops_admin "$OPS_ADDR" \
  --emergency_pauser "$PAUSER_ADDR" \
  --oracle "$ORACLE_ADDR" \
  --usdc_token "$USDC_TOKEN_ID" \
  --yes_token "$YES_TOKEN_ID" \
  --no_token "$NO_TOKEN_ID" \
  --lp_token "$LP_TOKEN_ID" \
  --fee_bps 30
```

---

## 7) Rotate token minter to pool (critical)

After pool exists, set minter of YES/NO/LP to `POOL_ID`:

```bash
soroban contract invoke --id $YES_TOKEN_ID --network $NETWORK --source $OWNER -- \
  set_minter --owner "$OWNER_ADDR" --new_minter "$POOL_ID"

soroban contract invoke --id $NO_TOKEN_ID --network $NETWORK --source $OWNER -- \
  set_minter --owner "$OWNER_ADDR" --new_minter "$POOL_ID"

soroban contract invoke --id $LP_TOKEN_ID --network $NETWORK --source $OWNER -- \
  set_minter --owner "$OWNER_ADDR" --new_minter "$POOL_ID"
```

If this step is skipped, pool mint/burn flows fail.

---

## 8) Optional: deploy and initialize `market_plane` factory

Deploy:

```bash
export PLANE_WASM=target/wasm32-unknown-unknown/release/market_plane.wasm
export PLANE_ID="$(soroban contract deploy --network $NETWORK --source $OWNER --wasm $PLANE_WASM)"
```

Get pool Wasm hash:

```bash
export POOL_WASM_HASH="$(soroban contract install --network $NETWORK --source $OWNER --wasm $POOL_WASM)"
```

Initialize factory:

```bash
soroban contract invoke --id $PLANE_ID --network $NETWORK --source $OWNER -- \
  initialize \
  --owner "$OWNER_ADDR" \
  --pool_wasm_hash "$POOL_WASM_HASH"
```

Create market via factory (replace salt with 32-byte value):

```bash
export MARKET_SALT="0000000000000000000000000000000000000000000000000000000000000042"

soroban contract invoke --id $PLANE_ID --network $NETWORK --source $OWNER -- \
  create_market \
  --owner "$OWNER_ADDR" \
  --params "{\"salt\":\"$MARKET_SALT\",\"question\":\"Will event happen before deadline?\",\"pool_owner\":\"$OWNER_ADDR\",\"ops_admin\":\"$OPS_ADDR\",\"emergency_pauser\":\"$PAUSER_ADDR\",\"oracle\":\"$ORACLE_ADDR\",\"usdc_token\":\"$USDC_TOKEN_ID\",\"yes_token\":\"$YES_TOKEN_ID\",\"no_token\":\"$NO_TOKEN_ID\",\"lp_token\":\"$LP_TOKEN_ID\",\"fee_bps\":30}"
```

Query registry:

```bash
soroban contract invoke --id $PLANE_ID --network $NETWORK --source $OWNER -- market_count
soroban contract invoke --id $PLANE_ID --network $NETWORK --source $OWNER -- get_market --market_id 1
```

---

## 9) Invoke core flows

### 9.1 Add liquidity (through router)

```bash
soroban contract invoke --id $ROUTER_ID --network $NETWORK --source $OWNER -- \
  add_liquidity \
  --pool "$POOL_ID" \
  --provider "$OWNER_ADDR" \
  --usdc_in 100000000 \
  --min_shares_out 99900000
```

### 9.2 Buy YES

`side=1` means YES, `side=2` means NO.

```bash
soroban contract invoke --id $ROUTER_ID --network $NETWORK --source $TRADER -- \
  buy_side \
  --pool "$POOL_ID" \
  --trader "$TRADER_ADDR" \
  --side 1 \
  --amount_in 1000000 \
  --min_amount_out 900000
```

### 9.3 Sell YES for USDC

```bash
soroban contract invoke --id $ROUTER_ID --network $NETWORK --source $TRADER -- \
  sell_side \
  --pool "$POOL_ID" \
  --trader "$TRADER_ADDR" \
  --side 1 \
  --max_amount_in 1500000 \
  --desired_usdc_out 1000000 \
  --min_usdc_out 990000
```

### 9.4 Oracle settlement

Resolve winner:

```bash
soroban contract invoke --id $POOL_ID --network $NETWORK --source $ORACLE -- \
  oracle_resolve --winner 1
```

### 9.5 Redeem winnings

```bash
soroban contract invoke --id $POOL_ID --network $NETWORK --source $TRADER -- \
  redeem_winnings \
  --user "$TRADER_ADDR" \
  --amount_winner_in 500000
```

---

## 10) Admin operations (RBAC)

Pause/unpause router:

```bash
soroban contract invoke --id $ROUTER_ID --network $NETWORK --source $PAUSER -- \
  set_paused --paused true
```

Pause/unpause pool:

```bash
soroban contract invoke --id $POOL_ID --network $NETWORK --source $PAUSER -- \
  set_paused --paused true
```

Update pool fee (`ops_admin` or `owner`):

```bash
soroban contract invoke --id $POOL_ID --network $NETWORK --source $OPS -- \
  set_fee_bps --caller "$OPS_ADDR" --fee_bps 50
```

Heartbeat (owner-only TTL bump):

```bash
soroban contract invoke --id $POOL_ID --network $NETWORK --source $OWNER -- \
  heartbeat --caller "$OWNER_ADDR"
```

---

## 11) Useful read calls

```bash
soroban contract invoke --id $POOL_ID --network $NETWORK --source $OWNER -- get_state
soroban contract invoke --id $YES_TOKEN_ID --network $NETWORK --source $OWNER -- total_supply
soroban contract invoke --id $YES_TOKEN_ID --network $NETWORK --source $OWNER -- balance --id "$TRADER_ADDR"
```

---

## 12) Troubleshooting checklist

- `Unauthorized` on mint/burn:
  - verify YES/NO/LP minter is set to `POOL_ID`.
- `SlippageExceeded`:
  - relax `min_amount_out`, `min_usdc_out`, or increase `max_amount_in`.
- `NotInitialized`:
  - verify `initialize` was called on all contracts.
- `Account not found`:
  - fund account on testnet friendbot.
- Token transfer failures:
  - ensure user has token balances and required auth.

---

## 13) Current implementation notes

- Contracts are intentionally educational and heavily commented.
- `prediction_pool` contains oracle settlement and AMM swap logic with safety checks.
- `prediction_router` enforces slippage parameters at the user entrypoint.
- `market_plane` supports deterministic pool deployment (`salt`) and registry state.

For production, add deeper invariant/fuzz testing, formalized upgrade policy, and indexer-backed observability before mainnet usage.
