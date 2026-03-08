# Monitoring and Incident Response

## Monitoring Objectives
- detect abuse attempts early
- reconstruct incident timelines by correlation ID
- identify drift in privileged actions and verification misuse
- measure whether controls are blocking the right things without overwhelming operators

## Core Data Sources
- `AuditLog`
- gateway request logs
- service error logs
- step-up challenge and session outcomes
- QR and receipt token verification outcomes
- credential and request lifecycle transitions
- shadow ML risk records

## Minimum Dashboards
### Access and abuse
- 401, 403, 429, and 5xx counts by route class
- invalid vs expired vs used token verification rates
- access granted vs denied document fetches

### Privileged actions
- role and status changes over time
- issuance, reissue, revoke, and expiry transitions
- bulk student import volume and failure ratios

### Verification
- QR verification success and failure ratio
- approval receipt validation outcomes
- mark-claimed completion volume

### ML shadow mode
- score distribution by role and action
- high and critical recommendations awaiting review
- false-positive outcomes after analyst review

## Suggested Alert Conditions
### P1
- sustained invalid or expired public verification bursts with minimal success
- any internal-route auth misconfiguration or repeated internal auth failures
- suspicious chain of role or status change followed by issuance or bulk actions

### P2
- repeated OTP verification failures or lockouts for a single actor
- repeated denied document access across multiple target credentials
- approval receipt abuse bursts during registrar workflows

### P3
- missing correlation IDs on high-risk events
- sudden drop in audit volume for known active surfaces
- realtime publish failures trending upward

## Incident Response Playbook
### 1. Contain
- suspend or limit the affected actor, tenant, token family, or public path
- disable affected privileged UI controls if a backend integrity issue is suspected

### 2. Preserve evidence
- capture correlation IDs
- extract relevant audit rows
- retain gateway and service logs
- preserve model risk records if shadow analysis flagged the event

### 3. Triage scope
- determine whether the incident is tenant-local or cross-tenant
- identify whether document bytes, status transitions, or privileged changes were involved

### 4. Correct
- patch route scope, state-transition guardrails, or delivery configuration
- rotate secrets if internal trust or token-generation material may be compromised
- notify affected stakeholders where necessary

## Operator Guidance
- Treat email OTP delivery failures as a security degradation, not just a messaging bug.
- Treat repeated 429s from a single workflow as a sign to inspect UX-driven loops as well as malicious traffic.
- Treat denied document access spikes as possible tenant-boundary probing.
