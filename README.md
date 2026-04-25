# Credence

Credence aims to create, verify, and distribute the students academic credentials in digital form. The goal of the platform is to digitalized the entire process from student credential issuance to credential verification.

## Start Here
- Repository Structure: [docs/repo-structure.md](./docs/repo-structure.md)
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

Ganache and truffle workflows:

``gitbash
cd backend/services/blockchain-interface-service
npx truffle compile
npx truffle migrate --network development --reset
npx truffle test --network development
npx truffle console --network development
``
