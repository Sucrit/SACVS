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

    error CredentialAlreadyExists();
    error CredentialDoesNotExist();
    error CredentialIsRevoked();
    error CredentialAlreadyRevoked();
    error NotOriginalIssuer();
    error NotAuthorizedToRevoke();

    struct Credential {
        bytes32 studentHash;
        bytes32 documentHash;
        address issuer;
        bool revoked;
        uint32 version;
        uint64 issuedAt;
        uint64 revokedAt;
        address revokedBy;
    }

    mapping(bytes32 => Credential) private credentials;
    mapping(address => bool) public authorizedIssuers;

    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event IssuerAuthorized(address indexed issuer);
    event IssuerRevoked(address indexed issuer);

    event CredentialIssued(bytes32 indexed credentialId, address indexed issuer);
    event CredentialReissued(bytes32 indexed credentialId, address indexed issuer, uint32 version);
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

    // revoke issuer
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
        Credential storage cred = credentials[credentialId];
        if (cred.issuedAt != 0) revert CredentialAlreadyExists();

        cred.studentHash = studentHash;
        cred.documentHash = documentHash;
        cred.issuer = msg.sender;
        cred.issuedAt = uint64(block.timestamp);
        cred.version = 1;

        emit CredentialIssued(credentialId, msg.sender);
    }

    function reissueCredential(
        bytes32 credentialId,
        bytes32 studentHash,
        bytes32 documentHash
    ) external onlyIssuer {
        Credential storage cred = credentials[credentialId];
        if (cred.issuedAt == 0) revert CredentialDoesNotExist();
        if (cred.revoked) revert CredentialIsRevoked();
        if (msg.sender != cred.issuer) revert NotOriginalIssuer();

        cred.studentHash = studentHash;
        cred.documentHash = documentHash;
        cred.issuedAt = uint64(block.timestamp);
        unchecked {
            cred.version += 1;
        }

        emit CredentialReissued(credentialId, msg.sender, cred.version);
    }

    // credential revocation (issuer , admin only)
    function revokeCredential(bytes32 credentialId) external {
        Credential storage cred = credentials[credentialId];
        if (cred.issuedAt == 0) revert CredentialDoesNotExist();
        if (cred.revoked) revert CredentialAlreadyRevoked();
        if (msg.sender != cred.issuer && msg.sender != admin) revert NotAuthorizedToRevoke();

        cred.revoked = true;
        cred.revokedAt = uint64(block.timestamp);
        cred.revokedBy = msg.sender;
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
        Credential storage cred = credentials[credentialId];
        return (
            cred.studentHash,
            cred.documentHash,
            cred.issuer,
            cred.issuedAt,
            cred.revoked
        );
    }

    function getCredentialExtended(bytes32 credentialId)
        external
        view
        returns (
            bytes32 studentHash,
            bytes32 documentHash,
            address issuer,
            uint256 issuedAt,
            bool revoked,
            uint256 revokedAt,
            address revokedBy,
            uint32 version
        )
    {
        Credential storage cred = credentials[credentialId];
        return (
            cred.studentHash,
            cred.documentHash,
            cred.issuer,
            cred.issuedAt,
            cred.revoked,
            cred.revokedAt,
            cred.revokedBy,
            cred.version
        );
    }

    function credentialExists(bytes32 credentialId) external view returns (bool) {
        return credentials[credentialId].issuedAt != 0;
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
        Credential storage cred = credentials[credentialId];

        if (cred.issuedAt == 0 || cred.revoked) {
            return (false, address(0), 0);
        }

        return (true, cred.issuer, cred.issuedAt);
    }

    function verifyCredentialDocument(bytes32 credentialId, bytes32 expectedDocumentHash)
        external
        view
        returns (
            bool valid,
            address issuer,
            uint256 issuedAt,
            uint32 version
        )
    {
        Credential storage cred = credentials[credentialId];

        if (cred.issuedAt == 0 || cred.revoked) {
            return (false, address(0), 0, 0);
        }

        if (cred.documentHash != expectedDocumentHash) {
            return (false, address(0), 0, 0);
        }

        return (true, cred.issuer, cred.issuedAt, cred.version);
    }
}
