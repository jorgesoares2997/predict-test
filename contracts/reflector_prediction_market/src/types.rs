use soroban_sdk::{contracttype, Address, BytesN, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MarketStatus {
    Open,
    Settled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarketData {
    pub asset: Symbol,
    pub open_price: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub status: MarketStatus,
    pub pool_up: i128,
    pub pool_down: i128,
    pub winning_outcome: i32, // 1: Up, -1: Down, 0: Draw
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub token: Address,
    pub oracle: Address,
    pub fee_bps: u32, // Protocol fee in basis points (e.g., 100 = 1%)
}

#[contracttype]
pub enum DataKey {
    Config,
    Market(BytesN<32>),
    Position(Address, BytesN<32>, i32), // User, MarketID, Outcome (1 for Up, -1 for Down)
    Claimed(Address, BytesN<32>),       // User, MarketID
}

// SEP-40 compliant Asset and PriceData structures for Reflector Oracle
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Asset {
    pub type_code: Symbol,
    pub symbol: Symbol,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}
