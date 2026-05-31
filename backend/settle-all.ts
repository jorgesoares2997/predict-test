import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { StellarService } from './src/infrastructure/services/StellarService';
import * as StellarSdk from '@stellar/stellar-sdk';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL
});
const stellarService = new StellarService(
  process.env.STELLAR_HORIZON_URL!,
  process.env.STELLAR_NETWORK_PASSPHRASE!
);

async function refreshOracleMock() {
  const sorobanRpc = process.env.STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
  const oracleMockId = process.env.ORACLE_MOCK_CONTRACT_ID || process.env.REFLECTOR_CONTRACT_ID;
  const operatorSecretKey = process.env.OPERATOR_SECRET_KEY;

  if (!oracleMockId || !operatorSecretKey) return;

  const rpcServer = new StellarSdk.rpc.Server(sorobanRpc);
  const operatorKeypair = StellarSdk.Keypair.fromSecret(operatorSecretKey);
  const source = await rpcServer.getAccount(operatorKeypair.publicKey());
  const contract = new StellarSdk.Contract(oracleMockId);

  const timestamp = Math.floor(Date.now() / 1000);
  
  for (const asset of ['ETH', 'BTC']) {
    console.log(`Refreshing ${asset} mock price at timestamp ${timestamp}...`);
    const price = asset === 'ETH' ? 300000000000000000n : 600000000000000000n;
    
    const op = contract.call(
      'set_price',
      StellarSdk.nativeToScVal(asset, { type: 'symbol' }),
      StellarSdk.nativeToScVal(price, { type: 'i128' }),
      StellarSdk.nativeToScVal(timestamp, { type: 'u64' })
    );

    const tx = new StellarSdk.TransactionBuilder(source, { fee: StellarSdk.BASE_FEE, networkPassphrase })
      .addOperation(op).setTimeout(30).build();

    const prepared = await rpcServer.prepareTransaction(tx);
    prepared.sign(operatorKeypair);
    
    const submitted = await rpcServer.sendTransaction(prepared);
    if (submitted.status !== 'ERROR') {
      console.log(`Refreshed ${asset} ok.`);
    }
  }
}

async function run() {
  await refreshOracleMock();
  // Fetch all markets that are resolved in DB but might not be settled on-chain
  const markets = await prisma.market.findMany({
    where: { status: 'RESOLVED', contract_address: { not: null } },
  });

  for (const m of markets) {
    if (!m.final_price) continue;
    
    // determine winning outcome
    const currentPrice = BigInt(m.final_price);
    const targetPrice = m.target_price ? BigInt(m.target_price) : null;
    const refPrice = targetPrice ?? (m.initial_price ? BigInt(m.initial_price) : null);
    const op = m.condition_operator ?? 'GREATER_THAN';
    let conditionMet = false;
    if (refPrice !== null) {
      if (op === 'GREATER_THAN') conditionMet = currentPrice > refPrice;
      else if (op === 'LESS_THAN') conditionMet = currentPrice < refPrice;
      else if (op === 'EQUAL') conditionMet = currentPrice === refPrice;
      else conditionMet = currentPrice > refPrice;
    }
    const winningIndex = conditionMet ? 0 : 1;

    console.log(`Settling market ${m.id} with winningIndex ${winningIndex}...`);
    try {
      await stellarService.settleMarketContract(m.id, winningIndex, m.oracle_asset || 'ETH', m.contract_address);
      console.log(`Success settling ${m.id}`);
    } catch (e: any) {
      console.log(`Failed settling ${m.id}:`, e.message || e);
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
