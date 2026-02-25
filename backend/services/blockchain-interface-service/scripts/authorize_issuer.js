const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const AcademicCredentialRegistry = artifacts.require('AcademicCredentialRegistry');

module.exports = async function (callback) {
  try {
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('BLOCKCHAIN_PRIVATE_KEY is missing in blockchain-interface-service/.env');
    }

    const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const issuer = web3.eth.accounts.privateKeyToAccount(normalizedPrivateKey).address;
    const accounts = await web3.eth.getAccounts();
    const admin = accounts[0];

    const registry = await AcademicCredentialRegistry.deployed();

    const alreadyAuthorized = await registry.authorizedIssuers(issuer);
    if (!alreadyAuthorized) {
      await registry.authorizeIssuer(issuer, { from: admin });
    }

    const minBalanceWei = BigInt(web3.utils.toWei('1', 'ether'));
    const currentBalanceWei = BigInt(await web3.eth.getBalance(issuer));
    if (currentBalanceWei < minBalanceWei) {
      await web3.eth.sendTransaction({
        from: admin,
        to: issuer,
        value: web3.utils.toWei('5', 'ether'),
      });
    }

    const authorized = await registry.authorizedIssuers(issuer);
    const balanceEth = web3.utils.fromWei(await web3.eth.getBalance(issuer), 'ether');

    console.log(
      JSON.stringify(
        {
          admin,
          issuer,
          authorized,
          balanceEth,
        },
        null,
        2,
      ),
    );

    callback();
  } catch (error) {
    callback(error);
  }
};
