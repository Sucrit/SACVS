# Structure
- API Gateway
- User Service
- Credential Management Service
- AI Validation & Fraud Detection Service
- Blockchain Interface Service
- Verification Service
- Audit & Logging Service
- Notification Service
- Document Storage Service (optional)

### Truffle (Blockchain testing in ganache)
- npx truffle compile
- npx truffle migrate --network development

#### PRISMA CS
// init prisma
- npx prisma init
// format schema.prisma for readability 
- npx prisma format
// gen prisma client from schema.prisma
- npx prisma generate
// create a new migration from schema changes and applies it to DB
- npx prisma migrate dev --name init
// applies existing migrations to the database (no schema diffing)
- npx prisma migrate deploy
// resets the database, reapplies all migrations, and reruns seed (DEV ONLY)
- npx prisma migrate reset
// checks if schema.prisma matches the actual database (no changes applied)
- npx prisma migrate diff
// pulls the current database schema into schema.prisma (DB → Prisma)
- npx prisma db pull
// pushes schema.prisma directly to the database (no migrations)
- npx prisma db push
// runs the seed script defined in package.json
- npx prisma db seed
// validates schema.prisma without generating client or touching DB
- npx prisma validate
