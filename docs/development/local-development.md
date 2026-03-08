# Local Development Guide

## Prerequisites
- Node.js compatible with the current repo toolchain
- PostgreSQL reachable through `DATABASE_URL`
- Clerk development credentials for authenticated UI flows
- SMTP credentials if you want real email OTP delivery
- Ganache or another local EVM node if you want blockchain anchoring to succeed

## Core Local Ports
- Frontend: `5173`
- Gateway: `4000`
- User service: `5000`
- Credential service: `5100`
- Credential-request service: `5200`
- Notification service: `5300`
- Blockchain-interface service: `5400`

## Startup
From the repository root:

```powershell
./dev.sh
```

## What `dev.sh` does
- regenerates the shared Prisma client once before starting services
- starts frontend and backend services in parallel
- exports development shell variables used by the process

## Database Workflows
From `backend/db` or the relevant service directory:

```powershell
npx prisma migrate deploy
npx prisma migrate dev
npx prisma generate
```

Recommended discipline:
- use `migrate dev` only while changing schema locally
- use `migrate deploy` to validate the deployment path against an existing database
- regenerate Prisma clients after schema changes before restarting services

## Typechecking
Run per package as needed. Example:

```powershell
cd frontend
npm run typecheck

cd ..\backend\services\user-service
npm run typecheck
```

## Security-Service Local Workflows
From `backend/services/security-service`:

```powershell
npm run dataset:extract
npm run shadow:score -- --lookbackMinutes=1440
```

These commands require `DATABASE_URL` to resolve from service or parent env files.

Generated ML outputs are organized under:
- `backend/services/security-service/artifacts/datasets/`
- `backend/services/security-service/artifacts/models/`
- `backend/services/security-service/artifacts/metrics/`
- `backend/services/security-service/artifacts/manifests/`

## Local Verification Areas
- student onboarding and request submission
- institution student management and bulk CSV import
- institution issuance and request approval flows
- student QR sharing and public verification
- approval receipt generation and registrar verification
- realtime dashboard updates through the gateway websocket hub
- OTP step-up on high-risk actions

## Known Development Cautions
- Some services still default `REALTIME_GATEWAY_URL` to `4900` while the gateway defaults to `4000`. Set `REALTIME_GATEWAY_URL` explicitly instead of relying on service defaults.
- OTP delivery quality depends on SMTP configuration. In-app notifications are not a secure OTP delivery channel.
- Blockchain-dependent actions will fail if the blockchain interface service or chain endpoint is unavailable.
