use soroban_sdk::{
    contract, contractimpl, contractclient, symbol_short, token, Address, BytesN, Env, Symbol,
};
use crate::error::MarketError;
use crate::types::{Asset, Config, DataKey, MarketData, MarketStatus, PriceData};

// SEP-40 Oracle Interface
#[contractclient(name = "OracleClient")]
pub trait OracleInterface {
    fn lastprice(env: Env, asset: Asset) -> Option<PriceData>;
    fn price(env: Env, asset: Asset, timestamp: u64) -> Option<PriceData>;
}

#[contract]
pub struct ReflectorPredictionMarket;

#[contractimpl]
impl ReflectorPredictionMarket {
    /// Inicializa o contrato com as configurações globais.
    pub fn init(env: Env, admin: Address, token: Address, oracle: Address, fee_bps: u32) -> Result<(), MarketError> {
        if env.storage().persistent().has(&DataKey::Config) {
            return Err(MarketError::AlreadyInitialized);
        }
        let config = Config { admin, token, oracle, fee_bps };
        env.storage().persistent().set(&DataKey::Config, &config);
        Ok(())
    }

    /// Cria um novo mercado de predição baseado em um ativo do oráculo.
    /// Captura deterministicamente o preço de abertura no momento da criação.
    pub fn create_market(
        env: Env,
        market_id: BytesN<32>,
        asset: Symbol,
        duration_seconds: u64,
    ) -> Result<(), MarketError> {
        let config: Config = env.storage().persistent().get(&DataKey::Config).ok_or(MarketError::NotInitialized)?;
        config.admin.require_auth();

        let market_key = DataKey::Market(market_id.clone());
        if env.storage().persistent().has(&market_key) {
            return Err(MarketError::MarketAlreadyExists);
        }

        // Consulta o preço atual no Oráculo Reflector (SEP-40)
        let oracle_client = OracleClient::new(&env, &config.oracle);
        let asset_struct = Asset {
            type_code: Symbol::new(&env, "crypto"),
            symbol: asset.clone(),
        };
        let current_price_data = oracle_client.lastprice(&asset_struct).ok_or(MarketError::OracleDataInvalid)?;

        let start_time = env.ledger().timestamp();
        let end_time = start_time + duration_seconds;

        let market = MarketData {
            asset,
            open_price: current_price_data.price,
            start_time,
            end_time,
            status: MarketStatus::Open,
            pool_up: 0,
            pool_down: 0,
            winning_outcome: 0,
        };

        env.storage().persistent().set(&market_key, &market);
        
        env.events().publish(
            (symbol_short!("created"), market_id),
            (market.open_price, start_time, end_time),
        );

        Ok(())
    }

    /// Permite que um usuário aposte na subida (1) ou descida (-1) do ativo.
    pub fn place_bet(
        env: Env,
        user: Address,
        market_id: BytesN<32>,
        outcome: i32, // 1 para UP, -1 para DOWN
        amount: i128,
    ) -> Result<(), MarketError> {
        user.require_auth();

        if amount <= 0 {
            return Err(MarketError::InvalidAmount);
        }

        let market_key = DataKey::Market(market_id.clone());
        let mut market: MarketData = env.storage().persistent().get(&market_key).ok_or(MarketError::MarketNotFound)?;

        if market.status != MarketStatus::Open || env.ledger().timestamp() >= market.end_time {
            return Err(MarketError::MarketNotOpen);
        }

        let config: Config = env.storage().persistent().get(&DataKey::Config).ok_or(MarketError::NotInitialized)?;
        
        // Transferência de tokens para o contrato
        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        // Atualização das pools
        if outcome == 1 {
            market.pool_up += amount;
        } else if outcome == -1 {
            market.pool_down += amount;
        } else {
            return Err(MarketError::InvalidAmount);
        }

        env.storage().persistent().set(&market_key, &market);

        // Registro da posição do usuário
        let pos_key = DataKey::Position(user.clone(), market_id.clone(), outcome);
        let current_pos: i128 = env.storage().persistent().get(&pos_key).unwrap_or(0);
        env.storage().persistent().set(&pos_key, &(current_pos + amount));

        env.events().publish(
            (symbol_short!("bet"), market_id),
            (user, outcome, amount),
        );

        Ok(())
    }

    /// Liquida o mercado consultando o preço histórico exato no timestamp de fechamento.
    pub fn settle_market(env: Env, market_id: BytesN<32>) -> Result<(), MarketError> {
        let market_key = DataKey::Market(market_id.clone());
        let mut market: MarketData = env.storage().persistent().get(&market_key).ok_or(MarketError::MarketNotFound)?;

        if market.status == MarketStatus::Settled {
            return Err(MarketError::MarketAlreadySettled);
        }

        if env.ledger().timestamp() < market.end_time {
            return Err(MarketError::MarketNotExpired);
        }

        let config: Config = env.storage().persistent().get(&DataKey::Config).ok_or(MarketError::NotInitialized)?;
        
        // Consulta o preço histórico DETERMINÍSTICO no Oráculo para o end_time
        let oracle_client = OracleClient::new(&env, &config.oracle);
        let asset_struct = Asset {
            type_code: Symbol::new(&env, "crypto"),
            symbol: market.asset.clone(),
        };
        let close_price_data = oracle_client.price(&asset_struct, &market.end_time).ok_or(MarketError::OracleDataInvalid)?;

        // Determinação do vencedor
        if close_price_data.price > market.open_price {
            market.winning_outcome = 1;
        } else if close_price_data.price < market.open_price {
            market.winning_outcome = -1;
        } else {
            market.winning_outcome = 0; // Empate
        }

        market.status = MarketStatus::Settled;
        env.storage().persistent().set(&market_key, &market);

        env.events().publish(
            (symbol_short!("settled"), market_id),
            (close_price_data.price, market.winning_outcome),
        );

        Ok(())
    }

    /// Permite que os vencedores resgatem suas recompensas.
    pub fn claim(env: Env, user: Address, market_id: BytesN<32>) -> Result<i128, MarketError> {
        user.require_auth();

        let market_key = DataKey::Market(market_id.clone());
        let market: MarketData = env.storage().persistent().get(&market_key).ok_or(MarketError::MarketNotFound)?;

        if market.status != MarketStatus::Settled {
            return Err(MarketError::MarketNotOpen);
        }

        let claim_key = DataKey::Claimed(user.clone(), market_id.clone());
        if env.storage().persistent().has(&claim_key) {
            return Err(MarketError::AlreadyClaimed);
        }

        if market.winning_outcome == 0 {
            // Caso de empate: Devolver o capital original (UP e DOWN)
            let up_pos_key = DataKey::Position(user.clone(), market_id.clone(), 1);
            let down_pos_key = DataKey::Position(user.clone(), market_id.clone(), -1);
            let up_amt: i128 = env.storage().persistent().get(&up_pos_key).unwrap_or(0);
            let down_amt: i128 = env.storage().persistent().get(&down_pos_key).unwrap_or(0);
            let total_to_refund = up_amt + down_amt;

            if total_to_refund == 0 { return Err(MarketError::NoPosition); }

            env.storage().persistent().set(&claim_key, &true);
            let config: Config = env.storage().persistent().get(&DataKey::Config).unwrap();
            let token_client = token::Client::new(&env, &config.token);
            token_client.transfer(&env.current_contract_address(), &user, &total_to_refund);
            
            return Ok(total_to_refund);
        }

        // Caso com vencedor claro
        let pos_key = DataKey::Position(user.clone(), market_id.clone(), market.winning_outcome);
        let user_stake: i128 = env.storage().persistent().get(&pos_key).ok_or(MarketError::NoPosition)?;

        let winning_pool = if market.winning_outcome == 1 { market.pool_up } else { market.pool_down };
        let total_pool = market.pool_up + market.pool_down;

        // Payout = (stake / winning_pool) * total_pool
        let config: Config = env.storage().persistent().get(&DataKey::Config).unwrap();
        let raw_payout = (user_stake * total_pool) / winning_pool;
        
        // Aplicação da taxa de protocolo (ex: 1% = 100 bps)
        let fee_amount = (raw_payout * config.fee_bps as i128) / 10000;
        let final_payout = raw_payout - fee_amount;

        env.storage().persistent().set(&claim_key, &true);
        
        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&env.current_contract_address(), &user, &final_payout);
        // Transfere a taxa para o admin
        if fee_amount > 0 {
            token_client.transfer(&env.current_contract_address(), &config.admin, &fee_amount);
        }

        env.events().publish(
            (symbol_short!("claimed"), market_id),
            (user, final_payout),
        );

        Ok(final_payout)
    }

    // Getters para UI
    pub fn get_market(env: Env, market_id: BytesN<32>) -> Option<MarketData> {
        env.storage().persistent().get(&DataKey::Market(market_id))
    }

    pub fn get_config(env: Env) -> Option<Config> {
        env.storage().persistent().get(&DataKey::Config)
    }
}
