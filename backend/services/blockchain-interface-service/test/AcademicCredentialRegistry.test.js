const AcademicCredentialRegistry = artifacts.require('AcademicCredentialRegistry');
const { assert } = require('chai');

contract('AcademicCredentialRegistry', (accounts) => {
  const admin = accounts[0];
  const issuer = accounts[1];
  const other = accounts[2];

  let registry;
  const short = (h) => (typeof h === 'string' ? (h.slice(0,10) + '...' + h.slice(-6)) : h);

  beforeEach(async () => {
    registry = await AcademicCredentialRegistry.new({ from: admin });
  });

  /*
   Step 1: Ensure an authorized issuer can successfully issue a credential
   *and that the credential can be retrieved and verified correctly.
   */
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
      assert.equal(tx.receipt.status, true, 'issue transaction should succeed');

      const cred = await registry.getCredential(credentialId);
      assert.equal(cred[1], documentHash, 'documentHash stored on-chain should match the issued document hash');

      const t0 = Date.now();
      const verify = await registry.verifyCredential(credentialId);
      const t1 = Date.now();
      const verifyMs = t1 - t0;

      assert.isTrue(verify[0], 'verifyCredential should report the credential as valid');
      assert.equal(verify[1], issuer, 'verifyCredential should return the correct issuer address');
      assert.isAbove(Number(verify[2]), 0, 'verifyCredential should return a non-zero issuedAt timestamp');

      console.log(`\n[Test 1] Authorized issuer ${issuer} issued credential ${short(credentialId)}.`);
      console.log(`   Document hash on-chain: ${short(cred[1])}`);
      console.log(`   Verification: valid=${verify[0]}, issuer=${verify[1]}, issuedAt=${verify[2]} (verified in ${verifyMs}ms)\n`);
    });
  });

  /*
   Test 2: Validate system behavior for invalid inputs and revoked credentials.
   Checks:
   - Verifying a non-existent credential must return invalid without reverting
   - Verifying a revoked credential must return invalid
   */
  describe('Test 2: Edge Case', function () {
    it('should return false for altered or missing credential (no crash)', async () => {
      const fakeId = web3.utils.soliditySha3('nonexistent');

      const verifyFake = await registry.verifyCredential(fakeId);
      assert.isFalse(verifyFake[0], 'verification should fail for a non-existent credential');
      assert.equal(verifyFake[1], '0x0000000000000000000000000000000000000000', 'issuer should be zero address when invalid');
      assert.equal(Number(verifyFake[2]), 0, 'issuedAt should be zero for invalid credentials');

      console.log(`\n[Test 2] Non-existent credential ${short(fakeId)} correctly reported as invalid.`);

      // Setup a revoked credential and ensure verification fails
      await registry.authorizeIssuer(issuer, { from: admin });
      const credentialId = web3.utils.soliditySha3('cred-revoke');
      const studentHash = web3.utils.soliditySha3('student-x');
      const documentHash = web3.utils.soliditySha3('doc-x');

      await registry.issueCredential(credentialId, studentHash, documentHash, { from: issuer });
      await registry.revokeCredential(credentialId, { from: issuer });

      const verifyRevoked = await registry.verifyCredential(credentialId);
      assert.isFalse(verifyRevoked[0], 'revoked credentials must not verify as valid');

      console.log(`   Revoked credential ${short(credentialId)} verification returned invalid as expected.\n`);
    });
  });

  /*
   Test 3: Performance test
   Chwck:
   - Authorize an issuer and issue N credentials (transactions)
   - Verify transaction success rate (>= 95%)
   - Measure verification-only latency by calling verifyCredential for both 
     existing and non-existent IDs (50/50 mix)
   - Assert average verification latency is below the threshold and
     the failure rate for existing credentials is within acceptable limits
   */
  describe('Test 3: Performance Test', function () {
    this.timeout(60000);

    it('should perform verification quickly and maintain high transaction success rate', async () => {
      await registry.authorizeIssuer(issuer, { from: admin });

      const N = 100; // # of credentials
      const issueResults = [];
      const issuedIds = [];

      // Issue N credentials and record successful IDs
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

      // Measure verification-only latency for N calls (50% existing, 50% random)
      const start = Date.now();
      let verifyFailures = 0;

      for (let i = 0; i < N; i++) {
        const useExisting = (i % 2 === 0);
        const idToCheck = useExisting && issuedIds[i / 2] ? issuedIds[i / 2] : web3.utils.soliditySha3('random-' + i + '-' + Math.random());
        try {
          const res = await registry.verifyCredential(idToCheck);
          if (useExisting && (!res[0])) verifyFailures++;
        } catch (e) {
          verifyFailures++;
        }
      }

      const elapsedMs = Date.now() - start;
      const avgMs = elapsedMs / N;

      const allowedFailures = Math.ceil((N / 2) * 0.05);

      // Print a concise performance summary so test output is easy to scan
      console.log(`\n[Test 3] Performance summary:`);
      console.log(`   Issued: ${issuedIds.length}/${N} credentials  —  Success rate: ${successRate.toFixed(2)}% (${successCount}/${N})`);
      console.log(`   Verification calls: ${N} (50% existing / 50% random)`);
      console.log(`   Avg verification latency: ${avgMs.toFixed(2)}ms`);
      console.log(`   Verification failures for existing creds: ${verifyFailures}  (allowed: ${allowedFailures})`);

      if (successRate >= 95) console.log('   Transaction success rate target met'); else console.log('   Transaction success rate below target');
      if (avgMs < 5000) console.log('   Average verification latency target met'); else console.log('   Average verification latency too high');
      if (verifyFailures <= allowedFailures) console.log('   Verification failure rate within allowed threshold'); else console.log('   Verification failure rate exceeded threshold');

      // Performance assertions
      assert.isAtLeast(successRate, 95, `transaction success rate should be >= 95% (got ${successRate}%)`);
      assert.isBelow(avgMs, 5000, `average verification should be < 5000ms (got ${avgMs}ms)`);
      assert.isAtMost(verifyFailures, allowedFailures, `verification failure count should be <= ${allowedFailures} (got ${verifyFailures})`);
    });
  });

  describe('Test 4: Reissue + Hash Verification', function () {
    it('should support reissue and verify updated document hash', async () => {
      await registry.authorizeIssuer(issuer, { from: admin });

      const credentialId = web3.utils.soliditySha3('cred-reissue-1');
      const studentHash = web3.utils.soliditySha3('student-reissue-1');
      const docV1 = web3.utils.soliditySha3('doc-v1');
      const docV2 = web3.utils.soliditySha3('doc-v2');

      await registry.issueCredential(credentialId, studentHash, docV1, { from: issuer });
      await registry.reissueCredential(credentialId, studentHash, docV2, { from: issuer });

      const extended = await registry.getCredentialExtended(credentialId);
      assert.equal(extended[1], docV2, 'documentHash should be updated after reissue');
      assert.equal(Number(extended[7]), 2, 'version should increment to 2 after one reissue');

      const verifyOld = await registry.verifyCredentialDocument(credentialId, docV1);
      assert.isFalse(verifyOld[0], 'old hash should fail verification after reissue');

      const verifyNew = await registry.verifyCredentialDocument(credentialId, docV2);
      assert.isTrue(verifyNew[0], 'new hash should verify after reissue');
      assert.equal(Number(verifyNew[3]), 2, 'verify payload should expose new version');
    });
  });
});
