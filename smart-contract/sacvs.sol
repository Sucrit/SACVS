// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AcademicCredentialRegistry {

    address public admin;

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin allowed");
        _;
    }

    modifier onlyIssuer() {
        require(authorizedIssuers[msg.sender], "Not an authorized issuer");
        _;
    }

    struct Credential {
        bytes32 credentialId;
        bytes32 studentHash;
        bytes32 documentHash;
        address issuer;
        uint256 issuedAt;
        bool revoked;
    }

    mapping(bytes32 => Credential) private credentials;
    mapping(address => bool) public authorizedIssuers;

    event CredentialIssued(bytes32 credentialId, address issuer);
    event CredentialRevoked(bytes32 credentialId);

    // ---- Issuer Management ----

    function authorizeIssuer(address issuer) external onlyAdmin {
        authorizedIssuers[issuer] = true;
    }

    function revokeIssuer(address issuer) external onlyAdmin {
        authorizedIssuers[issuer] = false;
    }

    // ---- Credential Management ----

    function issueCredential(
        bytes32 credentialId,
        bytes32 studentHash,
        bytes32 documentHash
    ) external onlyIssuer {

        require(credentials[credentialId].issuedAt == 0, "Credential already exists");

        credentials[credentialId] = Credential({
            credentialId: credentialId,
            studentHash: studentHash,
            documentHash: documentHash,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            revoked: false
        });

        emit CredentialIssued(credentialId, msg.sender);
    }

    function revokeCredential(bytes32 credentialId) external onlyIssuer {
        require(credentials[credentialId].issuedAt != 0, "Credential does not exist");

        credentials[credentialId].revoked = true;
        emit CredentialRevoked(credentialId);
    }

    // ---- Verification ----

    function verifyCredential(bytes32 credentialId)
        external
        view
        returns (
            bool valid,
            address issuer,
            uint256 issuedAt
        )
    {
        Credential memory cred = credentials[credentialId];

        if (cred.issuedAt == 0 || cred.revoked) {
            return (false, address(0), 0);
        }

        return (true, cred.issuer, cred.issuedAt);
    }
}