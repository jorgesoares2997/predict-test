use soroban_sdk::{
    contract, contractimpl, testutils::{Address as _, Ledger},
    Address, BytesN, Env, Symbol,
};
use crate::contract::{ReflectorPredictionMarket, ReflectorPredictionMarketClient};
use crate::types::{Price, MarketStatus};

// Mock do Oráculo Reflector
#[contract]
pub struct MockOracle;

#[contractimpl]
impl MockOracle {
    pub fn lastprice(env: Env, _asset: Symbol) -> Option<Price> {
        Some(Price {
            price: 50000000000000000, 
            timestamp: env.ledger().timestamp(),
        })
    }

    pub fn price(_env: Env, _asset: Symbol, _timestamp: u64) -> Option<Price> {
        Some(Price {
            price: 60000000000000000,
            timestamp: _timestamp,
        })
    }
}

fn create_token_contract<'a>(e: &Env, admin: &Address) -> soroban_sdk::token::Client<'a> {
    let contract_address = e.register_stellar_asset_contract(admin.clone());
    soroban_sdk::token::Client::new(e, &contract_address)
}

#[test]
fn test_successful_market_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let user_up = Address::generate(&env);
    let user_down = Address::generate(&env);

    // Registro do Oráculo Mock
    let oracle_id = env.register(MockOracle, ());

    // Registro do Token
    let token_admin = Address::generate(&env);
    let token = create_token_contract(&env, &token_admin);
    let token_admin_client = soroban_sdk::token::StellarAssetClient::new(&env, &token.address);
    token_admin_client.mint(&user_up, &1000);
    token_admin_client.mint(&user_down, &1000);

    // Registro e Inicialização do Mercado
    let contract_id = env.register(ReflectorPredictionMarket, ());
    let client = ReflectorPredictionMarketClient::new(&env, &contract_id);
    client.init(&admin, &token.address, &oracle_id, &100); // 1% fee

    let market_id = BytesN::from_array(&env, &[0; 32]);
    let asset = Symbol::new(&env, "BTC");
    let duration = 300; // 5 minutos

    env.ledger().with_mut(|li| li.timestamp = 1000);
    
    // 1. Criar Mercado (Preço Base: 5.0)
    client.create_market(&market_id, &asset, &duration);

    // 2. Apostar
    client.place_bet(&user_up, &market_id, &1, &100);
    client.place_bet(&user_down, &market_id, &-1, &200);

    assert_eq!(token.balance(&user_up), 900);
    assert_eq!(token.balance(&user_down), 800);
    assert_eq!(token.balance(&contract_id), 300);

    // 3. Liquidar (Preço Mock Settle: 6.0 > 5.0 -> UP vence)
    env.ledger().with_mut(|li| li.timestamp = 1301);
    client.settle_market(&market_id);

    let market_data = client.get_market(&market_id).unwrap();
    assert_eq!(market_data.status, MarketStatus::Settled);
    assert_eq!(market_data.winning_outcome, 1);

    // 4. Resgatar Recompensas
    let payout = client.claim(&user_up, &market_id);
    assert_eq!(payout, 297);
    assert_eq!(token.balance(&user_up), 900 + 297);
    assert_eq!(token.balance(&admin), 3); // Taxa recebida pelo admin

    // User Down tenta resgatar e falha (perdeu)
    let res = client.try_claim(&user_down, &market_id);
    assert!(res.is_err());
}
