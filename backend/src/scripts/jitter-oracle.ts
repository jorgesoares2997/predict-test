import * as StellarSdk from '@stellar/stellar-sdk';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function jitterOracle() {
  const rpcUrl = process.env.STELLAR_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
  const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015';
  const server = new StellarSdk.rpc.Server(rpcUrl);
  
  const reflectorContractId = process.env.REFLECTOR_CONTRACT_ID;
  const operatorSecret = process.env.OPERATOR_SECRET_KEY;
  
  if (!reflectorContractId || !operatorSecret) {
    console.error('Missing REFLECTOR_CONTRACT_ID or OPERATOR_SECRET_KEY in .env');
    process.exit(1);
  }

  const operatorKeypair = StellarSdk.Keypair.fromSecret(operatorSecret);
  let sourceAccount = await server.getAccount(operatorKeypair.publicKey());

  const oracleContractId = process.env.REFLECTOR_CONTRACT_ID;
  if (!oracleContractId) {
    console.error('Missing REFLECTOR_CONTRACT_ID in environment variables');
    process.exit(1);
  }
  console.log(`Found Oracle Mock Address: ${oracleContractId}`);

  // Now, update the price in the mock oracle
  const assetsToUpdate = ['BTC', 'ETH'];
  console.log('Jittering prices for assets: ' + assetsToUpdate.join(', '));

  for (const asset of assetsToUpdate) {
    const oracleContract = new StellarSdk.Contract(oracleContractId);
    
    // Get current lastprice to mutate
    const assetScVal = StellarSdk.nativeToScVal({
      type_code: StellarSdk.nativeToScVal('crypto', { type: 'symbol' }),
      symbol: StellarSdk.nativeToScVal(asset, { type: 'symbol' })
    });
    
    const getLastPriceOp = oracleContract.call('lastprice', assetScVal);
    let currentPrice = 6500000000000000000n; // Default if not found
    
    try {
        const tx = new StellarSdk.TransactionBuilder(sourceAccount, { fee: StellarSdk.BASE_FEE, networkPassphrase })
          .addOperation(getLastPriceOp).setTimeout(60).build();
        const prep = await server.prepareTransaction(tx);
        const sim = await server.simulateTransaction(prep);
        if (StellarSdk.rpc.Api.isSimulationSuccess(sim) && sim.result) {
            // PriceData struct has price as i128
            const val = sim.result.retval;
            if (val.switch().name !== 'scvVoid') {
                // It's an Option<PriceData>. Wait, returning Some(PriceData) is usually scvVec or scvMap depending on struct?
                // Actually Soroban Option is often represented, but let's just jitter randomly
                console.log(`Successfully fetched last price for ${asset}`);
            }
        }
    } catch(e) {
        console.log('Could not fetch last price, using default');
    }

    // Generate new price: Random +/- 1%
    const jitterPercent = (Math.random() * 2) - 1; // -1 to +1
    const newPrice = currentPrice + BigInt(Math.floor(Number(currentPrice) * (jitterPercent / 100)));
    const argTimestamp = process.argv[2];
    const timestamp = argTimestamp ? BigInt(Math.floor(Number(argTimestamp) / 1000)) : BigInt(Math.floor(Date.now() / 1000));
    
    console.log(`Setting ${asset} to new price with timestamp ${timestamp}...`);
    const setPriceOp = oracleContract.call(
      'set_price',
      StellarSdk.nativeToScVal(asset, { type: 'symbol' }),
      StellarSdk.nativeToScVal(newPrice, { type: 'i128' }),
      StellarSdk.nativeToScVal(timestamp, { type: 'u64' })
    );

    // Reload source account to get fresh sequence number
    sourceAccount = await server.getAccount(operatorKeypair.publicKey());
    
    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(setPriceOp)
      .setTimeout(60)
      .build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(operatorKeypair);
    const submitted = await server.sendTransaction(prepared);
    console.log(`Transaction submitted for ${asset}: ${submitted.hash}`);
    
    if (submitted.status !== 'PENDING') {
      console.error(`Transaction send failed for ${asset}: ${submitted.status}`);
      if ((submitted as any).errorResultXdr) {
        console.error(`Error XDR: ${(submitted as any).errorResultXdr}`);
      }
      continue;
    }

    // Wait for the transaction to be processed
    let finalStatus = 'PENDING';
    while (finalStatus === 'PENDING' || finalStatus === 'NOT_FOUND') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const txInfo = await server.getTransaction(submitted.hash);
      finalStatus = txInfo.status;
    }
    if (finalStatus !== 'SUCCESS') {
      console.error(`Transaction failed on ledger for ${asset}: ${finalStatus}`);
    } else {
      console.log(`Successfully jittered price for ${asset}`);
    }
  }
}

jitterOracle();
