# Service Catalog and API Surface

## Gateway
- Path prefix mapping:
  - `/users` -> user-service
  - `/credentials` -> credential-service
  - `/credentials/requests` -> credential-request-service
  - `/notifications` -> notification-service
  - `/blockchain` -> blockchain-interface-service
- Health route: `GET /health`
- Additional responsibilities:
  - correlation ID middleware
  - route-class rate limiting
  - websocket/realtime hub

## User Service
### Primary responsibilities
- SACVS user record management
- onboarding and profile updates
- institution student CRUD and bulk import
- step-up challenge and step-up session issuance
- audit log retrieval for authorized roles
- admin role/status management

### Important routes
- `GET /users/me`
- `POST /users/me/onboarding`
- `PUT /users/me/onboarding`
- `PUT /users/me/profile`
- `POST /users/me/step-up/challenges`
- `POST /users/me/step-up/challenges/:challengeId/verify`
- `GET /users/me/institution/students`
- `POST /users/me/institution/students`
- `POST /users/me/institution/students/bulk`
- `PUT /users/me/institution/students/:id`
- `DELETE /users/me/institution/students/:id`
- `PUT /users/me/institution/students/:id/status`
- `GET /users/audit`
- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PUT /users/:id/status`
- `PUT /users/:id/role`

## Credential Service
### Primary responsibilities
- credential storage and retrieval
- document encryption and integrity metadata
- issuance and reissue flows
- credential status transitions
- student share QR token lifecycle
- QR-based verification and one-time document token flows
- institution/admin credential detail and document access
- audit entries for document access and sensitive actions

### Important routes
- `GET /credentials`
- `POST /credentials`
- `GET /credentials/:id`
- `GET /credentials/:id/document`
- `PUT /credentials/:id/status`
- `PUT /credentials/:id/issue`
- `POST /credentials/:id/qr-token`
- `POST /credentials/verify/qr`
- `POST /credentials/verify/qr/employer`
- `GET /credentials/verify/qr/document/:token`
- `GET /credentials/internal/documents/:id` (internal-only)

## Credential-Request Service
### Primary responsibilities
- request creation and review lifecycle
- approval/rejection state changes
- request filtering and retrieval
- physical claim flow support
- approval receipt generation and verification

### Important routes
- `GET /credentials/requests/requests`
- `POST /credentials/requests/requests`
- `GET /credentials/requests/requests/:id`
- `PATCH /credentials/requests/requests/:id/status`
- `POST /credentials/requests/requests/:id/mark-physical-claimed`
- `GET /credentials/requests/requests/:id/approval-receipt`
- `POST /credentials/requests/requests/verify-receipt`

## Notification Service
### Primary responsibilities
- in-app notification persistence and retrieval
- unread counts
- mark-read workflows
- internal system notification ingestion

### Important routes
- `GET /notifications/notifications`
- `GET /notifications/notifications/unread-count`
- `PATCH /notifications/notifications/:id/read`
- `PATCH /notifications/notifications/read-all`
- `POST /notifications/notifications/system` (internal-only)

## Blockchain-Interface Service
### Primary responsibilities
- blockchain anchoring and revocation operations
- chain-specific hashing/integrity handling
- service-to-chain isolation from business services

### Integration pattern
- Called through gateway path `/blockchain` and internal service clients.
- Internal token posture is mandatory in production.

## Security Service
### Primary responsibilities
- offline dataset extraction from audit and operational metadata
- feature engineering for risk scoring
- model version registration
- shadow risk scoring record generation

### Current mode
- No inline enforcement
- No document-content modeling
- No request-path dependency for core business operations

## Cross-Service Contract Rules
- Correlation IDs propagate from gateway to downstream services.
- Sensitive route decisions are enforced in the owning service.
- Internal-only routes reject requests without a valid internal token.
- Realtime publication is best-effort and cannot replace successful transaction persistence.
