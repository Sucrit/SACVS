# SACVS Monitoring & Alert Matrix v1

Date: 2026-03-03

## 1. Data Sources
- AuditLog table (`AuditAction`, `severity`, `actorId`, `actorRole`, `targetType`, `targetId`, `metadata`, `createdAt`)
- Gateway access logs (`method`, `path`, `status`, `duration`, `ip`)
- Service error logs (credential/user/request/notification/blockchain)
- Credential and request lifecycle state transitions
- Notification generation events

## 2. Dashboard Definitions
### D1: Public Verification Abuse
- Metrics:
  - `QR_TOKEN_INVALID` count/min
  - `QR_TOKEN_EXPIRED` count/min
  - successful `QR_TOKEN_CONSUMED` ratio
  - `/credentials/verify/qr` 4xx and 429 rates
- Breakdown: IP, user-agent, /24 subnet, time of day

### D2: Issuance Integrity
- Metrics:
  - credentials issued/revoked per institution
  - issue->revoke latency distribution
  - issue events by actor role
- Correlations: role/status changes within prior 60 minutes

### D3: Account Governance Risk
- Metrics:
  - role changes/day
  - status changes/day
  - privileged action bursts per admin

### D4: Document Access Anomalies
- Metrics:
  - document access grants vs denials
  - QR document token used/invalid/expired outcomes
  - source IP dispersion per credential/share token

## 3. Alert Rules
| Alert ID | Priority | Condition | Window | Action |
|---|---|---|---|---|
| A-001 | P1 | `QR_TOKEN_INVALID + QR_TOKEN_EXPIRED >= 50` and success ratio `< 5%` on public verify route | 5 min | Enable strict throttling profile + notify on-call |
| A-002 | P1 | Any admin role change followed by >10 high-risk mutations (role/status/issue) by same actor | 60 min | Freeze admin mutation routes for actor; force session revoke |
| A-003 | P1 | Internal endpoint access without valid service identity | real-time | Block request path and trigger secret rotation workflow |
| A-004 | P2 | Institution creates >100 students in 15 min | 15 min | Require manual review gate for that tenant |
| A-005 | P2 | Credential request create burst >40 by same actor with >80% rejected/cancelled in 24h | 24 h | Apply cooldown and trust review |
| A-006 | P2 | Upload rejection/signature-fail rate >30% for actor in 10 min | 10 min | Quarantine uploads and flag actor |
| A-007 | P3 | Missing correlation ID on high-risk endpoints >2% | 60 min | Open reliability/security follow-up ticket |
| A-008 | P3 | Drop in expected audit volume >50% vs 7-day baseline | 30 min | Validate logging pipeline health |

## 4. Escalation Path
- P1: Security On-Call + Platform On-Call immediately (<=15 min acknowledgement)
- P2: Service owner + Security Analyst (<=1 hour acknowledgement)
- P3: Backlog triage in next business day

## 5. Weekly Security Review Pack
- Top 10 abusive IPs and actors
- Top 10 affected credentials/institutions
- False-positive and false-negative analysis
- Control tuning proposals (rate limits, thresholds, step-up triggers)

## 6. Implementation Backlog Inputs (Next Phase)
- Correlation ID propagation standard
- Route-class rate limiting policy object
- Explicit public abuse response codes
- Optional `riskContext` schema for audit metadata
