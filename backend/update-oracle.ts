import 'dotenv/config';
import * as StellarSdk from '@stellar/stellar-sdk';

async function updateOracle() {
  const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const sorobanRpc = process.env.STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
  const oracleMockId = process.env.ORACLE_MOCK_CONTRACT_ID || process.env.REFLECTOR_CONTRACT_ID;
  const operatorPublicKey = process.env.OPERATOR_PUBLIC_KEY;
  const operatorSecretKey = process.env.OPERATOR_SECRET_KEY;

  if (!oracleMockId || !operatorPublicKey || !operatorSecretKey) {
    throw new Error('Missing environment variables');
  }

  const rpcServer = new StellarSdk.rpc.Server(sorobanRpc);
  const contract = new StellarSdk.Contract(oracleMockId);

  const timestamp = Math.floor(Date.now() / 1000);
  
  for (const asset of ['BTC']) {
    const source = await rpcServer.getAccount(operatorPublicKey);
    console.log(`Updating ${asset} price to current timestamp ${timestamp}...`);
    // price = 3000 * 10^14 for ETH, 60000 * 10^14 for BTC (dummy prices, just to pass)
    const price = asset === 'ETH' ? 300000000000000000n : 600000000000000000n;
    
    const op = contract.call(
      'set_price',
      StellarSdk.nativeToScVal(asset, { type: 'symbol' }),
      StellarSdk.nativeToScVal(price, { type: 'i128' }),
      StellarSdk.nativeToScVal(timestamp, { type: 'u64' })
    );

    const tx = new StellarSdk.TransactionBuilder(source, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const prepared = await rpcServer.prepareTransaction(tx);
    prepared.sign(StellarSdk.Keypair.fromSecret(operatorSecretKey));
    
    const submitted = await rpcServer.sendTransaction(prepared);
    if (submitted.status === 'ERROR') {
      console.error('Failed:', JSON.stringify(submitted.errorResult));
    } else {
      console.log(`Sent tx for ${asset}, hash: ${submitted.hash}`);
    }
  }
}

updateOracle().catch(console.error);
