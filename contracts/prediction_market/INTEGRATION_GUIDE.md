# Guia de Integração (Frontend & Backend Agents)

Este documento foi criado especificamente para as ferramentas/agentes que farão a integração do backend (Node.js/Fastify) e do frontend (Next.js) com o contrato de Prediction Market rodando na rede Stellar.

## Visão Geral do Contrato e DB

1. **Contrato Único:** O sistema não faz o deploy de um novo contrato para cada mercado. Ao invés disso, há um único `contract_address` global.
2. **Identificador do Mercado:** A chave de roteamento é o `market_id`, que deve ser um `BytesN<32>` (Buffer de 32 bytes). Como o banco de dados armazena um UUID em string, **o backend e frontend devem fazer um parse/hash desse UUID** antes de enviá-lo para a Blockchain (ex: usar um parse hex para 32 bytes, ou converter a string UUID sem os hífens que possui 32 caracteres hexadecimais puros, e transformar em Buffer).
3. **Decimais:** As quantias de apostas (`amount`) são trafegadas em `i128`. Um token USDC na Stellar costuma ter 7 decimais. Ex: 1 USDC = `10000000` (em stroops).

## Importações Essenciais

Vocês usarão o SDK oficial da Stellar para Node e Browser:
```typescript
import { Contract, Address, nativeToScVal, scValToNative } from '@stellar/stellar-sdk';
// Opcional, dependendo de como a chamada RPC é feita, pode ser útil:
// import { invoke } from '@stellar/stellar-sdk/contract'; 
```

---

## 1. Criar Mercado (Backend / Fastify Worker)

Logo após o backend salvar o mercado no PostgreSQL, ele deve invocar a transação on-chain para registrar o mercado no contrato.

- **Método do contrato:** `create_market`
- **Assinatura:** `(market_id: BytesN<32>, admin: Address, token: Address, outcomes_count: u32, closing_date: u64, liquidate_at: u64)`

### Código de Exemplo para Parâmetros:
```typescript
// Assumindo market.id = "550e8400-e29b-41d4-a716-446655440000"
// Transforme isso em um buffer de 32 bytes de alguma forma determinística.
// Uma forma simples é retirar os hífens (32 chars) e converter de hex:
const cleanUuid = market.id.replace(/-/g, '');
const marketIdBuffer = Buffer.from(cleanUuid, 'hex'); // Resulta num buffer de 16 bytes.
// ATENÇÃO: O contrato espera 32 bytes. Faça um pad start ou converta de forma hash.
// Sugestão: Crie um Buffer de 32 bytes e copie os 16 bytes do UUID nele.
const bytes32 = Buffer.alloc(32);
marketIdBuffer.copy(bytes32);

const args = [
  nativeToScVal(bytes32), // market_id
  new Address(process.env.OPERATOR_PUBLIC_KEY).toScVal(), // admin
  new Address(process.env.USDC_CONTRACT_ADDRESS).toScVal(), // token
  nativeToScVal(market.outcomes.length, { type: 'u32' }), // outcomes_count
  nativeToScVal(Math.floor(market.closing_date.getTime() / 1000), { type: 'u64' }),
  nativeToScVal(Math.floor(market.liquidate_at.getTime() / 1000), { type: 'u64' })
];

// Construa e assine a transação usando a chave privada do OPERATOR
```

---

## 2. Realizar Aposta / Votar (Frontend / Next.js)

O usuário acessa o frontend, conecta a carteira (Freighter), seleciona a opção (Outcome) e o valor.

- **Método do contrato:** `place_bet`
- **Assinatura:** `(user: Address, market_id: BytesN<32>, outcome_id: u32, amount: i128)`
- **Atenção:** O `outcome_id` é o **índice numérico** do outcome na sua base de dados começando em 0.

### Código de Exemplo para Parâmetros:
```typescript
// Converter marketId para bytes32 como feito no Backend
const bytes32 = ... 

// Pegar o index da opção que o usuário escolheu (0, 1, 2, etc.)
const outcomeIndex = 0; 

// Valor em decimais da Stellar (x 10^7)
const amountInStroops = Math.floor(betAmountUSD * 10_000_000);

const args = [
  new Address(userPublicKeyFromFreighter).toScVal(), // user
  nativeToScVal(bytes32), // market_id
  nativeToScVal(outcomeIndex, { type: 'u32' }), // outcome_id
  nativeToScVal(amountInStroops, { type: 'i128' }) // amount
];

// O frontend enviará essa transação (passando o ContractID global)
// O usuário vai aprovar a transação e o Auth será checado on-chain pelo token::Client e pela require_auth().
```

---

## 3. Resolver Mercado / Settle (Backend / Fastify Worker)

Quando o evento acabar na vida real e a política for atendida, o seu operator/admin do Fastify aciona o Settle.

- **Método do contrato:** `settle_market`
- **Assinatura:** `(admin: Address, market_id: BytesN<32>, winning_outcome_id: u32)`

### Código de Exemplo para Parâmetros:
```typescript
const args = [
  new Address(process.env.OPERATOR_PUBLIC_KEY).toScVal(),
  nativeToScVal(bytes32), 
  nativeToScVal(winningOutcomeIndex, { type: 'u32' }) 
];
// Assinar com o OPERATOR_SECRET_KEY
```

---

## 4. Resgatar Prêmio / Claim (Frontend / Next.js)

Qualquer usuário que votou na opção vencedora tem o direito de clicar em "Claim" na UI após o `status` do mercado mudar para `Settled`.

- **Método do contrato:** `claim`
- **Assinatura:** `(user: Address, market_id: BytesN<32>)`

### Código de Exemplo para Parâmetros:
```typescript
const args = [
  new Address(userPublicKeyFromFreighter).toScVal(),
  nativeToScVal(bytes32)
];
// Assinado pela carteira do usuário no Frontend.
// O contrato vai ler quanto o cara tinha na opção vencedora, 
// aplicar a fórmula parimutuel e mandar a quantia pro usuário.
```

---

## Retorno de Erros no Frontend

O contrato retorna Erros customizados. Se a simulação falhar no frontend ou a TX rejeitar, você receberá um status de erro do `MarketError`. O `MarketError` é um `Enum u32`:

1 = MarketAlreadyExists
2 = MarketNotFound
3 = InvalidOutcomesCount
4 = InvalidTimestamps
5 = MarketNotOpen (Ex: O usuário tentou apostar, mas a `closing_date` já passou)
6 = InvalidOutcome
7 = InvalidAmount
8 = MarketNotReadyToSettle
9 = MarketAlreadySettled
10 = NotAuthorized
11 = ClaimNotAvailable
12 = AlreadyClaimed (Ex: Usuário já clicou em claim)
13 = NoPosition (Ex: Usuário perdeu a aposta ou nem jogou)

Ao tratar erros no Next.js (via try/catch na Freighter), mapeie esses números para mensagens visuais amigáveis (ex: "Você já resgatou o prêmio deste mercado").
