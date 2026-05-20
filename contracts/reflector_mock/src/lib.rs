#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Env, Symbol};

// Match the exact struct from `reflector_prediction_market`!
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

#[contract]
pub struct ReflectorMock;

#[contractimpl]
impl ReflectorMock {
    /// Permite inicializar o mock com um preço para um ativo específico.
    pub fn set_price(env: Env, asset_symbol: Symbol, price: i128, timestamp: u64) {
        let asset = Asset {
            type_code: symbol_short!("crypto"),
            symbol: asset_symbol,
        };
        let price_data = PriceData { price, timestamp };
        env.storage().persistent().set(&asset, &price_data);
    }

    /// Implementa a interface SEP-40: lastprice
    pub fn lastprice(env: Env, asset: Asset) -> Option<PriceData> {
        env.storage().persistent().get(&asset)
    }

    /// Implementa a interface SEP-40: price (mesma coisa no mock)
    pub fn price(env: Env, asset: Asset, _timestamp: u64) -> Option<PriceData> {
        env.storage().persistent().get(&asset)
    }
}
