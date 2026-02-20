# SACVS API Documentation

Last updated: February 20, 2026

This document describes the **currently implemented API** in this repository and calls out what is still in progress.

## 1. Current Backend Scope

Implemented backend services:
- API Gateway (`backend/gateway`)
- User Service (`backend/services/user-service`)
- Credential Service (`backend/services/credential-service`)

Planned in README but not implemented as API services in this repo yet:
- AI Validation and Fraud Detection Service
- Blockchain Interface Service
- Audit Service
- Notification Service
- Document Storage service API (only filesystem folder presence and schema fields exist)

## 2. Base URLs

Default local URLs from current config:
- Gateway: `http://localhost:4000`
- User Service (direct): `http://localhost:5000`
- Credential Service (direct): `http://localhost:5100`

Recommended client entrypoint:
- Use Gateway for all app requests.

## 3. Authentication and Authorization

Authentication provider:
- Clerk JWT via `Authorization: Bearer <token>`

How auth is enforced:
- `requireAuth`: validates Clerk auth, attaches `auth.sub`, and loads local user role/status from DB.
- `requireRoles(...roles)`: requires user role to match.
- `requireApprovedAccount`: requires local user status to be `APPROVED`.

Role enum:
- `STUDENT`
- `ADMIN`
- `REGISTRAR`

User status enum:
- `PENDING`
- `APPROVED`
- `REJECTED`
- `SUSPENDED`

## 4. Common API Behavior

Response format:
- Success: JSON payloads (resource objects/arrays)
- Errors: usually `{ "error": "<message>" }`

Gateway behavior:
- Security headers are added.
- CORS: open if `CORS_ORIGIN` unset; restricted allowlist if set.
- In-memory rate limit: per-IP, 1-minute window, max from `RATE_LIMIT_MAX` (default 100, compose sets 200).
- Returns `429` with `Retry-After` when rate-limited.
- Returns `502` when proxied service is unreachable.

## 5. Gateway Endpoints

### `GET /health`
- Auth: none
- Purpose: gateway health check
- Response:
```json
{
  "status": "ok",
  "service": "api gateway"
}
```

### Proxy routes
- `/users/*` -> User Service
- `/credentials/*` -> Credential Service

## 6. User Service API (Implemented)

All routes below are reachable through gateway as `/users/...`.

### `GET /users/me`
- Auth: required
- Roles: any authenticated user
- Response:
  - `200`: user with `profile` (or `null`)
  - `404`: user not found in local DB
  - `401`: unauthorized

### `POST /users/me/onboarding`
- Auth: required
- Roles: any authenticated user (endpoint forces local role to `STUDENT`)
- Purpose: create/update local user + student profile from Clerk-authenticated account
- Required body:
```json
{
  "firstName": "string",
  "middleName": "string (optional)",
  "lastName": "string",
  "studentNumber": "string",
  "street": "string",
  "barangay": "string",
  "city": "string",
  "province": "string",
  "zipCode": 1234,
  "phone": "string",
  "courseOfStudy": "string",
  "yearLevel": "string",
  "department": "string"
}
```
- Validation:
  - all string fields above (except `middleName`) must be non-empty
  - `zipCode` must be a positive integer
- Response:
  - `200`: upserted user with profile
  - `400`: missing/invalid fields or no usable Clerk email
  - `409`: email already linked to another local account
  - `401`: unauthorized

### `PUT /users/me/profile`
- Auth: required
- Roles: `STUDENT` only
- Purpose: upsert student profile for authenticated student
- Required body:
```json
{
  "studentNumber": "string",
  "street": "string",
  "barangay": "string",
  "city": "string",
  "province": "string",
  "zipCode": 1234,
  "phone": "string",
  "courseOfStudy": "string",
  "yearLevel": "string",
  "department": "string"
}
```
- Response:
  - `200`: updated user with profile
  - `400`: missing/invalid fields
  - `403`: non-student user
  - `401`: unauthorized

### `GET /users`
- Auth: required
- Roles: `ADMIN`, `REGISTRAR`
- Current behavior:
  - Returns all users with profile
  - Ordered by `createdAt desc`
  - Query params are currently ignored by backend
- Response:
  - `200`: `UserWithProfile[]`
  - `403`: forbidden
  - `401`: unauthorized

### `POST /users`
- Auth: required
- Roles: `ADMIN`
- Required body:
```json
{
  "email": "string",
  "firstName": "string",
  "middleName": "string (optional)",
  "lastName": "string",
  "role": "STUDENT | ADMIN | REGISTRAR (optional)"
}
```
- Current behavior:
  - `role` defaults to `STUDENT` when omitted
  - local `status` set to `PENDING`
- Response:
  - `201`: created user with `profile: null`
  - `400`: invalid/missing required fields
  - `403`: forbidden
  - `401`: unauthorized

### `GET /users/:id`
- Auth: required
- Roles: `ADMIN`, `REGISTRAR`
- Response:
  - `200`: user with profile
  - `404`: user not found
  - `403`: forbidden
  - `401`: unauthorized

### `PUT /users/:id/status`
- Auth: required
- Roles: `ADMIN`, `REGISTRAR`
- Required body:
```json
{
  "status": "PENDING | APPROVED | REJECTED | SUSPENDED"
}
```
- Current behavior:
  - If `status = APPROVED`, sets `approvedById` to actor and `approvedAt` to now
  - For other statuses, clears `approvedById` and `approvedAt`
- Response:
  - `200`: updated user (without joined profile in this endpoint)
  - `400`: invalid status
  - `403`: forbidden
  - `401`: unauthorized

### User Service health endpoint status
- A health controller exists in code, but no route is mounted for it in user-service routes.
- Net result: there is **no currently exposed user-service health endpoint**.

## 7. Credential Service API (Implemented)

All routes below are reachable through gateway as `/credentials/...`.

### `GET /credentials/health`
- Auth: none
- Response:
```json
{
  "status": "OK",
  "service": "credential service"
}
```

### `POST /credentials`
- Auth: required
- Account status: must be `APPROVED`
- Roles: `ADMIN`, `REGISTRAR`
- Body:
```json
{
  "studentId": "string",
  "title": "string",
  "type": "TRANSCRIPT | DIPLOMA | CERTIFICATE | DEGREE | LICENSE",
  "description": "string (optional)",
  "issuedById": "string"
}
```
- Current behavior:
  - `status` is always set to `PENDING` on create
  - minimal controller-level validation (invalid payload usually fails at DB layer)
- Response:
  - `201`: created credential
  - `403`: forbidden (role/status gate)
  - `401`: unauthorized

### `GET /credentials/:id`
- Auth: required
- Account status: must be `APPROVED`
- Roles: any approved authenticated role
- Response:
  - `200`: credential
  - `404`: credential not found
  - `403`: account not approved
  - `401`: unauthorized

### `PUT /credentials/:id/status`
- Auth: required
- Account status: must be `APPROVED`
- Roles: `ADMIN`, `REGISTRAR`
- Body:
```json
{
  "status": "PENDING | VERIFIED | ISSUED | REVOKED | EXPIRED"
}
```
- Current behavior:
  - Updates credential status and `updatedAt`
  - No explicit validation in controller; invalid enum values may surface as server error
- Response:
  - `200`: updated credential
  - `403`: forbidden
  - `401`: unauthorized

## 8. Implemented Data Models (DB-level)

Main implemented models used by current APIs:
- `User`
- `StudentProfile`
- `Credential`

Additional schema models exist but do not currently have implemented API endpoints in this repo:
- `CredentialRequest`
- `AuditLog`
- `Notification`

## 9. In-Progress / Not Yet Implemented Endpoints

These are referenced by frontend service code but are not implemented in credential-service routes yet:
- `GET /credentials` (list credentials)
- `GET /credentials?scope=mine`
- `GET /credentials/requests`
- `POST /credentials/requests`
- `PATCH /credentials/requests/:id/status`

User list query parameters are referenced on frontend but not implemented server-side filtering/pagination yet:
- `role`, `status`, `search`, `page`, `pageSize`

## 10. Known Limitations and Notes

- No API versioning (`/v1`) yet.
- No generated OpenAPI/Swagger document yet.
- Validation is stronger in user-service than credential-service.
- Gateway rate limiting is in-memory only (resets on restart; not distributed).
- User and credential services each instantiate DB access independently; shared auth context is not centralized.

