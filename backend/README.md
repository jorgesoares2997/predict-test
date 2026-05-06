# Predict-IO Backend

O Predict-IO Backend é a infraestrutura de um Prediction Market (Mercado de Previsões) totalmente descentralizado na rede Stellar (via Soroban).
Este projeto foi desenhado sob os preceitos de **Clean Architecture** e **Domain-Driven Design (DDD)**, provendo uma API resiliente, testável e escalável.

## 🛠 Tecnologias Principais

- **Linguagem:** Node.js (TypeScript)
- **Framework:** Fastify (Alta performance)
- **Banco de Dados:** PostgreSQL via Prisma ORM
- **Web3 & Blockchain:** Stellar SDK (Autenticação Ed25519 e Soroban RPC)
- **Agendamento:** `node-cron` para o Oracle Worker
- **Validação:** Zod (Validação estrita de DTOs)

---

## 🚀 Como Configurar e Rodar o Projeto

### 1. Requisitos
- Node.js (v18+)
- PostgreSQL rodando localmente (ou via Docker)

### 2. Instalação e Variáveis de Ambiente

Instale as dependências:
```bash
npm install
```

Crie o arquivo de variáveis de ambiente com base no `.env.example`:
```bash
cp .env.example .env
```

**Configurando o `.env`:**
No arquivo `.env` gerado, ajuste a variável `DATABASE_URL` para apontar para o seu banco PostgreSQL.
Exemplo:
```env
# Mude "user", "password" e "5432" caso o seu banco local tenha credenciais diferentes.
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/predictio?schema=public"

# Gere um segredo seguro (ou use qualquer string para testes locais)
JWT_SECRET="predictio-super-secret-123"

# Stellar (Por padrão configurado para a Testnet)
STELLAR_HORIZON_URL="https://horizon-testnet.stellar.org"
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
```

### 3. Configurando o Banco de Dados

Suba as tabelas do Prisma para o banco PostgreSQL configurado:
```bash
npx prisma generate
npx prisma db push
```

### 4. Iniciando o Servidor

```bash
npm run dev
```
O servidor Fastify estará rodando em `http://localhost:3000`. O Worker (Oracle) também inicializa automaticamente junto com a aplicação.

---

## 🧪 Fluxo de Testes (Como testar a API)

Abaixo o passo-a-passo para testar o fluxo de ponta a ponta usando o cURL (ou você pode importar estas requisições no Postman/Insomnia).

### Passo 1: Autenticação (Login)
O login exige a assinatura de uma mensagem com a chave privada da sua wallet Stellar (Freighter/Albedo). Para fins de teste, você pode injetar qualquer string assinada via SDK caso não queira assinar no frontend.

```bash
curl -X POST http://localhost:3000/auth/login \
-H "Content-Type: application/json" \
-d '{
  "wallet_address": "GB...SUA_PUBLIC_KEY...",
  "message": "Login in predict-io",
  "signature": "assinatura-em-hex-gerada-pela-sua-wallet"
}'
```
> **Nota:** Isso devolverá um `token` JWT. Guarde este token. Como as assinaturas Ed25519 são validadas de verdade, para "pular" e testar rápido no dev, você pode remover ou comentar a checagem no `AuthUseCase.ts` temporariamente para emitir o JWT.

### Passo 2: Simular Webhook do DIDIT (KYC)
Apenas usuários verificados podem criar mercados ou apostar. Vamos simular o webhook batendo na nossa API para verificar o usuário criado no passo 1.

```bash
curl -X POST http://localhost:3000/webhooks/didit \
-H "Content-Type: application/json" \
-d '{
  "wallet_address": "GB...SUA_PUBLIC_KEY...",
  "didit_id": "did:xyz:123",
  "status": "VERIFIED"
}'
```

### Passo 3: Criar um Mercado
Agora que o usuário é `VERIFIED`, passe o JWT no Header de autorização.

```bash
curl -X POST http://localhost:3000/markets \
-H "Content-Type: application/json" \
-H "Authorization: Bearer SEU_TOKEN_JWT" \
-d '{
  "title": "Will Bitcoin reach 100k in 2026?",
  "description": "Market predicting the price of BTC in 2026.",
  "resolution_source": "https://api.coindesk.com/v1/bpi/currentprice.json",
  "closing_date": "2026-12-31T23:59:59Z",
  "liquidate_at": "2027-01-01T12:00:00Z",
  "results": ["Yes", "No"]
}'
```
> Guarde o `id` do mercado e os `id`s das opções de resultado ("Yes", "No") para o próximo passo.

### Passo 4: Listar Mercados
Pode ser acessado de forma pública (sem JWT) para o frontend exibir.
```bash
curl -X GET "http://localhost:3000/markets?status=ACTIVE"
```

### Passo 5: Registrar uma Transação (Aposta)
Quando o usuário aposta via Smart Contract na rede Stellar, o front envia o `tx_hash` para o backend salvar e indexar. O backend confere on-chain se a transação existe.

```bash
curl -X POST http://localhost:3000/trades \
-H "Content-Type: application/json" \
-H "Authorization: Bearer SEU_TOKEN_JWT" \
-d '{
  "tx_hash": "a4d...hash_real_da_rede_testnet...",
  "market_id": "ID_DO_MERCADO_CRIADO",
  "result_id": "ID_DO_RESULTADO_YES_OU_NO",
  "amount": 50.5
}'
```
> **Nota:** Se a hash for inválida ou não pertencer à Testnet Stellar, o serviço `StellarService.ts` vai barrar a persistência na base, mantendo o princípio de Imutabilidade e Consistência.

---

## 🤖 O Oracle Worker

Você não precisa rodar rotas para liquidar (encerrar) um mercado.
O `OracleWorker.ts` roda nativamente no servidor a cada 5 minutos através do `node-cron`. 
1. Ele busca mercados ativos onde o tempo atual passou o prazo de `liquidate_at`.
2. Tranca o mercado (status `LOCKED`).
3. Consulta via HTTP a API configurada em `resolution_source`.
4. Chama o contrato Soroban passando o ID do Vencedor (via `StellarService`).
5. Atualiza o banco para `RESOLVED`.
