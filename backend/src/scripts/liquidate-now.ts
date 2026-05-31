import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaMarketRepository, PrismaUserRepository, PrismaTransactionRepository } from '../infrastructure/repositories/PrismaRepositories';
import { StellarService } from '../infrastructure/services/StellarService';
import { OracleUseCase } from '../application/use-cases/OracleUseCase';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const marketRepo = new PrismaMarketRepository(prisma);
  
  const stellarService = new StellarService(
    process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015'
  );

  const mockOracleService = {
    fetchResultFromSource: async () => null,
    startPolling: () => {}
  };

  const oracleUseCase = new OracleUseCase(marketRepo, mockOracleService as any, stellarService);

  console.log('Forcing liquidation check now...');
  await oracleUseCase.processLiquidations();
  console.log('Done!');
}

main().finally(() => {
  prisma.$disconnect();
  pool.end();
});
