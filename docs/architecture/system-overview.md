# System Overview

## Purpose
SACVS is a multi-service credential issuance and verification platform for institution-managed academic credentials. It supports student onboarding, institution-scoped student management, credential request workflows, credential issuance, one-time public verification, approval receipts for physical claim workflows, audit logging, step-up verification, realtime UI updates, and a metadata-only ML risk scoring layer in shadow mode.

## Runtime Topology

### Frontend
- React/Vite SPA on port `5173` in local development.
- Uses Clerk for browser authentication.
- Connects to the gateway for all business APIs.
- Subscribes to realtime updates through the gateway websocket hub.

### Gateway
- Express-based HTTP gateway.
- Default local port: `4000`.
- Responsibilities:
  - route proxying to backend services
  - route-class rate limiting
  - correlation ID propagation
  - websocket hub for realtime updates
  - service boundary error normalization

### Backend Services
- `user-service` (`5000`): users, onboarding, profile updates, institution student management, step-up OTP, audit retrieval.
- `credential-service` (`5100`): credentials, encrypted document storage, issuance, reissue, document access, QR verification.
- `credential-request-service` (`5200`): student request lifecycle, approval/rejection, physical claim workflows, approval receipts.
- `notification-service` (`5300`): in-app notifications and internal system notification delivery.
- `blockchain-interface-service` (`5400`): blockchain anchoring and chain-facing logic.
- `security-service`: offline dataset extraction, feature building, model registration, and shadow risk scoring.

### Shared Data Layer
- PostgreSQL via Prisma.
- Shared schema: `backend/db/schema.prisma`.
- Services generate clients against the shared schema.

## Core Interaction Flows

### User and Institution Flow
1. Clerk authenticates the user.
2. Frontend sends authenticated requests through the gateway.
3. `user-service` creates or updates SACVS-side user and onboarding state.
4. Institution accounts manage student records under institution scope.

### Credential Request Flow
1. Student creates a credential request through `credential-request-service`.
2. Institution reviews and updates request status.
3. For `PHYSICAL` or `BOTH` delivery, approval triggers approval receipt generation.
4. Institution can mark physical claim complete after registrar verification.

### Credential Issuance Flow
1. Institution or admin initiates issuance.
2. Step-up OTP is required for high-risk issuance actions.
3. `credential-service` stores encrypted files and creates or updates credential records.
4. `blockchain-interface-service` anchors blockchain metadata when issuance succeeds.
5. Realtime events notify subscribed clients to refresh local state.

### Verification Flow
- Student share QR tokens are one-time, short-lived, and hash-at-rest.
- Receipt verification tokens are one-time, short-lived, and hash-at-rest.
- Public verification returns minimal proof data only.

## Trust Boundaries
- Browser to gateway: authenticated public edge.
- Gateway to services: service-to-service trust with correlation IDs and internal token enforcement where required.
- Public verification endpoints: intentionally exposed, constrained by single-use tokens, TTL, and minimal payloads.
- Internal routes: must fail closed when `INTERNAL_SERVICE_TOKEN` is missing or invalid.

## Realtime Model
- The gateway hosts the websocket entry point.
- Services publish operational events back to the gateway.
- Frontend pages keep last-known state and update from realtime events instead of repeated reload-driven fetches.
- Realtime is additive; persistence and security decisions still belong to the services.

## Design Priorities
- Tenant and institution scope enforcement must live in backend services.
- High-risk actions require step-up verification.
- Sensitive tokens are single-use, time-bound, and never stored raw.
- Audit trails must be reconstructable by correlation ID and actor context.
- ML scoring remains shadow-only and cannot weaken rule-based correctness.
