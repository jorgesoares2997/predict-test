use soroban_sdk::{Env};
use crate::types::DataKey;

pub const DAY_IN_LEDGERS: u32 = 17280;
pub const BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
pub const BUMP_THRESHOLD: u32 = 15 * DAY_IN_LEDGERS;

pub fn extend_persistent(env: &Env, key: &DataKey) {
    env.storage().persistent().extend_ttl(key, BUMP_THRESHOLD, BUMP_AMOUNT);
}
