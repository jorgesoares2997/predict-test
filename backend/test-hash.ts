import * as StellarSdk from '@stellar/stellar-sdk';
const txXDR = new StellarSdk.TransactionBuilder(new StellarSdk.Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0"), { fee: StellarSdk.BASE_FEE, networkPassphrase: "Test SDF Network ; September 2015" }).addOperation(StellarSdk.Operation.payment({ destination: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", asset: StellarSdk.Asset.native(), amount: "1" })).build();
const unsigned = txXDR.toXDR();
const hash = txXDR.hash().toString('hex');
const signed = txXDR;
signed.sign(StellarSdk.Keypair.random());
const signedXdr = signed.toXDR();
const decodedSigned = StellarSdk.TransactionBuilder.fromXDR(signedXdr, "Test SDF Network ; September 2015") as StellarSdk.Transaction;
console.log(hash === decodedSigned.hash().toString('hex'));
