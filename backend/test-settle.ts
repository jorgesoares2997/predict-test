import 'dotenv/config';
import { StellarService } from './src/infrastructure/services/StellarService';

const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

const stellar = new StellarService(horizonUrl, networkPassphrase);

async function run() {
  const marketId = '5519f004-b4d2-46c6-b3cb-6cc8d4785f8c';
  console.log('Attempting to settle market', marketId);
  try {
    await stellar.settleMarketContract(marketId, 0, 'BTC', process.env.MARKET_CONTRACT_ADDRESS || process.env.MARKET_CONTRACT_ID);
    console.log('Success!');
  } catch (err: any) {
    console.error('Failed to settle market:', err.message || err);
  }
}

run();
