# Guia de Build e Deploy (Stellar CLI)

Este guia apresenta o passo a passo completo para compilar, otimizar e fazer o deploy do contrato de Prediction Market na Testnet da Stellar, utilizando o **Stellar CLI** (substituto do antigo Soroban CLI).

## 1. Pré-requisitos

Certifique-se de ter o Rust e a target de WebAssembly instalados:
```bash
rustup update
rustup target add wasm32-unknown-unknown
```

Instale o **Stellar CLI**:
```bash
cargo install --locked stellar-cli
```
*(Verifique a instalação rodando `stellar --version`)*

## 2. Configurar a Testnet no Stellar CLI

Adicione a Testnet às configurações do seu CLI:
```bash
stellar network add \
  testnet \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"
```

Crie uma identidade (carteira/conta) que será usada para deployar o contrato (chamaremos de `admin`):
```bash
stellar keys generate admin --network testnet
```
*Isso gerará as chaves e, por estarmos apontando para a testnet, o CLI usará o Friendbot automaticamente para colocar fundos (XLM) nessa conta para pagar as taxas.*

Verifique o endereço gerado:
```bash
stellar keys address admin
```

## 3. Build e Otimização do Contrato

Na raiz do diretório do contrato (`contracts/prediction_market`), faça o build:
```bash
stellar contract build --optimize
```
O CLI gerará o arquivo WASM já compilado e otimizado no seguinte caminho: `../../target/wasm32v1-none/release/prediction_market.wasm`.

## 4. Deploy do Contrato

Faça o deploy do contrato para a Testnet (note que estamos usando o arquivo final gerado):
```bash
stellar contract deploy \
  --wasm ../../target/wasm32v1-none/release/prediction_market.wasm \
  --source admin \
  --network testnet
```
**O terminal retornará um Contract ID (ex: `C...`). Salve esse ID!** Ele será usado pelo Frontend e Backend para interagir com o contrato.

## 5. Exemplo de Interação via CLI

Apenas para testar se tudo deu certo, você pode invocar funções de leitura ou escrita pelo próprio CLI.

**Criar um Mercado (create_market):**
```bash
stellar contract invoke \
  --id SEU_CONTRACT_ID \
  --source admin \
  --network testnet \
  -- \
  create_market \
  --market_id 0000000000000000000000000000000000000000000000000000000000000000 \
  --admin $(stellar keys address admin) \
  --token ENDERECO_DO_USDC_TESTNET \
  --outcomes_count 2 \
  --closing_date 1790000000 \
  --liquidate_at 1800000000
```
*O `market_id` deve ser uma string em Hex de 32 bytes (64 caracteres hexadecimais).*

**Ler os dados do mercado:**
```bash
stellar contract invoke \
  --id SEU_CONTRACT_ID \
  --source admin \
  --network testnet \
  -- \
  get_market \
  --market_id 0000000000000000000000000000000000000000000000000000000000000000
```
