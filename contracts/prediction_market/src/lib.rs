#![no_std]

pub mod error;
pub mod types;
pub mod storage;
pub mod contract;

pub use crate::error::MarketError;
pub use crate::types::{Market, MarketStatus, DataKey};
pub use crate::contract::*;

#[cfg(test)]
mod test;
