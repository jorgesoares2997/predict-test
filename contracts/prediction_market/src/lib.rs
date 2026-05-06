#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env,
    Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MarketError {
    MarketAlreadyExists = 1,
    MarketNotFound = 2,
    InvalidOutcomesCount = 3,
    InvalidTimestamps = 4,
    MarketNotOpen = 5,
    InvalidOutcome = 6,
    InvalidAmount = 7,
    MarketNotReadyToSettle = 8,
    MarketAlreadySettled = 9,
    NotAuthorized = 10,
    ClaimNotAvailable = 11,
    AlreadyClaimed = 12,
    NoPosition = 13,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MarketStatus {
    Open,
    Settled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Market {
    pub admin: Address,
    pub token: Address,
    pub outcomes_count: u32,
    pub closing_date: u64,
    pub liquidate_at: u64,
    pub status: MarketStatus,
    pub winning_outcome_id: Option<u32>,
    pub total_pool: i128,
}

#[contracttype]
pub enum DataKey {
    Market(BytesN<32>),
    OutcomePool(BytesN<32>, u32),       // market_id, outcome_id
    Position(Address, BytesN<32>, u32), // user, market_id, outcome_id
    Claimed(Address, BytesN<32>),       // user, market_id
}

// Events
// MarketCreated: symbol_short!("Created"), market_id
// BetPlaced: symbol_short!("Bet"), (market_id, user, outcome_id, amount)
// MarketSettled: symbol_short!("Settled"), (market_id, winning_outcome_id)
// Claimed: symbol_short!("Claimed"), (market_id, user, amount)

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

        // Update outcome pool
        let outcome_key = DataKey::OutcomePool(market_id.clone(), outcome_id);
        let current_outcome_pool: i128 = env.storage().persistent().get(&outcome_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&outcome_key, &(current_outcome_pool + amount));

        // Update user position
        let pos_key = DataKey::Position(user.clone(), market_id.clone(), outcome_id);
        let current_pos: i128 = env.storage().persistent().get(&pos_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&pos_key, &(current_pos + amount));

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

        if market.status != MarketStatus::Settled {
            return Err(MarketError::ClaimNotAvailable);
        }

        let winning_outcome_id = market.winning_outcome_id.unwrap();

        let claimed_key = DataKey::Claimed(user.clone(), market_id.clone());
        if env.storage().persistent().has(&claimed_key) {
            return Err(MarketError::AlreadyClaimed);
        }

        let pos_key = DataKey::Position(user.clone(), market_id.clone(), winning_outcome_id);
        let user_stake: i128 = env.storage().persistent().get(&pos_key).unwrap_or(0);

        if user_stake == 0 {
            return Err(MarketError::NoPosition);
        }

        let outcome_key = DataKey::OutcomePool(market_id.clone(), winning_outcome_id);
        let winning_pool: i128 = env.storage().persistent().get(&outcome_key).unwrap_or(0);

        if winning_pool == 0 {
            // Should theoretically never happen if user_stake > 0
            return Err(MarketError::NoPosition);
        }

        // Calculate proportional payout using i128 to prevent overflow
        let payout = (user_stake * market.total_pool) / winning_pool;

        // Mark as claimed
        env.storage().persistent().set(&claimed_key, &true);

        // Transfer payout
        let token_client = token::Client::new(&env, &market.token);
        token_client.transfer(&env.current_contract_address(), &user, &payout);

        env.events().publish(
            (symbol_short!("Claimed"), market_id),
            (user, payout),
        );

        Ok(payout)
    }

    // --- Read Methods ---

    pub fn get_market(env: Env, market_id: BytesN<32>) -> Option<Market> {
        let key = DataKey::Market(market_id);
        env.storage().persistent().get(&key)
    }

    pub fn get_outcome_pool(env: Env, market_id: BytesN<32>, outcome_id: u32) -> i128 {
        let key = DataKey::OutcomePool(market_id, outcome_id);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    pub fn get_position(
        env: Env,
        user: Address,
        market_id: BytesN<32>,
        outcome_id: u32,
    ) -> i128 {
        let key = DataKey::Position(user, market_id, outcome_id);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    pub fn get_claimable(env: Env, user: Address, market_id: BytesN<32>) -> Result<i128, MarketError> {
        let key = DataKey::Market(market_id.clone());
        let market: Market = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(MarketError::MarketNotFound)?;

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

        let outcome_key = DataKey::OutcomePool(market_id, winning_outcome_id);
        let winning_pool: i128 = env.storage().persistent().get(&outcome_key).unwrap_or(0);

        let payout = (user_stake * market.total_pool) / winning_pool;
        Ok(payout)
    }
}
mod test;
