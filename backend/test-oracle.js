const StellarSdk = require('@stellar/stellar-sdk');
async function run() {
  try {
    const server = new StellarSdk.rpc.Server('https://soroban-testnet.stellar.org:443');
    const reflectorId = 'CCUVXOCY2TIYP4CGCT7C5AUHHFVPWZGZ7MI45CSYBB5DUBWFPH4LRPWX';
    const contract = new StellarSdk.Contract(reflectorId);
    const op = contract.call('get_config');
    const tx = new StellarSdk.TransactionBuilder(
      await server.getAccount('GDK...'), // Wait, I don't need a real tx just to simulate!
      { fee: '100' }
    ).addOperation(op).build();
  } catch (e) {
    console.log(e);
  }
}
run();
