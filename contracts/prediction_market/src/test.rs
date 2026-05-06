#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, BytesN, Env,
};
use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::token::StellarAssetClient as TokenAdminClient;

fn create_token_contract<'a>(e: &Env, admin: &Address) -> (TokenClient<'a>, TokenAdminClient<'a>) {
    let contract_address = e.register_stellar_asset_contract(admin.clone());
    (
        TokenClient::new(e, &contract_address),
        TokenAdminClient::new(e, &contract_address),
    )
}

#[test]
fn test_market_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, PredictionMarket);
    let contract = PredictionMarketClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let (token, token_admin_client) = create_token_contract(&env, &token_admin);

    // mint tokens to users
    token_admin_client.mint(&user1, &1000);
    token_admin_client.mint(&user2, &1000);

    let market_id = BytesN::from_array(&env, &[0; 32]);
    let outcomes_count = 2; // e.g. 0: Yes, 1: No
    
    env.ledger().with_mut(|li| {
        li.timestamp = 100;
    });

    let closing_date = 200;
    let liquidate_at = 300;

    contract.create_market(
        &market_id,
        &admin,
        &token.address,
        &outcomes_count,
        &closing_date,
        &liquidate_at,
    );

    // User 1 bets 100 on Yes (outcome 0)
    contract.place_bet(&user1, &market_id, &0, &100);

    // User 2 bets 200 on No (outcome 1)
    contract.place_bet(&user2, &market_id, &1, &200);

    assert_eq!(token.balance(&user1), 900);
    assert_eq!(token.balance(&user2), 800);
    assert_eq!(token.balance(&contract_id), 300);

    assert_eq!(contract.get_outcome_pool(&market_id, &0), 100);
    assert_eq!(contract.get_outcome_pool(&market_id, &1), 200);

    // Fast forward to liquidate
    env.ledger().with_mut(|li| {
        li.timestamp = 301;
    });

    // Settle market: Yes wins (outcome 0)
    contract.settle_market(&admin, &market_id, &0);

    // User 1 claims
    let payout = contract.claim(&user1, &market_id);
    // user1 stake = 100
    // total pool = 300
    // winning pool = 100
    // payout = 100 * 300 / 100 = 300
    assert_eq!(payout, 300);
    assert_eq!(token.balance(&user1), 1200);

    // User 2 cannot claim (no position in winning pool)
    let res = contract.try_claim(&user2, &market_id);
    assert!(res.is_err());
}

#[test]
fn test_claim_failures() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, PredictionMarket);
    let contract = PredictionMarketClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let (token, token_admin_client) = create_token_contract(&env, &token_admin);
    token_admin_client.mint(&user1, &1000);

    let market_id = BytesN::from_array(&env, &[1; 32]);
    
    env.ledger().with_mut(|li| {
        li.timestamp = 100;
    });

    contract.create_market(
        &market_id,
        &admin,
        &token.address,
        &2,
        &200,
        &300,
    );

    contract.place_bet(&user1, &market_id, &0, &100);

    env.ledger().with_mut(|li| {
        li.timestamp = 301;
    });

    contract.settle_market(&admin, &market_id, &0);

    // First claim succeeds
    contract.claim(&user1, &market_id);

    // Second claim fails
    let res = contract.try_claim(&user1, &market_id);
    assert_eq!(res.unwrap_err().unwrap(), MarketError::AlreadyClaimed);
}

#[test]
fn test_time_validations() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, PredictionMarket);
    let contract = PredictionMarketClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let (token, token_admin_client) = create_token_contract(&env, &token_admin);
    token_admin_client.mint(&user1, &1000);

    let market_id = BytesN::from_array(&env, &[2; 32]);
    
    env.ledger().with_mut(|li| {
        li.timestamp = 100;
    });

    contract.create_market(
        &market_id,
        &admin,
        &token.address,
        &2,
        &200,
        &300,
    );

    // Jump past closing date
    env.ledger().with_mut(|li| {
        li.timestamp = 201;
    });

    // Betting should fail
    let res = contract.try_place_bet(&user1, &market_id, &0, &100);
    assert_eq!(res.unwrap_err().unwrap(), MarketError::MarketNotOpen);

    // Settle should fail since not liquidated yet
    let res_settle = contract.try_settle_market(&admin, &market_id, &0);
    assert_eq!(res_settle.unwrap_err().unwrap(), MarketError::MarketNotReadyToSettle);
}
