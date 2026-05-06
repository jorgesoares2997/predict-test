# Prediction Market Soroban Contract

This is the Soroban (Stellar) smart contract for the Predict-io platform. It implements a parimutuel prediction market model where users can bet on different outcomes, and winners receive a proportional share of the total pool.

## Features
- Create markets with customized closing dates and liquidation dates.
- Single contract capable of managing multiple markets using `market_id` mappings.
- Parimutuel payouts calculated mathematically on-chain without precision loss (using `i128`).
- Robust permission management where each market has an assigned `admin` (operator).
- Prevention of double-claims and betting after market close.

## Prerequisites
- Rust `1.80+`
- `stellar-cli` instalado.
- `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`

## Guias

Para manter a documentação organizada e focada, dividimos as instruções em dois guias principais:

1. **[Guia de Deploy (DEPLOYMENT_GUIDE.md)](./DEPLOYMENT_GUIDE.md)**: Passos detalhados para você usar o `stellar-cli` para compilar, gerar identidades, e fazer o deploy e interações CLI na rede de teste.
2. **[Guia de Integração (INTEGRATION_GUIDE.md)](./INTEGRATION_GUIDE.md)**: Guia completo para os agentes AI que estão desenvolvendo o frontend (Next.js) e o backend (Node/Fastify), cobrindo como interagir com o contrato usando o SDK da Stellar.

## Testes Automatizados

O contrato possui uma suíte de testes robusta simulando o ciclo de vida do mercado e as restrições:
```bash
cargo test
```


## Future Improvements & Limitations
- **AMM / Liquidity Providers:** Currently, this is a strict parimutuel pool. Adding an AMM (like LMSR or CPMM) would allow for real-time odds calculation and users to buy/sell shares before the event closes.
- **Dispute Window:** The current settlement is final. A dispute phase could be added allowing users to challenge the operator's decision by posting a bond.
- **Oracle Integration:** Integration with a decentralized oracle (like Chainlink on Stellar) could bypass the need for an operator address completely.
