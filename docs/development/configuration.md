# Configuration Reference

## Configuration Principles
- Treat environment configuration as explicit and deployment-specific.
- Do not rely on mismatched service defaults across packages.
- Production must fail closed for internal tokens and required peppers or secrets.

## Common Variables
### Database
- `DATABASE_URL`: PostgreSQL connection string used by Prisma-backed services

### Internal service trust
- `INTERNAL_SERVICE_TOKEN`: required for internal-only route protection and service-to-service calls

### Realtime
- `REALTIME_GATEWAY_URL`: URL used by services to publish websocket updates back to the gateway
- Recommendation: set explicitly to your gateway base URL in every service environment

### Gateway security telemetry
- `GATEWAY_TELEMETRY_ENABLED`: enables persistence of security-focused gateway request telemetry for ML shadow scoring support
- Recommendation: keep enabled in environments where the ML shadow layer is active

## User Service
### Required or security-sensitive
- `DATABASE_URL`
- `STEP_UP_TOKEN_PEPPER`

### Important behavior flags
- `STEP_UP_OTP_TTL_SECONDS`
- `STEP_UP_SESSION_TTL_SECONDS`
- `STEP_UP_MAX_ATTEMPTS`
- `STEP_UP_ENFORCEMENT_MODE`

### Email delivery
- SMTP variables must be configured for real OTP delivery
- Incomplete SMTP config weakens the operational value of step-up flows

## Credential Service
### Required or security-sensitive
- `DATABASE_URL`
- `INTERNAL_SERVICE_TOKEN`
- `STEP_UP_TOKEN_PEPPER`
- `QR_TOKEN_PEPPER`
- `FILE_ENCRYPTION_KEY`

### Behavior and routing
- `QR_TOKEN_TTL_SECONDS`
- `QR_VERIFY_BASE_URL`
- `REALTIME_GATEWAY_URL`

## Credential-Request Service
### Required or security-sensitive
- `DATABASE_URL`
- `INTERNAL_SERVICE_TOKEN`
- `REQUEST_RECEIPT_TOKEN_PEPPER`

### Behavior and routing
- `REQUEST_RECEIPT_TOKEN_TTL_SECONDS`
- `REQUEST_RECEIPT_VERIFY_BASE_URL`
- `REALTIME_GATEWAY_URL`

## Notification Service
### Required or security-sensitive
- `DATABASE_URL`
- `INTERNAL_SERVICE_TOKEN`

### Behavior and routing
- `REALTIME_GATEWAY_URL`

## Blockchain-Interface Service
### Required or security-sensitive
- `INTERNAL_SERVICE_TOKEN`
- `BLOCKCHAIN_HASH_HMAC_SECRET`
- `BLOCKCHAIN_PRIVATE_KEY` when signing is required
- `BLOCKCHAIN_CONTRACT_ADDRESS`

### Chain connectivity
- `BLOCKCHAIN_RPC_URL`
- `BLOCKCHAIN_CHAIN_NAME`

## Frontend
### Important runtime variables
- Clerk publishable key and auth-related browser configuration
- API base URL pointing to the gateway

## Security Service
### Required or security-sensitive
- `DATABASE_URL`
- Clerk backend auth variables required for admin-protected `/security` APIs

### Shadow scoring runtime
- `RISK_SHADOW_AUTORUN`
- `RISK_SHADOW_INTERVAL_MS`
- `RISK_SHADOW_OVERLAP_MINUTES`
- `RISK_SHADOW_BATCH_LIMIT`

### Telemetry retention
- `GATEWAY_TELEMETRY_RETENTION_DAYS`
- `GATEWAY_TELEMETRY_CLEANUP_INTERVAL_MS`

### Notes
- raw gateway telemetry is retained for 30 days by default
- telemetry is security-focused only and should not ingest generic page loads or low-risk CRUD by default
- Clerk-native sign-in failures remain out of scope unless you explicitly mirror them into internal audit or telemetry storage

## Security Guidance
- OTP/session peppers, QR peppers, and HMAC secrets must be distinct values.
- Do not reuse encryption keys as token peppers.
- Do not expose internal service tokens to the frontend.
- Do not surface OTP codes inside in-app notifications for privileged roles.

## Configuration Validation Recommendations
- Add startup validation for every required secret in production.
- Fail fast on missing internal tokens, peppers, chain secrets, or database URLs.
- Document environment ownership per deployment target so service secrets are not copied ad hoc.
