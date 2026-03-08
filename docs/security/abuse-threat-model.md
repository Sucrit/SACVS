# Abuse Threat Model

## Severity Bands
- Critical: immediate fraud or tenant-compromise impact with material trust or legal risk
- High: strong abuse path with meaningful operational or privacy impact
- Medium: constrained abuse path or one that requires multiple preconditions
- Low: limited blast radius or hygiene issue

## Critical Scenarios
### Fake institution onboarding for fraudulent issuance
- Actor: external fraudster
- Entry point: institution onboarding and admin approval workflow
- Impact: fraudulent credentials issued under false institutional identity
- Controls: stronger institution proofing, approval review controls, audit review, step-up for critical actions

### Cross-tenant credential or document access
- Actor: malicious or compromised institution or admin workflow
- Entry point: credential detail and document endpoints
- Impact: unauthorized exposure of student credential files and metadata
- Controls: strict backend scope enforcement, document access audit, deny-by-default checks

### Internal-route trust failure
- Actor: attacker or misconfigured internal caller
- Entry point: internal-only service endpoints
- Impact: service impersonation, internal action abuse, notification injection, document leakage
- Controls: mandatory `INTERNAL_SERVICE_TOKEN`, startup validation, fail-closed middleware

## High Scenarios
### Step-up OTP abuse or bypass attempts
- Actor: compromised authenticated user
- Entry point: OTP challenge and verification APIs
- Impact: privileged action execution after repeated or socially engineered verification attempts
- Controls: challenge TTL, max attempts, single-use sessions, audit, mailbox security discipline

### Receipt token abuse for physical claim fraud
- Actor: external abuser or social-engineered third party
- Entry point: approval receipt verification flow
- Impact: false claim attempt against a legitimately approved request
- Controls: single-use token, TTL, claim invalidation on completion, registrar verification workflow

### QR share leakage or replay
- Actor: recipient or third party with leaked link
- Entry point: public QR verify and document token endpoints
- Impact: unauthorized one-time proof consumption or unintended document access
- Controls: TTL, single-use consume, optional document sharing, regeneration invalidation

### Bulk student import misuse
- Actor: malicious institution insider
- Entry point: CSV import and student creation flows
- Impact: synthetic student creation, scope abuse, operational pollution
- Controls: step-up OTP, institution scoping, audit, import validation, anomaly scoring later

### Duplicate issuance caused by split UI or security flow
- Actor: unintended user behavior or race condition
- Entry point: issuance initiation before OTP flow is fully resolved
- Impact: duplicate credential creation and anchoring inconsistency
- Controls: transactional issuance gating after verified step-up, UI idempotency, backend replay protection

## Medium Scenarios
### Notification overload or spam
- Actor: authenticated abuser
- Entry point: notification-capable workflows
- Impact: user confusion and operational noise
- Controls: throttling, audit, role-based restrictions

### Public token brute force
- Actor: automated scanner
- Entry point: QR or receipt verification endpoints
- Impact: endpoint pressure and low-probability token discovery attempts
- Controls: rate limiting, token entropy, minimal responses, anomaly review

### Manual misuse of credential status transitions
- Actor: institution operator
- Entry point: credential management UI
- Impact: inconsistent state and policy drift
- Controls: backend transition rules, disallow no-op or invalid transitions, auto-expiry

## Low Scenarios
### UI confusion between reference code and verification token
- Actor: legitimate operator under poor UX
- Entry point: receipt handling flows
- Impact: support overhead and delayed processing
- Controls: document that the token or URL is authoritative and keep receipt code informational

### Excessive frontend polling or self-DDOS patterns
- Actor: legitimate user behavior
- Entry point: repeated page transitions and reload-heavy UX
- Impact: avoidable infrastructure load
- Controls: realtime updates, cached last-known state, reduced reload-driven UX

## Prioritization Guidance
Fix order should remain:
1. backend scope correctness and internal trust posture
2. step-up and token correctness
3. issuance and state-transition integrity
4. operational UX that reduces accidental misuse
5. ML-assisted detection after the rule-based layer is stable
