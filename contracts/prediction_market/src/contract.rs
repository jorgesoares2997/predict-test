use soroban_sdk::{contract, contractimpl, symbol_short, token, Address, BytesN, Env};
use crate::error::MarketError;
use crate::types::{DataKey, Market, MarketStatus};
use crate::storage::extend_persistent;

#[contract]
pub struct PredictionMarket;

#[contractimpl]
impl PredictionMarket {
    pub fn create_market(
        env: Env,
        market_id: BytesN<32>,
        admin: Address,
        token: Address,
        outcomes_count: u32,
        closing_date: u64,
        liquidate_at: u64,
    ) -> Result<(), MarketError> {
        admin.require_auth();

        let key = DataKey::Market(market_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(MarketError::MarketAlreadyExists);
        }

        if outcomes_count < 2 {
            return Err(MarketError::InvalidOutcomesCount);
        }

        if closing_date > liquidate_at {
            return Err(MarketError::InvalidTimestamps);
        }

        let market = Market {
            admin,
            token,
            outcomes_count,
            closing_date,
            liquidate_at,
            status: MarketStatus::Open,
            winning_outcome_id: None,
            total_pool: 0,
        };

        env.storage().persistent().set(&key, &market);
        extend_persistent(&env, &key);

        env.events().publish(
            (symbol_short!("Created"), market_id),
            (),
        );

        Ok(())
    }

    pub fn place_bet(
        env: Env,
        user: Address,
        market_id: BytesN<32>,
        outcome_id: u32,
        amount: i128,
    ) -> Result<(), MarketError> {
        user.require_auth();

        if amount <= 0 {
            return Err(MarketError::InvalidAmount);
        }

        let key = DataKey::Market(market_id.clone());
        let mut market: Market = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(MarketError::MarketNotFound)?;
        extend_persistent(&env, &key);

        if market.status != MarketStatus::Open {
            return Err(MarketError::MarketNotOpen);
        }

        let current_time = env.ledger().timestamp();
        if current_time >= market.closing_date {
            return Err(MarketError::MarketNotOpen);
        }

        if outcome_id >= market.outcomes_count {
            return Err(MarketError::InvalidOutcome);
        }

        // Transfer tokens from user to contract
        let token_client = token::Client::new(&env, &market.token);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        // Update market pool
        market.total_pool += amount;
        env.storage().persistent().set(&key, &market);
        extend_persistent(&env, &key);

        // Update outcome pool
        let outcome_key = DataKey::OutcomePool(market_id.clone(), outcome_id);
        let current_outcome_pool: i128 = env.storage().persistent().get(&outcome_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&outcome_key, &(current_outcome_pool + amount));
        extend_persistent(&env, &outcome_key);

        // Update user position
        let pos_key = DataKey::Position(user.clone(), market_id.clone(), outcome_id);
        let current_pos: i128 = env.storage().persistent().get(&pos_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&pos_key, &(current_pos + amount));
        extend_persistent(&env, &pos_key);

        env.events().publish(
            (symbol_short!("Bet"), market_id.clone()),
            (user, outcome_id, amount),
        );

        Ok(())
    }

    pub fn settle_market(
        env: Env,
        admin: Address,
        market_id: BytesN<32>,
        winning_outcome_id: u32,
    ) -> Result<(), MarketError> {
        admin.require_auth();

        let key = DataKey::Market(market_id.clone());
        let mut market: Market = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(MarketError::MarketNotFound)?;
        extend_persistent(&env, &key);

        if market.admin != admin {
            return Err(MarketError::NotAuthorized);
        }

        if market.status != MarketStatus::Open {
            return Err(MarketError::MarketAlreadySettled);
        }

        let current_time = env.ledger().timestamp();
        if current_time < market.liquidate_at {
            return Err(MarketError::MarketNotReadyToSettle);
        }

        if winning_outcome_id >= market.outcomes_count {
            return Err(MarketError::InvalidOutcome);
        }

        market.status = MarketStatus::Settled;
        market.winning_outcome_id = Some(winning_outcome_id);
        env.storage().persistent().set(&key, &market);
        extend_persistent(&env, &key);

        env.events().publish(
            (symbol_short!("Settled"), market_id),
            winning_outcome_id,
        );

        Ok(())
    }

    pub fn claim(env: Env, user: Address, market_id: BytesN<32>) -> Result<i128, MarketError> {
        user.require_auth();

        let key = DataKey::Market(market_id.clone());
        let market: Market = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(MarketError::MarketNotFound)?;
        extend_persistent(&env, &key);

        if market.status != MarketStatus::Settled {
            return Err(MarketError::ClaimNotAvailable);
        }

        let claimed_key = DataKey::Claimed(user.clone(), market_id.clone());
        if env.storage().persistent().has(&claimed_key) {
            return Err(MarketError::AlreadyClaimed);
        }
        
        let winning_outcome_id = market.winning_outcome_id.unwrap();
        
        let pos_key = DataKey::Position(user.clone(), market_id.clone(), winning_outcome_id);
        let user_stake: i128 = env.storage().persistent().get(&pos_key).unwrap_or(0);
        
        if user_stake == 0 {
            return Err(MarketError::NoPosition);
        }
        extend_persistent(&env, &pos_key);

        let outcome_key = DataKey::OutcomePool(market_id.clone(), winning_outcome_id);
        let winning_pool: i128 = env.storage().persistent().get(&outcome_key).unwrap_or(0);

        if winning_pool == 0 {
            return Err(MarketError::NoPosition);
        }
        extend_persistent(&env, &outcome_key);

        let payout = (user_stake * market.total_pool) / winning_pool;

        env.storage().persistent().set(&claimed_key, &true);
        extend_persistent(&env, &claimed_key);

        let token_client = token::Client::new(&env, &market.token);
        token_client.transfer(&env.current_contract_address(), &user, &payout);

        env.events().publish(
            (symbol_short!("Claimed"), market_id),
            (user, payout),
        );

        Ok(payout)
    }

    pub fn get_market(env: Env, market_id: BytesN<32>) -> Option<Market> {
        let key = DataKey::Market(market_id);
        let res = env.storage().persistent().get(&key);
        if res.is_some() {
            extend_persistent(&env, &key);
        }
        res
    }

    pub fn get_outcome_pool(env: Env, market_id: BytesN<32>, outcome_id: u32) -> i128 {
        let key = DataKey::OutcomePool(market_id, outcome_id);
        let val = env.storage().persistent().get(&key).unwrap_or(0);
        if env.storage().persistent().has(&key) {
            extend_persistent(&env, &key);
        }
        val
    }

    pub fn get_position(
        env: Env,
        user: Address,
        market_id: BytesN<32>,
        outcome_id: u32,
    ) -> i128 {
        let key = DataKey::Position(user, market_id, outcome_id);
        let val = env.storage().persistent().get(&key).unwrap_or(0);
        if env.storage().persistent().has(&key) {
            extend_persistent(&env, &key);
        }
        val
    }

    pub fn get_claimable(env: Env, user: Address, market_id: BytesN<32>) -> Result<i128, MarketError> {
        let key = DataKey::Market(market_id.clone());
        let market: Market = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(MarketError::MarketNotFound)?;
        extend_persistent(&env, &key);

        if market.status != MarketStatus::Settled {
            return Err(MarketError::ClaimNotAvailable);
        }

        let claimed_key = DataKey::Claimed(user.clone(), market_id.clone());
        if env.storage().persistent().has(&claimed_key) {
            return Err(MarketError::AlreadyClaimed);
        }

        let winning_outcome_id = market.winning_outcome_id.unwrap();
        let pos_key = DataKey::Position(user, market_id.clone(), winning_outcome_id);
        let user_stake: i128 = env.storage().persistent().get(&pos_key).unwrap_or(0);

        if user_stake == 0 {
            return Ok(0);
        }
        extend_persistent(&env, &pos_key);

        let outcome_key = DataKey::OutcomePool(market_id, winning_outcome_id);
        let winning_pool: i128 = env.storage().persistent().get(&outcome_key).unwrap_or(0);
        if env.storage().persistent().has(&outcome_key) {
            extend_persistent(&env, &outcome_key);
        }

        let payout = (user_stake * market.total_pool) / winning_pool;
        Ok(payout)
    }

    pub fn migrate_market_token(
        env: Env,
        admin: Address,
        market_id: BytesN<32>,
        new_token: Address,
    ) -> Result<(), MarketError> {
        admin.require_auth();

        let key = DataKey::Market(market_id.clone());
        let mut market: Market = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(MarketError::MarketNotFound)?;

        if market.admin != admin {
            return Err(MarketError::NotAuthorized);
        }

        if market.status != MarketStatus::Open {
            return Err(MarketError::MarketAlreadySettled);
        }

        market.token = new_token.clone();
        env.storage().persistent().set(&key, &market);
        extend_persistent(&env, &key);

        env.events().publish(
            (symbol_short!("TokenUpd"), market_id),
            new_token,
        );

        Ok(())
    }
}
