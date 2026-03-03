# SACVS Abuse Response Playbooks v1

Date: 2026-03-03

## PB-01: Fake Organization Onboarding for Fraudulent Issuance
### Attack path
1. Actor creates organization account with falsified details.
2. Passes weak verification checks.
3. Uses approved status to issue misleading credentials.

### Prevention controls
- Mandatory KYB-like verification checklist for institution/employer onboarding.
- Secondary manual reviewer approval for high-risk applicants.
- Domain reputation and duplicate registration-number checks.

### Detection and alerting
- Alert when newly approved organization performs issuance activity within 24h at abnormal volume.
- Alert on repeated onboarding attempts from shared IP/device fingerprints.

### Response and recovery
- Suspend organization account and freeze issuance endpoints.
- Mark affected credentials for review/revocation workflow.
- Notify impacted students/employers where needed.

### Evidence checklist
- User profile change history, approval actor, onboarding metadata, IP history, first 48h issuance events.

### User comms template
"We detected suspicious organization verification activity and temporarily suspended issuance while we complete a security review."

---

## PB-02: Institution Insider Student Identity Abuse
### Attack path
1. Insider bulk-creates or edits student records.
2. Uses altered records to issue or request fraudulent credentials.

### Prevention controls
- Step-up auth for bulk create/update.
- Maker-checker approval for batches over defined threshold.
- Hard validation for immutable identity fields.

### Detection and alerting
- Alert on high-volume student CRUD by one operator.
- Alert on edits followed by issuance within short interval.

### Response and recovery
- Freeze institution student-management permissions.
- Review affected student records and issuance chain.
- Require re-verification for impacted records.

### Evidence checklist
- Audit events for student create/update/status, actor account state, time-windowed credential issuance.

---

## PB-03: QR Token Leakage / Replay Abuse
### Attack path
1. Student generates one-time verification QR.
2. Token leaks through URL sharing/history/screenshots.
3. Unauthorized verifier consumes token first.

### Prevention controls
- Keep short TTL (<=300s default, lower for sensitive use).
- Clear warning UI about first-consumer semantics.
- Referrer minimization and token redaction in logs.

### Detection and alerting
- Alert on `QR_TOKEN_INVALID`/`QR_TOKEN_USED` spikes immediately after generation.
- Alert on unusual geo/IP mismatch between expected and consuming verifier.

### Response and recovery
- Force token regeneration and invalidate active tokens.
- Notify student of suspicious early consumption.
- If repeated, flag account for support-led investigation.

### Evidence checklist
- Token generation and consume audit events, request logs by IP/User-Agent, timeline of first consume.

---

## PB-04: Document Token Exfiltration Abuse
### Attack path
1. Verifier receives successful QR result.
2. Uses one-time document token for preview/download.
3. Attempts repeated or scripted access.

### Prevention controls
- Default sharing to preview-only; download requires explicit step-up.
- Short TTL and one-time consumption for document token.
- Restrict document token scope strictly to originating QR context.

### Detection and alerting
- Alert on repeated `QR_TOKEN_USED` or `QR_DOCUMENT_ACCESS_NOT_ALLOWED` outcomes.
- Alert on high failure ratios for doc retrieval by IP.

### Response and recovery
- Disable document sharing for credential.
- Regenerate sharing token with stricter options.
- If abuse pattern persists, temporarily block source range.

### Evidence checklist
- Doc token lifecycle logs, access mode (preview/download), source IP distribution, timing correlation.

---

## PB-05: Public Endpoint Automation / Scraping
### Attack path
1. Botnet sends high-rate verification attempts.
2. Exploits weak or instance-local rate limits.
3. Causes service degradation or token probing.

### Prevention controls
- Per-route class throttles with stricter public limits.
- Burst + sustained window controls.
- Abuse fingerprinting and deny-listing.

### Detection and alerting
- 429 surge, high request-per-IP/subnet, low success ratio.
- Sudden increase in malformed token payloads.

### Response and recovery
- Enable emergency strict profile.
- Block abusive CIDRs and user agents.
- Scale gateway and isolate impacted routes.

### Evidence checklist
- Gateway request logs, per-route status trends, source concentration metrics.

---

## PB-06: Credential Request Spam / Coercion
### Attack path
1. Actor creates excessive credential requests.
2. Attempts to pressure institutions or overwhelm workflows.

### Prevention controls
- Per-account and per-tenant request quotas.
- Cool-down periods after repeated rejected/cancelled patterns.

### Detection and alerting
- Alert on request-creation bursts and low approval ratio.
- Alert on repetitive content/purpose patterns.

### Response and recovery
- Temporary suspension of request create permissions.
- Queue review and institution notification.

### Evidence checklist
- Request history by actor, status outcomes, text similarity indicators.

---

## PB-07: Privilege Abuse (Role/Status Changes)
### Attack path
1. Compromised or malicious admin updates roles/statuses.
2. Uses elevated privileges to alter platform state.

### Prevention controls
- Mandatory step-up on role/status changes.
- Two-person approval for admin-to-admin or broad privilege grants.

### Detection and alerting
- Alert on role changes followed by high-risk actions within 60 minutes.
- Alert on after-hours privileged activity.

### Response and recovery
- Revoke privileged sessions/tokens immediately.
- Freeze role/status mutation endpoints.
- Audit and revert unauthorized changes.

### Evidence checklist
- Full audit chain for role/status updates, auth events, downstream high-risk actions.

---

## PB-08: Internal Endpoint Misuse
### Attack path
1. Actor reaches internal endpoint.
2. Missing/misconfigured token allows pass-through.
3. Data access or notification abuse occurs.

### Prevention controls
- Fail-closed policy if `INTERNAL_SERVICE_TOKEN` is unset.
- Startup checks that abort service if internal auth secret missing.

### Detection and alerting
- Alert on any internal route call without valid service identity.
- Alert on unusual caller patterns for internal endpoints.

### Response and recovery
- Block internal route exposure immediately.
- Rotate internal secrets and restart affected services.

### Evidence checklist
- Internal endpoint access logs, environment validation logs, secret rotation timeline.

---

## PB-09: Malicious File Upload Content
### Attack path
1. Actor uploads disguised or harmful file.
2. File gets stored and later previewed/downloaded.

### Prevention controls
- Validate file signatures (magic bytes), not MIME only.
- Add malware/content scanning for uploads.
- Restrict parser behavior for risky file types.

### Detection and alerting
- Alert on repeated invalid signature/upload failures.
- Alert when a tenant has abnormal upload rejection rate.

### Response and recovery
- Quarantine suspicious files.
- Temporarily disable uploads for offending actor/tenant.

### Evidence checklist
- Upload metadata, scanner output, issuing actor context, affected retrieval attempts.

---

## PB-10: Audit Traceability Gaps / Evasion
### Attack path
1. Actor performs multi-service abuse chain.
2. Insufficient correlation across logs obscures timeline.

### Prevention controls
- Correlation-ID propagation gateway -> all services.
- Redaction standards for sensitive values (tokens, secrets, raw PII where possible).
- Tamper-evident log retention pipeline.

### Detection and alerting
- Alert on missing correlation IDs in high-risk routes.
- Alert on anomalous drop in expected audit volume.

### Response and recovery
- Preserve forensic snapshot (logs + DB + route metrics).
- Build timeline from immutable events first.
- Open corrective action ticket for logging gaps.

### Evidence checklist
- Audit logs, gateway logs, service logs, incident timeline worksheet.
