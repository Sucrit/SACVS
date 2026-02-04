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

    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event IssuerAuthorized(address indexed issuer);
    event IssuerRevoked(address indexed issuer);

    event CredentialIssued(bytes32 indexed credentialId, address indexed issuer);
    event CredentialRevoked(bytes32 indexed credentialId, address indexed revokedBy);

    // Admin Management

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "New admin is zero address");
        address oldAdmin = admin;
        admin = newAdmin;
        emit AdminTransferred(oldAdmin, newAdmin);
    }

    // Issuer Management

    function authorizeIssuer(address issuer) external onlyAdmin {
        require(issuer != address(0), "Issuer is zero address");
        authorizedIssuers[issuer] = true;
        emit IssuerAuthorized(issuer);
    }

    function revokeIssuer(address issuer) external onlyAdmin {
        require(issuer != address(0), "Issuer is zero address");
        authorizedIssuers[issuer] = false;
        emit IssuerRevoked(issuer);
    }

    // Credential Management

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

    function revokeCredential(bytes32 credentialId) external {
        Credential storage cred = credentials[credentialId];
        require(cred.issuedAt != 0, "Credential does not exist");
        require(!cred.revoked, "Credential already revoked");
        require(msg.sender == cred.issuer || msg.sender == admin, "Not authorized to revoke");

        cred.revoked = true;
        emit CredentialRevoked(credentialId, msg.sender);
    }

    // Read Access

    function getCredential(bytes32 credentialId)
        external
        view
        returns (
            bytes32 studentHash,
            bytes32 documentHash,
            address issuer,
            uint256 issuedAt,
            bool revoked
        )
    {
        Credential memory cred = credentials[credentialId];
        return (
            cred.studentHash,
            cred.documentHash,
            cred.issuer,
            cred.issuedAt,
            cred.revoked
        );
    }

    // Verification

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