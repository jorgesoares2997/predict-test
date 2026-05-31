import * as StellarSdk from '@stellar/stellar-sdk';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const server = new StellarSdk.rpc.Server(process.env.STELLAR_SOROBAN_RPC_URL || '', { allowHttp: true });
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || '';
  const oracleContractId = process.env.ORACLE_MOCK_CONTRACT_ID || '';
  const operatorSecret = process.env.OPERATOR_SECRET_KEY || '';

  const operatorKeypair = StellarSdk.Keypair.fromSecret(operatorSecret);
  const oracleContract = new StellarSdk.Contract(oracleContractId);

  const asset = 'ETH';
  const newPrice = 3500000000000000000n; // arbitrary price
  const timestamp = 1780070402n; // EXACT on-chain end_time!

  const setPriceOp = oracleContract.call(
    'set_price',
    StellarSdk.nativeToScVal(asset, { type: 'symbol' }),
    StellarSdk.nativeToScVal(newPrice, { type: 'i128' }),
    StellarSdk.nativeToScVal(timestamp, { type: 'u64' })
  );

  const sourceAccount = await server.getAccount(operatorKeypair.publicKey());
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(setPriceOp)
    .setTimeout(60)
    .build();

  console.log('Preparing tx...');
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(operatorKeypair);
  
  console.log('Sending tx...');
  const submitted = await server.sendTransaction(prepared);
  
  let finalStatus = 'PENDING';
  while (finalStatus === 'PENDING' || finalStatus === 'NOT_FOUND') {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const txInfo = await server.getTransaction(submitted.hash);
    finalStatus = txInfo.status;
  }
  console.log('Status:', finalStatus);
}
main();
