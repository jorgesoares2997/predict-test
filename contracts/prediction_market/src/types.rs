use soroban_sdk::{contracttype, Address, BytesN};

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
