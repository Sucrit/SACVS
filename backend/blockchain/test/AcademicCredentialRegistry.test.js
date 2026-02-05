const AcademicCredentialRegistry = artifacts.require('AcademicCredentialRegistry');
const { assert } = require('chai');

contract('AcademicCredentialRegistry', (accounts) => {
  const admin = accounts[0];
  const issuer = accounts[1];
  const other = accounts[2];

  let registry;

  beforeEach(async () => {
    registry = await AcademicCredentialRegistry.new({ from: admin });
  });

  describe('Test 1: Happy Path', function () {
    it('should allow an authorized issuer to issue and verify a credential', async () => {
      await registry.authorizeIssuer(issuer, { from: admin });
      const isAuth = await registry.authorizedIssuers(issuer);
      assert.isTrue(isAuth, 'issuer should be authorized');

      const credentialId = web3.utils.soliditySha3('cred-1');
      const studentHash = web3.utils.soliditySha3('student-1');
      const documentHash = web3.utils.soliditySha3('doc-1');

      const tx = await registry.issueCredential(credentialId, studentHash, documentHash, { from: issuer });
      assert.exists(tx.receipt, 'transaction should have a receipt');
      assert.equal(tx.receipt.status, true, 'issue tx should succeed');

      // Credential hash found on "blockchain" via getCredential
      const cred = await registry.getCredential(credentialId);
      assert.equal(cred[1], documentHash, 'documentHash should match');

      // Verify returns valid true and issuer and timestamp
      const verify = await registry.verifyCredential(credentialId);
      assert.isTrue(verify[0], 'credential should be valid');
      assert.equal(verify[1], issuer, 'issuer should match');
      assert.isAbove(Number(verify[2]), 0, 'issuedAt should be set');
    });
  });

  describe('Test 2: Edge Case', function () {
    it('should return false for altered or missing credential (no crash)', async () => {
      const fakeId = web3.utils.soliditySha3('nonexistent');

      // verifyCredential should not revert and should indicate invalid
      const verifyFake = await registry.verifyCredential(fakeId);
      assert.isFalse(verifyFake[0], 'verification should fail for unknown credential');
      assert.equal(verifyFake[1], '0x0000000000000000000000000000000000000000', 'issuer should be zero address');
      assert.equal(Number(verifyFake[2]), 0, 'issuedAt should be zero');

      // Also test revoked credential
      await registry.authorizeIssuer(issuer, { from: admin });
      const credentialId = web3.utils.soliditySha3('cred-revoke');
      const studentHash = web3.utils.soliditySha3('student-x');
      const documentHash = web3.utils.soliditySha3('doc-x');

      await registry.issueCredential(credentialId, studentHash, documentHash, { from: issuer });
      // revoke as issuer
      await registry.revokeCredential(credentialId, { from: issuer });

      const verifyRevoked = await registry.verifyCredential(credentialId);
      assert.isFalse(verifyRevoked[0], 'revoked credential should not verify');
    });
  });

  describe('Test 3: Performance Test', function () {
    this.timeout(60000); // allow more time

    it('should perform verification quickly and maintain high transaction success rate', async () => {
      await registry.authorizeIssuer(issuer, { from: admin });

      const N = 100; // number of credentials to issue and verify
      const issueResults = [];  
      const issuedIds = [];

      // Issue N credentials
      for (let i = 0; i < N; i++) {
        const id = web3.utils.soliditySha3('perf-' + i + '-' + Math.random());
        const studentHash = web3.utils.soliditySha3('s-' + i + '-' + Math.random());
        const documentHash = web3.utils.soliditySha3('d-' + i + '-' + Math.random());
        try {
          const tx = await registry.issueCredential(id, studentHash, documentHash, { from: issuer });
          issueResults.push(tx.receipt && tx.receipt.status === true);
          if (tx.receipt && tx.receipt.status === true) issuedIds.push(id);
        } catch (e) {
          issueResults.push(false);
        }
      }

      const successCount = issueResults.filter(Boolean).length;
      const successRate = (successCount / N) * 100;

      // Assert transaction success rate >= 95%
      assert.isAtLeast(successRate, 95, `transaction success rate should be >= 95% (got ${successRate}%)`);

      // Run verification calls and measure time
      const start = Date.now();
      let verifyFailures = 0;

      for (let i = 0; i < N; i++) {
        // 50% of the time verify a real issued credential, otherwise verify a random non-existent id
        const useExisting = (i % 2 === 0);
        const idToCheck = useExisting && issuedIds[i/2] ? issuedIds[i/2] : web3.utils.soliditySha3('random-' + i + '-' + Math.random());
        try {
          const res = await registry.verifyCredential(idToCheck);
          // if we used an existing id we expect valid true, otherwise expect false
          if (useExisting && (!res[0])) verifyFailures++;
        } catch (e) {
          verifyFailures++;
        }
      }

      const elapsedMs = Date.now() - start;
      const avgMs = elapsedMs / N;

      // Average verification call completes in less than 5 seconds
      assert.isBelow(avgMs, 5000, `average verification should be < 5000ms (got ${avgMs}ms)`);

      // Allow up to 5% failures for verifications on existing credentials
      const allowedFailures = Math.ceil((N/2) * 0.05); // 5% of the existing checks
      assert.isAtMost(verifyFailures, allowedFailures, `verification failure count should be <= ${allowedFailures} (got ${verifyFailures})`);
    });
  });
});
