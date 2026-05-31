import 'dotenv/config';
import * as StellarSdk from '@stellar/stellar-sdk';

async function fixTrustline() {
  const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
  
  const operatorSecret = process.env.OPERATOR_SECRET_KEY;
  if (!operatorSecret) throw new Error('No OPERATOR_SECRET_KEY');
  
  const operatorKeypair = StellarSdk.Keypair.fromSecret(operatorSecret);
  const server = new StellarSdk.Horizon.Server(horizonUrl);
  
  const source = await server.loadAccount(operatorKeypair.publicKey());
  
  // From the event log: "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
  const usdcAsset = new StellarSdk.Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');
  
  const tx = new StellarSdk.TransactionBuilder(source, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(StellarSdk.Operation.changeTrust({
      asset: usdcAsset,
    }))
    .setTimeout(30)
    .build();

  tx.sign(operatorKeypair);
  
  const result = await server.submitTransaction(tx);
  console.log('Trustline added! Tx hash:', result.hash);
}

fixTrustline().catch(console.error);
