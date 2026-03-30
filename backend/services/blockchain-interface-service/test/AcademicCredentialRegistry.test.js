const AcademicCredentialRegistry = artifacts.require("AcademicCredentialRegistry");
const { assert } = require("chai");

contract("AcademicCredentialRegistry", (accounts) => {
  const admin = accounts[0];
  const issuer = accounts[1];
  const otherIssuer = accounts[2];
  const outsider = accounts[3];

  let registry;

  const makeHash = (label) => web3.utils.soliditySha3(`${label}-${Date.now()}-${Math.random()}`);
  const makeCredentialPayload = (name) => ({
    credentialId: makeHash(`cred-${name}`),
    studentHash: makeHash(`student-${name}`),
    documentHash: makeHash(`doc-${name}`),
  });

  const expectRevert = async (promise, expectedReason) => {
    try {
      await promise;
      assert.fail("Expected transaction to revert");
    } catch (error) {
      assert.include(
        error.message,
        "revert",
        `Expected EVM revert but got: ${error.message}`
      );
      if (expectedReason) {
        assert.include(
          error.message,
          expectedReason,
          `Expected revert reason to include "${expectedReason}" but got: ${error.message}`
        );
      }
    }
  };

  beforeEach(async () => {
    registry = await AcademicCredentialRegistry.new({ from: admin });
  });

  describe("Admin and issuer management", () => {
    it("sets deployer as admin", async () => {
      const deployedAdmin = await registry.admin();
      assert.equal(deployedAdmin, admin, "deployer must be admin");
    });

    it("enforces admin-only issuer management", async () => {
      await expectRevert(
        registry.authorizeIssuer(issuer, { from: outsider }),
        "Only admin allowed"
      );

      await registry.authorizeIssuer(issuer, { from: admin });
      assert.isTrue(await registry.authorizedIssuers(issuer), "issuer should be authorized");

      await expectRevert(
        registry.revokeIssuer(issuer, { from: outsider }),
        "Only admin allowed"
      );

      await registry.revokeIssuer(issuer, { from: admin });
      assert.isFalse(await registry.authorizedIssuers(issuer), "issuer should be revoked");
    });

    it("supports admin transfer and applies new permissions", async () => {
      await expectRevert(
        registry.transferAdmin("0x0000000000000000000000000000000000000000", { from: admin }),
        "New admin is zero address"
      );

      await registry.transferAdmin(otherIssuer, { from: admin });
      assert.equal(await registry.admin(), otherIssuer, "admin should be transferred");

      await expectRevert(
        registry.authorizeIssuer(issuer, { from: admin }),
        "Only admin allowed"
      );

      await registry.authorizeIssuer(issuer, { from: otherIssuer });
      assert.isTrue(await registry.authorizedIssuers(issuer), "new admin should manage issuers");
    });
  });

  describe("Issue and verify", () => {
    it("allows authorized issuer to issue and verify", async () => {
      await registry.authorizeIssuer(issuer, { from: admin });
      const payload = makeCredentialPayload("happy");

      const issueTx = await registry.issueCredential(
        payload.credentialId,
        payload.studentHash,
        payload.documentHash,
        { from: issuer }
      );
      assert.isTrue(issueTx.receipt.status, "issue transaction should succeed");

      assert.isTrue(
        await registry.credentialExists(payload.credentialId),
        "credential should exist after issue"
      );

      const cred = await registry.getCredential(payload.credentialId);
      assert.equal(cred[0], payload.studentHash, "student hash should match");
      assert.equal(cred[1], payload.documentHash, "document hash should match");
      assert.equal(cred[2], issuer, "issuer should match");
      assert.isAbove(Number(cred[3]), 0, "issuedAt should be non-zero");
      assert.isFalse(cred[4], "newly issued credential should not be revoked");

      const verify = await registry.verifyCredential(payload.credentialId);
      assert.isTrue(verify[0], "verifyCredential should be valid");
      assert.equal(verify[1], issuer, "verify issuer should match");
      assert.isAbove(Number(verify[2]), 0, "verify issuedAt should be non-zero");

      const verifyDoc = await registry.verifyCredentialDocument(
        payload.credentialId,
        payload.documentHash
      );
      assert.isTrue(verifyDoc[0], "document verification should pass");
      assert.equal(verifyDoc[1], issuer, "document verify issuer should match");
      assert.equal(Number(verifyDoc[3]), 1, "initial version should be 1");
    });

    it("rejects non-authorized issuer and duplicate credentialId", async () => {
      const payload = makeCredentialPayload("rules");

      await expectRevert(
        registry.issueCredential(payload.credentialId, payload.studentHash, payload.documentHash, {
          from: outsider,
        }),
        "Not an authorized issuer"
      );

      await registry.authorizeIssuer(issuer, { from: admin });
      await registry.issueCredential(payload.credentialId, payload.studentHash, payload.documentHash, {
        from: issuer,
      });

      await expectRevert(
        registry.issueCredential(payload.credentialId, payload.studentHash, payload.documentHash, {
          from: issuer,
        }),
        "Credential already exists"
      );
    });

    it("returns invalid for non-existent verification calls", async () => {
      const fakeId = makeHash("missing-cred");
      const fakeDoc = makeHash("missing-doc");

      const verify = await registry.verifyCredential(fakeId);
      assert.isFalse(verify[0], "non-existent credential should be invalid");
      assert.equal(verify[1], "0x0000000000000000000000000000000000000000", "issuer should be zero");
      assert.equal(Number(verify[2]), 0, "issuedAt should be zero");

      const verifyDoc = await registry.verifyCredentialDocument(fakeId, fakeDoc);
      assert.isFalse(verifyDoc[0], "non-existent credential document check should be invalid");
      assert.equal(verifyDoc[1], "0x0000000000000000000000000000000000000000", "issuer should be zero");
      assert.equal(Number(verifyDoc[2]), 0, "issuedAt should be zero");
      assert.equal(Number(verifyDoc[3]), 0, "version should be zero");
    });
  });

  describe("Reissue rules and hash verification", () => {
    it("supports reissue by original issuer and increments version", async () => {
      await registry.authorizeIssuer(issuer, { from: admin });
      const payload = makeCredentialPayload("reissue");
      const docV2 = makeHash("doc-v2");

      await registry.issueCredential(payload.credentialId, payload.studentHash, payload.documentHash, {
        from: issuer,
      });
      await registry.reissueCredential(payload.credentialId, payload.studentHash, docV2, {
        from: issuer,
      });

      const extended = await registry.getCredentialExtended(payload.credentialId);
      assert.equal(extended[1], docV2, "document hash should be replaced by reissue");
      assert.equal(Number(extended[7]), 2, "version should increment to 2");

      const verifyOld = await registry.verifyCredentialDocument(
        payload.credentialId,
        payload.documentHash
      );
      assert.isFalse(verifyOld[0], "old document hash should fail after reissue");

      const verifyNew = await registry.verifyCredentialDocument(payload.credentialId, docV2);
      assert.isTrue(verifyNew[0], "new document hash should pass after reissue");
      assert.equal(Number(verifyNew[3]), 2, "version in verify response should be 2");
    });

    it("enforces reissue restrictions", async () => {
      await registry.authorizeIssuer(issuer, { from: admin });
      await registry.authorizeIssuer(otherIssuer, { from: admin });

      const payload = makeCredentialPayload("reissue-restrictions");
      const nextDoc = makeHash("next-doc");

      await expectRevert(
        registry.reissueCredential(payload.credentialId, payload.studentHash, nextDoc, {
          from: issuer,
        }),
        "Credential does not exist"
      );

      await registry.issueCredential(payload.credentialId, payload.studentHash, payload.documentHash, {
        from: issuer,
      });

      await expectRevert(
        registry.reissueCredential(payload.credentialId, payload.studentHash, nextDoc, {
          from: otherIssuer,
        }),
        "Only original issuer can reissue"
      );

      await registry.revokeCredential(payload.credentialId, { from: issuer });

      await expectRevert(
        registry.reissueCredential(payload.credentialId, payload.studentHash, nextDoc, {
          from: issuer,
        }),
        "Credential is revoked"
      );
    });
  });

  describe("Revocation behavior", () => {
    it("allows issuer or admin to revoke and blocks verification", async () => {
      await registry.authorizeIssuer(issuer, { from: admin });
      const payload = makeCredentialPayload("revoke");

      await registry.issueCredential(payload.credentialId, payload.studentHash, payload.documentHash, {
        from: issuer,
      });
      await registry.revokeCredential(payload.credentialId, { from: admin });

      const extended = await registry.getCredentialExtended(payload.credentialId);
      assert.isTrue(extended[4], "revoked flag should be true");
      assert.isAbove(Number(extended[5]), 0, "revokedAt should be set");
      assert.equal(extended[6], admin, "revokedBy should track actor");

      const verify = await registry.verifyCredential(payload.credentialId);
      assert.isFalse(verify[0], "revoked credential should be invalid");

      const verifyDoc = await registry.verifyCredentialDocument(
        payload.credentialId,
        payload.documentHash
      );
      assert.isFalse(verifyDoc[0], "revoked credential document check should be invalid");
    });

    it("rejects revoke attempts by unauthorized actors and duplicate revoke", async () => {
      await registry.authorizeIssuer(issuer, { from: admin });
      const payload = makeCredentialPayload("revoke-guards");

      await expectRevert(
        registry.revokeCredential(payload.credentialId, { from: outsider }),
        "Credential does not exist"
      );

      await registry.issueCredential(payload.credentialId, payload.studentHash, payload.documentHash, {
        from: issuer,
      });

      await expectRevert(
        registry.revokeCredential(payload.credentialId, { from: outsider }),
        "Not authorized to revoke"
      );

      await registry.revokeCredential(payload.credentialId, { from: issuer });

      await expectRevert(
        registry.revokeCredential(payload.credentialId, { from: issuer }),
        "Credential already revoked"
      );
    });
  });

  describe("Performance baseline", function () {
    this.timeout(60000);

    it("keeps issue success high and verification latency low", async () => {
      await registry.authorizeIssuer(issuer, { from: admin });

      const N = 80;
      const issuedIds = [];
      let successCount = 0;

      for (let i = 0; i < N; i++) {
        const payload = makeCredentialPayload(`perf-${i}`);
        try {
          const tx = await registry.issueCredential(
            payload.credentialId,
            payload.studentHash,
            payload.documentHash,
            { from: issuer }
          );
          if (tx.receipt && tx.receipt.status) {
            successCount += 1;
            issuedIds.push(payload.credentialId);
          }
        } catch (error) {
          // keep loop running, measured by success rate below
        }
      }

      const successRate = (successCount / N) * 100;

      let existingVerifyFailures = 0;
      const verifyCalls = N;
      const start = Date.now();

      for (let i = 0; i < verifyCalls; i++) {
        const shouldUseExisting = i % 2 === 0;
        const id = shouldUseExisting && issuedIds[i / 2]
          ? issuedIds[i / 2]
          : makeHash(`random-${i}`);

        const result = await registry.verifyCredential(id);
        if (shouldUseExisting && !result[0]) {
          existingVerifyFailures += 1;
        }
      }

      const elapsedMs = Date.now() - start;
      const avgMs = elapsedMs / verifyCalls;
      const allowedFailures = Math.ceil((verifyCalls / 2) * 0.05);

      assert.isAtLeast(successRate, 95, `issue success rate must be >= 95% (got ${successRate}%)`);
      assert.isBelow(avgMs, 5000, `average verify latency must be < 5000ms (got ${avgMs}ms)`);
      assert.isAtMost(
        existingVerifyFailures,
        allowedFailures,
        `existing verify failures must be <= ${allowedFailures} (got ${existingVerifyFailures})`
      );
    });
  });
});
