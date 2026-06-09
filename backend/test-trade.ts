import 'reflect-metadata';
import { StellarService } from './src/infrastructure/services/StellarService';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const prisma = new PrismaClient();
  const stellar = new StellarService();
  const market = await prisma.market.findFirst({ orderBy: { created_at: 'desc' }});
  console.log("Market:", market);
  if (!market) return;
  
  try {
    const xdr = await stellar.preparePlaceBetXdr({
      userPublicKey: 'GDTEKNITZO2OVH6MKR5O5JFFOXLSCHAESGZH5L5C74OCUGB6QJ5JTVBY',
      marketId: market.id,
      outcomeIndex: 1,
      amountStroops: 10000000n,
      oracleAsset: market.oracle_asset || undefined,
    });
    console.log("XDR generated:", xdr);
  } catch (e) {
    console.error("Simulation failed:", e);
  }
}
run();
