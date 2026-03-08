# Deployment and Operations Guide

## Deployment Philosophy
SACVS should be deployed as a coordinated service set with explicit secret management, migration discipline, and post-deploy verification. The platform contains security-sensitive flows that degrade badly under partial configuration, especially internal token checks, OTP delivery, realtime publishing, and blockchain anchoring.

## Recommended Deployment Order
1. Provision secrets and environment variables.
2. Apply database migrations from `backend/db`.
3. Deploy backend services.
4. Deploy gateway.
5. Deploy frontend.
6. Run smoke tests on authenticated, public verification, and internal notification paths.

## Mandatory Pre-Deploy Checks
- `DATABASE_URL` points to the intended database.
- `INTERNAL_SERVICE_TOKEN` is present and aligned across services.
- `STEP_UP_TOKEN_PEPPER`, `QR_TOKEN_PEPPER`, and receipt peppers are set.
- `FILE_ENCRYPTION_KEY` is present where credential files are handled.
- `REALTIME_GATEWAY_URL` is set explicitly in services that publish realtime events.
- Blockchain connectivity variables are set if blockchain issuance is expected.

## Health Verification
### Gateway
- `GET /health`
- validate downstream reachability through smoke requests, not only gateway process liveness

### Services
- confirm each service process is listening on the expected port
- validate authenticated flows and internal routes separately
- verify notification write/read cycle
- verify credential document access and scope enforcement

## Post-Deploy Smoke Tests
- student login and `/users/me`
- institution student list
- request creation and request review
- issuance with OTP step-up
- QR verification public path
- approval receipt fetch and registrar verification
- realtime page update after a state change

## Failure Domains to Watch
- blockchain interface unavailable while issuance is attempted
- SMTP misconfiguration causing step-up OTP delivery failures
- mismatched internal service tokens causing 401/500 chains
- services publishing realtime events to the wrong gateway URL
- database migrations applied partially or against the wrong environment

## Production Hardening Recommendations
- place the gateway behind TLS termination and standard reverse-proxy protections
- externalize rate-limit state when multi-instance deployment is introduced
- centralize logs with correlation ID searchability
- monitor 401/403/429/5xx rate changes by route class
- rotate secrets with planned restart windows

## Rollback Guidance
- Prefer forward fixes for database-backed changes.
- If a release breaks a non-destructive surface, isolate the affected service or route rather than reverting unrelated components.
- Do not roll back migrations blindly when later writes may already depend on them.
