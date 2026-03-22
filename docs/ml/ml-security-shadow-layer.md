# ML Security Shadow Layer

## Objective
Add a metadata-only ML risk scoring layer that operates beside, not instead of, the existing rule-based control stack.

## Locked v1 Decisions
- primary objective: risk scoring
- data boundary: metadata only
- production mode: shadow plus human review
- no request-path enforcement
- no document-content modeling

## Recommended Model Strategy
### Supervised baseline
- Gradient-Boosted Trees using LightGBM and XGBoost
- good fit for tabular security metadata
- explainable and fast enough for practical scoring

### Companion anomaly detector
- Isolation Forest
- catches novel misuse patterns not represented in labels

### Ensemble
- weighted blend of supervised score plus anomaly score
- produces a `0-100` risk score and risk band recommendation

## In-Scope Event Families
- step-up challenge and verification activity
- role and status changes
- credential issue, reissue, and status updates
- bulk student create and import activity
- QR and approval receipt verification behavior
- document preview and download access events
- security-focused gateway request telemetry for:
  - high-risk mutation routes
  - public verification endpoints
  - internal protected endpoints
  - sensitive document and credential access reads when routed through the gateway's security route classes

## Feature Design
### Velocity
- actions per 1m, 5m, and 15m
- failure ratios
- unique targets touched

### Auth and step-up
- challenge count
- verify failures
- challenge locks
- replay patterns

### Access and scope
- denied vs granted ratios
- cross-scope deny attempts
- document access bursts

### Token misuse
- invalid, expired, and used outcomes for QR and receipt flows

### Privileged chains
- role or status changes followed by issuance or bulk operations

### Context
- hour of day
- day of week
- first-seen actor/IP heuristics

### Gateway telemetry
- request velocity by route class in 1m, 5m, and 15m windows
- 401, 403, 429, and 5xx ratios
- repeated rate-limit cooldown and block outcomes
- unique route keys touched per actor/IP window
- latency spikes on abuse-prone endpoints
- repeated public verification attempts across QR and receipt flows

## Privacy Boundary
- no raw OTP codes
- no raw QR or receipt tokens
- no document bytes
- no direct PII like name or email in model inputs
- IP and user-agent should be hashed or normalized before feature storage
- gateway telemetry must persist only hashed IP, hashed user-agent, and hashed actor identity markers
- token-bearing URLs must be normalized before telemetry persistence so raw tokens never land in storage

## Labels
### Weak seed labels
- positive-risk seeds from `SECURITY_ALERT`, repeated `ACCESS_DENIED`, OTP lockouts, and token abuse bursts
- negative seeds from stable low-risk successful flows

### Feedback loop
- analysts later classify records as `confirmed_abuse`, `benign`, or `uncertain`
- analysts also attach a structured reason code plus optional detail and notes
- dataset extraction should prefer analyst-reviewed outcomes over weak seeds whenever
  a `RiskEventRecord.reviewStatus` already exists for the same source event

### Review reason templates
- abuse: `OTP_BRUTE_FORCE`, `TOKEN_ABUSE`, `RATE_LIMIT_ABUSE`, `CROSS_SCOPE_ACCESS`, `PRIVILEGE_MISUSE`, `AUTOMATED_PROBING`, `SUSPICIOUS_BULK_ACTIVITY`, `OTHER_ABUSE`
- benign: `USER_MISTAKE`, `TEST_ACTIVITY`, `EXPECTED_ADMIN_ACTION`, `EXPECTED_INSTITUTION_FLOW`, `FALSE_POSITIVE_PATTERN`, `OTHER_BENIGN`
- uncertain: `NEEDS_MORE_CONTEXT`, `INSUFFICIENT_EVIDENCE`, `MIXED_SIGNALS`

## Offline and Shadow Workflow
1. Extract dataset from metadata logs.
2. Engineer features and store snapshots.
3. Train supervised and anomaly models offline.
4. Register model version metadata.
5. Run shadow scoring asynchronously.
6. Write `RiskEventRecord` rows for operator review.
7. Analysts review the events using reason templates and optional rationale.

## Artifact Layout
- `artifacts/datasets/` stores extracted CSV datasets
- `artifacts/models/` stores trained `.joblib` bundles
- `artifacts/metrics/` stores evaluation summaries
- `artifacts/manifests/` stores `model_manifest.json`

## Runtime Freshness
- `security-service` runs a near-real-time shadow scoring worker on an interval
- the worker scans newly created audit events, adds gateway telemetry context, and inserts unscored `RiskEventRecord` rows only
- `/admin/risk` updates from realtime gateway events after successful shadow scoring passes
- worker health and staleness should be monitored in the admin risk UI

## Retention
- raw gateway telemetry is retained for 30 days
- derived `RiskEventRecord` and `RiskFeatureSnapshot` rows remain available for longer-term analyst review and training history

## Evaluation Criteria Before Any Enforcement
- use time-based train, validation, and test splits
- optimize for PR-AUC, Precision@TopK, and Recall@TopK
- avoid material role bias across student, institution, admin, and employer surfaces
- store feature contributions for explainability
- treat evaluation as non-actionable if validation or test splits contain zero positive
  reviewed samples; keep the model in shadow mode in that case

## Shadow-Mode Exit Rule
- remain in shadow mode until validation and test windows both contain enough
  analyst-reviewed positive events to support meaningful holdout evaluation
- hard rule-based controls remain the production guardrail until that condition is met

## Operational Rule
If the ML pipeline is unavailable, SACVS must continue operating on existing rule-based controls without degraded correctness. Model absence is an observability issue, not a blocker to business flows.

## Boundary Reminder
- Clerk-native sign-in failures are still out of scope unless they are explicitly mirrored into internal audit or telemetry storage
- the ML layer remains advisory only in this phase
