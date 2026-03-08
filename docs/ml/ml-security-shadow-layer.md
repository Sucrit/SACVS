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
- Gradient-Boosted Trees using LightGBM or XGBoost
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

## Privacy Boundary
- no raw OTP codes
- no raw QR or receipt tokens
- no document bytes
- no direct PII like name or email in model inputs
- IP and user-agent should be hashed or normalized before feature storage

## Labels
### Weak seed labels
- positive-risk seeds from `SECURITY_ALERT`, repeated `ACCESS_DENIED`, OTP lockouts, and token abuse bursts
- negative seeds from stable low-risk successful flows

### Feedback loop
- analysts later classify records as `confirmed_abuse`, `benign`, or `uncertain`

## Offline and Shadow Workflow
1. Extract dataset from metadata logs.
2. Engineer features and store snapshots.
3. Train supervised and anomaly models offline.
4. Register model version metadata.
5. Run shadow scoring asynchronously.
6. Write `RiskEventRecord` rows for operator review.

## Evaluation Criteria Before Any Enforcement
- use time-based train, validation, and test splits
- optimize for PR-AUC, Precision@TopK, and Recall@TopK
- avoid material role bias across student, institution, admin, and employer surfaces
- store feature contributions for explainability

## Operational Rule
If the ML pipeline is unavailable, SACVS must continue operating on existing rule-based controls without degraded correctness. Model absence is an observability issue, not a blocker to business flows.
