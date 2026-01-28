- API Gateway
- User Service
- Credential Management Service
- AI Validation & Fraud Detection Service
- Blockchain Interface Service
- Verification Service
- Audit & Logging Service
- Notification Service
- Document Storage Service (optional)

#### PRISMA CS
// init Prisma
- npx prisma init

// format schema.prisma for readability 
- npx prisma format

// gen Prisma Client from schema.prisma
- npx prisma generate

// create a new migration from schema changes and applies it to DB
- npx prisma migrate dev --name init

// Applies existing migrations to the database (no schema diffing)
- npx prisma migrate deploy

// Resets the database, reapplies all migrations, and reruns seed (DEV ONLY)
- npx prisma migrate reset

// Checks if schema.prisma matches the actual database (no changes applied)
- npx prisma migrate diff

// Pulls the current database schema into schema.prisma (DB → Prisma)
- npx prisma db pull

// Pushes schema.prisma directly to the database (no migrations)
- npx prisma db push

// Opens Prisma Studio (GUI to view and edit DB records)
- npx prisma studio

// Runs the seed script defined in package.json
- npx prisma db seed

// Validates schema.prisma without generating client or touching DB
- npx prisma validate
