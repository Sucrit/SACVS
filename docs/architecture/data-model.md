# Data Model Overview

## Core Identity and Tenant Entities
- `User`: base actor record for `STUDENT`, `INSTITUTION`, `EMPLOYER`, and `ADMIN`.
- `InstitutionProfile`: institution-specific organization metadata.
- `StudentProfile`: student identity and academic metadata such as student number, course of study, department, and year level.
- `EmployerProfile`: employer-specific details where that role is used.

## Credential Domain
- `Credential`: issued or managed credential record.
- Main states: `PENDING`, `ISSUED`, `REVOKED`, `EXPIRED`.
- `expiryDate` is authoritative for automatic expiry.
- Institutions may reissue expired credentials, but expired records should otherwise remain locked from normal mutation.

## Request Domain
- `CredentialRequest`: student-submitted request for institution handling.
- Delivery methods include `DIGITAL`, `PHYSICAL`, and `BOTH`.
- Requests transition through approval, rejection, completion, and physical claim handling states.

## One-Time Verification Token Domain
### Student Share QR
- `CredentialQrToken`
  - one-time verification token
  - hash stored at rest
  - short TTL
  - invalidation and used timestamps
- `CredentialQrDocumentToken`
  - separate one-time document-access token derived from the share flow
  - minimal TTL and single-use semantics

### Approval Receipt Verification
- `CredentialRequestApprovalReceipt`
  - generated for `PHYSICAL` and `BOTH` requests when approved
  - includes a human-readable `receiptCode`
  - verification token is hash-at-rest and single-use
  - used to prove approved physical pickup eligibility

## Step-Up Security Domain
- `StepUpChallenge`
  - OTP challenge record
  - action-bound, actor-bound, target-aware
  - limited attempts and short TTL
- `StepUpSession`
  - single-use, short-lived session token after successful challenge verification
  - bound to actor, action, target, and optional payload hash

## Audit and Security Domain
- `AuditLog`
  - canonical record of security-sensitive and operational events
  - supports actor, target, action, severity, and metadata
  - used by investigations and ML feature extraction

## ML Shadow Scoring Domain
- `RiskModelVersion`: tracks registered model artifacts and metadata.
- `RiskFeatureSnapshot`: persistent feature snapshot used for explainable risk evaluation.
- `RiskEventRecord`: stored risk outcome with score, band, action context, and review status.

## Data Modeling Principles
- Raw verification tokens and OTP codes are never stored in plaintext.
- IP and user-agent should be hashed or normalized before ML feature storage.
- Institution access is scoped by institution ownership, not only by role.
- Public verification models expose minimal proof, not full privileged payloads.
- Expiry, revocation, and issuance states are business controls, not frontend-only presentation values.
