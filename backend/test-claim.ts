import 'dotenv/config';
import { StellarService } from './src/infrastructure/services/StellarService';

const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

const stellar = new StellarService(horizonUrl, networkPassphrase);

async function run() {
  const marketId = '5519f004-b4d2-46c6-b3cb-6cc8d4785f8c';
  const userPublicKey = 'GDJGT72QVZYLWHKY7I52MNDGUID6CRW4DUPY7EPAZ2ENZBZEH3YT2XQO';
  
  console.log('Attempting to prepare claim for', userPublicKey);
  try {
    const xdr = await stellar.prepareClaimWinningsXdr({
      userPublicKey,
      marketId,
      oracleAsset: 'ETH',
      contractAddress: process.env.MARKET_CONTRACT_ADDRESS || process.env.MARKET_CONTRACT_ID
    });
    console.log('Success!', xdr.substring(0, 50));
  } catch (err: any) {
    console.error('Failed to prepare claim:', err.message || err);
  }
}

run();
