use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MarketError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    MarketAlreadyExists = 3,
    MarketNotFound = 4,
    MarketNotOpen = 5,
    MarketAlreadySettled = 6,
    MarketNotExpired = 7,
    OracleDataInvalid = 8,
    InvalidAmount = 9,
    NotAuthorized = 10,
    AlreadyClaimed = 11,
    NoPosition = 12,
}
