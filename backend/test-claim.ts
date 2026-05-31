import 'dotenv/config';
import { StellarService } from './src/infrastructure/services/StellarService';

const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';

const stellar = new StellarService(horizonUrl, networkPassphrase);

async function run() {
  const marketId = 'beb7430d-dfc5-4742-bbb9-b21cd5c12815';
  // we need the user's public key. Let's see if we can get it from the terminal log
  const userPublicKey = 'GDTEKNITZO2OVH6MKR5O5JFFOXLSCHAESGZH5L5C74OCUGB6QJ5JTVBY';
  
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
