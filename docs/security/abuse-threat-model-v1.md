# SACVS Platform Abuse & Illegal-Use Threat Model v1

Date: 2026-03-03  
Scope: External + Insider threats  
Mode: Analysis-only (no code implementation in this phase)

## 1. Summary
This document defines the fraud/abuse threat model for SACVS, grounded in the current architecture:
- Gateway routes: `/users`, `/credentials`, `/credentials/requests`, `/notifications`, `/blockchain`
- Public verification routes: `POST /credentials/verify/qr`, `GET /credentials/verify/qr/document/:token`, and frontend `/verify/qr/:token`
- Internal service endpoints protected by `x-internal-service-token`
- Credential files encrypted at rest with integrity checks
- One-time QR token model with atomic consume and short TTL

Primary outputs in this package:
1. Ranked risk register
2. Scenario playbooks (prevent/detect/respond)
3. Monitoring + alert matrix

## 2. Objectives and Success Criteria
Objectives:
- Identify realistic abuse paths for fraudsters, scammers, and insiders.
- Rank risk by exploitability and impact.
- Define balanced-friction controls (block/challenge/throttle/observe).
- Define operational response playbooks and ownership.

Success criteria:
- Every Critical/High scenario has owner + SLA + containment actions.
- Every top-10 scenario maps to prevention + detection + response.
- Monitoring thresholds are concrete and actionable.

## 3. Assets and Trust Boundaries
High-value assets:
- Credential files and metadata
- Student PII (full name, student number, email)
- Issuance/revocation and request workflow state
- One-time verification tokens and document share tokens
- Audit logs and incident evidence

Trust boundaries:
- Public internet -> Gateway
- Gateway -> backend services
- Service-to-service internal routes (header token)
- Application -> database
- Application -> local encrypted upload storage
- Application -> blockchain interface

## 4. Threat Actor Profiles
1. Opportunistic external attacker (credential probing, scraping, abuse automation)
2. Credential-fraud actor (social engineering + fake institution/employer identities)
3. Automated spammer/scraper (high-volume request and verify abuse)
4. Malicious institution insider (student identity manipulation, improper issuance)
5. Malicious employer insider (PII harvesting, document misuse)
6. Compromised or over-privileged admin account
7. Compromised student account (token leakage, phishing-driven abuse)

## 5. Risk Scoring Method
Score formula:
- Likelihood (1-5)
- Impact (1-5)
- Detectability Gap (1-3)
- Priority Score = (Likelihood * Impact) + Detectability Gap

Severity:
- Critical: 21+
- High: 15-20
- Medium: 9-14
- Low: <=8

## 6. Balanced-Friction Control Decisions
Always block:
- Cross-scope access attempts (student/institution/employer boundaries)
- Used/expired/invalid one-time tokens
- Missing mandatory institution context for scoped actions

Challenge (step-up):
- Admin role and status changes
- Institution bulk student creation above threshold
- Credential issuance + blockchain anchoring operations
- Enabling QR-based document download access

Throttle:
- Public QR verification endpoint usage spikes
- Repeated QR document token retrieval attempts
- Credential request create/update bursts

Observe + alert:
- Distributed medium-rate invalid QR attempts
- Elevated rejection/cancellation patterns per actor

## 7. Required Deliverables in this Package
- `risk-register-v1.csv`: ranked scenarios, owner, SLA, due dates
- `playbooks-v1.md`: detailed prevention/detection/response playbooks
- `monitoring-alert-matrix-v1.md`: detection sources, thresholds, priorities

## 8. Operational Rollout (Analysis Work)
- Workshop 1 (2h): Threat enumeration by service and role
- Workshop 2 (90m): Scoring calibration and priority lock
- Workshop 3 (90m): Incident playbook review with security + operations + legal liaison
- Publish v1 package and track weekly for first 4 weeks, then monthly

## 9. Assumptions
- Scope includes external and insider misuse.
- This phase does not modify code or infrastructure.
- Owners are role-based until named assignees are confirmed.
- Dates in this package are based on current date 2026-03-03.
