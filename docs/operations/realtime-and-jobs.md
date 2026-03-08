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

## Recommended Operator Checks
- gateway websocket connections active and stable
- service-to-gateway publish errors absent or low
- expiry automation not drifting or stalling
- shadow risk jobs writing records on schedule
- stale client state complaints investigated against realtime event logs and correlation IDs
