import * as StellarSdk from '@stellar/stellar-sdk';
const asset = new StellarSdk.Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWTTCJM4TWCHZRRSIGXQ32E3A4MJEAGB3NZI");
console.log(typeof asset.contractId);
console.log(Object.keys(Object.getPrototypeOf(asset)));
