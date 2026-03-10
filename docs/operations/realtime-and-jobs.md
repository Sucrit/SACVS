# Realtime and Background Processing

## Realtime Architecture
- The gateway owns the websocket hub.
- Backend services publish update events to the gateway over HTTP.
- Frontend pages hold last-known state and patch or refresh from realtime events.

## Realtime Goals
- reduce repeated polling and self-generated traffic
- keep multi-role dashboards updated after state changes
- preserve page continuity as users navigate between sections

## Operational Notes
- Realtime publication is best-effort and is never the persistence path.
- A failed realtime publish does not invalidate a successful business transaction.
- Realtime consumers still need resilient initial fetch logic.

## Known Configuration Risk
Some services still default `REALTIME_GATEWAY_URL` to `http://localhost:4900` while the gateway defaults to `4000`. In any real environment, set the gateway URL explicitly in every publishing service.

## Background and Automated Behaviors
### Credential auto-expiry
- Expiry is determined by `expiryDate`.
- Credentials should transition automatically to `EXPIRED` when the expiry boundary is reached.
- Institutions should not manually drive expiry as a substitute for policy.
- Expired credentials remain locked except for permitted reissue flows.

### Token expiry
- QR tokens, QR document tokens, receipt tokens, and step-up sessions are all time-bound.
- Expired and used tokens must resolve deterministically and be auditable.

### Security-service offline jobs
- dataset extraction jobs build feature-ready metadata samples
- shadow scoring jobs create risk event records without affecting request execution
- model registration records version metadata only and does not wire enforcement

### Security-service near-real-time worker
- `security-service` runs an interval-based shadow scorer when autorun is enabled
- the worker scans new `AuditLog` rows, enriches them with security-focused gateway telemetry, and inserts only unscored `RiskEventRecord` rows
- successful scoring passes publish `SECURITY_RISK_EVENTS_UPDATED` through the existing gateway realtime hub so `/admin/risk` refreshes automatically
- the worker also performs raw gateway telemetry cleanup on a scheduled interval
- worker health is surfaced in the admin risk review page and should be treated as degraded when no successful pass occurs within roughly two scoring intervals

### Gateway security telemetry
- the gateway persists a normalized telemetry record for security-focused routes only
- captured fields include route class, normalized route key, response outcome, rate-limit outcome, hashed IP, hashed user-agent, and hashed actor identity markers
- generic page loads and low-risk CRUD traffic are intentionally excluded to control data volume
- raw gateway telemetry should be retained for 30 days and then deleted without affecting already derived risk records

## Recommended Operator Checks
- gateway websocket connections active and stable
- service-to-gateway publish errors absent or low
- expiry automation not drifting or stalling
- shadow risk jobs writing records on schedule
- gateway security telemetry ingest counts non-zero for abuse-prone routes
- raw telemetry cleanup running on schedule
- stale client state complaints investigated against realtime event logs and correlation IDs
