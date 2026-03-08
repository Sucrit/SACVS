# Credential Lifecycle

## Actors
- Student: views issued credentials, generates one-time QR shares, downloads own documents.
- Institution: manages issuance for its own students, reissues credentials, inspects institution-scoped credential details and documents.
- Admin: platform-wide oversight and privileged management.
- Employer: optional authenticated verifier flow, separate from public verification.

## Primary States
- `PENDING`: created but not yet fully issued
- `ISSUED`: active credential available to the student and institution
- `REVOKED`: explicitly invalidated
- `EXPIRED`: automatically reached through `expiryDate`

## Issuance Paths
### Direct issuance
- Institution can issue directly to a scoped student account.
- OTP step-up is required before the high-risk mutation completes.
- File upload, metadata persistence, and blockchain anchoring occur during the flow.

### Issue from approved request
- Institution issues from an approved request when the request is eligible for digital issuance.
- `PHYSICAL` requests block digital-only issuance.
- `BOTH` allows digital issuance while still requiring a separate physical claim flow.

## Reissue Policy
- Reissue is allowed for records that need a replacement document or a new valid credential instance.
- Expired records should be locked from normal mutation but still allow reissue.
- Reissue must be explicit and auditable.

## Expiry Policy
- Expiry should be system-driven by `expiryDate`, not manually set by institutions.
- Institutions should not manually force a still-valid credential into `EXPIRED` when a revoke or separate business action is intended.
- Once expired, standard update actions should be disabled except for permitted reissue.

## Institution Visibility Policy
Institutions need more than a raw table view for operational work. Recommended pattern:
- keep the table as the summary surface
- open a detail drawer for full metadata and preview or download actions
- scope document access strictly to institution-owned or student-owned relationships
- audit every sensitive file access

## Document Access Rules
- Students can view and download their own credential files.
- Institutions can view and download credential files for in-scope students.
- Public verification never returns raw document bytes unless mediated by a one-time document token derived from a student share flow.

## Audit Expectations
At minimum, log:
- credential creation
- issue/reissue/revoke/expiry transitions
- denied and granted document access
- OTP-protected action outcomes
- blockchain anchoring failures or success conditions
