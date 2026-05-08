use soroban_sdk::{contracterror};

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
