#![no_std]

pub mod error;
pub mod types;
pub mod contract;

#[cfg(test)]
mod test;

pub use crate::contract::ReflectorPredictionMarket;
