# QR and Approval Receipt Verification

## Student Share QR Verification
### Purpose
Allows a student to generate a one-time, short-lived verification link or QR for a specific credential.

### Security properties
- raw token is never stored
- token is hashed at rest with a pepper
- token is single-use
- TTL is short-lived
- regeneration invalidates prior active tokens

### Verification behavior
- public verifier path consumes the token once
- employer verifier path uses authenticated employer context
- successful verification returns minimal credential proof, not the original document bytes

## QR-Scoped Document Access
- Document preview/download for public sharing is gated through a separate one-time document token.
- This allows the student to control whether document preview/download is included in a share flow.
- High-risk share settings such as document download require step-up OTP.

## Approval Receipt Verification
### Purpose
Supports `PHYSICAL` and `BOTH` request workflows by giving the student a proof-of-approval receipt for registrar check-in.

### Trigger
- Generated automatically when a qualifying request becomes `APPROVED`.

### Returned proof
- request ID
- receipt code
- student name
- student number
- credential type or request type context
- delivery method
- approval timestamp
- institution name

### Source of truth
The one-time receipt token or verification URL is the trust-bearing artifact. The human-readable receipt code is an operator reference and lookup aid, not the authoritative proof object.

## Physical Claim Workflow
### `PHYSICAL`
- digital issuance is blocked
- approval receipt is generated
- registrar validates receipt and marks physical claim complete

### `BOTH`
- digital issuance remains allowed
- approval receipt is still generated for physical pickup
- registrar should have a distinct `Mark Claimed` action after successful receipt verification

## Receipt Invalidation Rules
- receipt tokens are single-use and short-lived
- generating a new active receipt token invalidates the previous one
- once the physical claim is completed, the receipt should no longer be reusable as a proof artifact

## UX Rules
- registrar verification should happen in the dedicated institution receipt verification surface, not on a detached public-style results page
- empty, loading, valid, and invalid states should each have clear centered treatment
- QR support is useful for phone-assisted workflows, but paste/token entry remains necessary because many registrar workstations have no camera

## Audit Expectations
Log:
- `REQUEST_RECEIPT_GENERATED`
- `REQUEST_RECEIPT_VERIFIED`
- invalid, expired, or used verification attempts
- mark-claimed completion after verification
