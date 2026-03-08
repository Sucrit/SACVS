# SACVS

SACVS is a multi-service credential issuance and verification platform for institution-managed academic credentials. The platform includes student onboarding, institution student management, credential request handling, direct and request-driven issuance, blockchain anchoring, one-time QR verification, approval receipt verification for physical claim workflows, realtime dashboard updates, and a metadata-only ML risk scoring layer operating in shadow mode.

## Repository Structure
- `frontend/`: React/Vite application
- `backend/gateway/`: API gateway, route proxying, rate limiting, and websocket hub
- `backend/services/user-service/`: users, onboarding, institution student management, step-up OTP
- `backend/services/credential-service/`: credentials, encrypted document storage, issuance, QR verification
- `backend/services/credential-request-service/`: request lifecycle, approval receipts, physical claim workflows
- `backend/services/notification-service/`: in-app notifications and internal notification ingestion
- `backend/services/blockchain-interface-service/`: blockchain anchoring and chain-facing integration logic
- `backend/services/security-service/`: offline dataset extraction and shadow ML risk scoring workflows
- `backend/db/`: shared Prisma schema and migrations
- `docs/`: canonical engineering, security, operations, and feature documentation

## Start Here
- Documentation index: [docs/README.md](./docs/README.md)
- Local development: [docs/development/local-development.md](./docs/development/local-development.md)
- Configuration reference: [docs/development/configuration.md](./docs/development/configuration.md)
- Architecture overview: [docs/architecture/system-overview.md](./docs/architecture/system-overview.md)

## Local Development
From the repository root:

```powershell
./dev.sh
```

## Database
Typical Prisma workflows:

```powershell
cd backend/db
npx prisma migrate deploy
npx prisma migrate dev
npx prisma generate
```

## Blockchain
The blockchain interface service is designed to work against a local or deployed EVM-compatible chain. If you are using Ganache locally, ensure the chain endpoint, contract address, and signing configuration are aligned with the current environment before running issuance flows.

## Documentation Policy
The `docs/` folder is the authoritative documentation set. If code behavior and documentation diverge, update the documentation to match the live code or correct the code to match intended behavior. Historical notes should not remain the primary source of truth.
