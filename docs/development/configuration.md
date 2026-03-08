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

## Security Guidance
- OTP/session peppers, QR peppers, and HMAC secrets must be distinct values.
- Do not reuse encryption keys as token peppers.
- Do not expose internal service tokens to the frontend.
- Do not surface OTP codes inside in-app notifications for privileged roles.

## Configuration Validation Recommendations
- Add startup validation for every required secret in production.
- Fail fast on missing internal tokens, peppers, chain secrets, or database URLs.
- Document environment ownership per deployment target so service secrets are not copied ad hoc.
