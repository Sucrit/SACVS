# Security Architecture

## Security Model
SACVS uses rule-based controls as the primary enforcement layer. Core controls in the platform include:
- role and scope authorization
- step-up OTP for high-risk actions
- one-time tokens with TTL and hash-at-rest storage
- route-class rate limiting
- audit logging with correlation-aware metadata
- encrypted credential files at rest
- internal service token validation

## Authentication
- Browser-facing authentication is handled through Clerk.
- Backend services still enforce SACVS role, status, and ownership checks after authentication.

## Authorization
### Scope rules
- Students act on their own records and credentials.
- Institutions are scoped to their institution and their managed students.
- Admins have cross-tenant authority.
- Employers have limited verification-oriented capabilities where configured.

### Backend-first rule
Authorization is not trusted to the frontend. All sensitive routes must enforce scope in their owning backend service.

## Step-Up Verification
### Purpose
Provides an extra control for high-risk operations such as:
- role changes
- account status changes
- credential issuance and reissue
- institution bulk student creation
- share flows that enable public document download

### Model
1. Create challenge.
2. Deliver OTP through email.
3. Verify challenge.
4. Receive single-use, short-lived step-up session token.
5. Execute exactly one matching privileged action.

### Security note
Email OTP is better than no step-up, but it is not phishing-resistant. It mainly protects against session-only abuse and casual workstation misuse, not a fully compromised mailbox.

## One-Time Token Controls
### Used in
- student credential share QR verification
- QR document share token access
- approval receipt verification
- step-up sessions

### Properties
- single-use
- short TTL
- hash-at-rest
- regeneration invalidates prior active records
- deterministic invalid, expired, and used handling

## Rate Limiting
- Applied at the gateway by route class.
- Important classes include public verification, authenticated standard traffic, high-risk mutation traffic, and internal service routes.
- Current implementation is in-memory and not cluster-global.

## File Security
- Credential files are encrypted at rest.
- File integrity metadata is maintained.
- Public verification never directly exposes stored file paths.

## Audit Logging
Audit must capture:
- actor and actor role
- target type and target ID
- outcome and reason
- correlation ID
- security-sensitive denials and access grants
- token abuse, OTP failures, and privileged action chains

## Known Security Limits
- Email OTP is not sufficient against full email compromise.
- In-memory gateway rate limiting is not enough for horizontally scaled deployment.
- Public verification surfaces intentionally expose minimal proof data and must remain tightly constrained.
- Service defaults that silently diverge from the actual gateway URL are an operational security risk because they weaken update propagation and observability.
