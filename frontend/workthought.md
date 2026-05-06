# Guia de Testes - Predict.io Frontend

Este documento descreve como testar cada funcionalidade principal da plataforma Predict.io para garantir que a integração entre o Frontend, Backend e a rede Stellar esteja funcionando corretamente.

## 1. Conexão de Carteira (Freighter)
**Objetivo:** Garantir que o frontend consegue se comunicar com a extensão Freighter.
- **Como testar:**
  1. Clique no botão **"Connect Wallet"** no canto superior direito.
  2. A extensão Freighter deve abrir solicitando permissão.
  3. Após autorizar, o botão deve exibir o endereço da sua chave pública (ex: `GC7...3K2`).
  4. O status de KYC deve aparecer ao lado (provavelmente como `none` ou `outline` inicialmente).

## 2. Autenticação (Sign-in)
**Objetivo:** Verificar o fluxo de desafio-resposta com o backend.
- **Como testar:**
  1. Após conectar a carteira, o sistema deve disparar automaticamente o fluxo de assinatura.
  2. O Freighter solicitará a assinatura de uma transação ou mensagem de desafio.
  3. Após assinar, o frontend deve receber um JWT do backend e armazená-lo no `localStorage` (pode verificar na aba *Application -> Local Storage* do navegador).
  4. Um toast de sucesso "Successfully connected!" deve aparecer.

## 3. Verificação de Identidade (KYC DIDIT)
**Objetivo:** Testar o gatilho do SDK do DIDIT.
- **Como testar:**
  1. No Navbar ou no Painel de Trading, clique em **"Verify Identity"**.
  2. O modal do DIDIT deve ser inicializado.
  3. **Simulação:** Se estiver em ambiente de teste, siga as instruções do SDK para completar a verificação.
  4. Após a conclusão, o status no Navbar deve mudar para `pending` ou `verified` (dependendo da resposta do webhook do backend).

## 4. Dashboard e Filtros
**Objetivo:** Validar a listagem e busca de mercados.
- **Como testar:**
  1. Navegue pelo dashboard principal.
  2. Use os **Tabs de Categoria** (Crypto, Politics, Sports) para filtrar os cards.
  3. Verifique se os esqueletos (skeletons) aparecem brevemente durante o carregamento.
  4. Clique em um card para ser redirecionado à página de detalhes.

## 5. Execução de Trade (Soroban)
**Objetivo:** Testar a coordenação entre contrato inteligente e banco de dados.
- **Como testar:**
  1. Na página de um mercado, selecione um resultado (ex: "Sim").
  2. Insira um valor em USDC (ex: `10`).
  3. Clique em **"Execute Trade"**.
  4. **Fluxo esperado:**
     - O backend gera o XDR da transação Soroban.
     - O Freighter abre para você assinar o depósito de USDC.
     - Após a confirmação na Ledger, o backend processa o trade e salva no banco.
  5. Um toast de "Trade executed successfully!" deve aparecer.

## 6. Portfólio e Atividade
**Objetivo:** Confirmar a persistência dos dados.
- **Como testar:**
  1. Clique em **"Portfolio"** no menu superior.
  2. Verifique se sua posição recém-comprada aparece na lista (após o processamento do backend).
  3. Navegue até **"Activity"** para ver o log da transação com o link para o Stellar.expert.

---
**Nota:** Certifique-se de que o seu arquivo `.env.local` está configurado com a `NEXT_PUBLIC_API_URL` correta e que o backend está rodando.
