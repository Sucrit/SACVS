# SACVS Documentation

This folder is the canonical documentation set for SACVS. It is organized by architecture, development, operations, features, security, and ML shadow scoring rather than as a collection of ad hoc notes.

## Documentation Map

### Architecture
- [System Overview](./architecture/system-overview.md): purpose, component boundaries, runtime topology, and request flow.
- [Service Catalog and API Surface](./architecture/service-catalog.md): service responsibilities, ports, routes, and integration contracts.
- [Data Model Overview](./architecture/data-model.md): core entities, statuses, security tokens, and risk records.

### Development
- [Local Development Guide](./development/local-development.md): prerequisites, startup flow, migrations, and local workflows.
- [Configuration Reference](./development/configuration.md): environment variables, secrets, defaults, and configuration cautions.

### Operations
- [Deployment and Operations Guide](./operations/deployment-and-operations.md): deployment order, health checks, and production posture.
- [Realtime and Background Processing](./operations/realtime-and-jobs.md): websocket flow, event publishing, auto-expiry, and offline jobs.

### Features
- [Credential Lifecycle](./features/credential-lifecycle.md): issuance, expiry, reissue, revocation, and institution visibility rules.
- [QR and Approval Receipt Verification](./features/qr-and-receipt-verification.md): one-time QR flows, receipt verification, and physical claim workflows.

### Security
- [Security Architecture](./security/security-architecture.md): authz, step-up OTP, one-time tokens, rate limiting, encryption, and audit.
- [Abuse Threat Model](./security/abuse-threat-model.md): fraud and misuse scenarios categorized by severity.
- [Monitoring and Incident Response](./security/monitoring-and-incident-response.md): alert conditions, dashboards, and operator playbooks.

### ML Security Layer
- [ML Security Shadow Layer](./ml/ml-security-shadow-layer.md): metadata-only risk scoring design, model strategy, and shadow rollout.

## Documentation Standards
- Documentation must reflect the current codebase, not historical behavior.
- When service defaults diverge, explicit environment configuration is authoritative.
- Security documents describe implementation boundaries and controls without exposing secrets or reusable token material.
- Feature documents must describe both intended workflows and guardrails.

## Audience Guide
- Engineers starting locally: begin with `development/local-development.md`.
- Engineers changing service behavior: read `architecture/system-overview.md` first, then the relevant feature and security document.
- Operators: read `operations/deployment-and-operations.md` and `security/monitoring-and-incident-response.md`.
- Reviewers and auditors: read `security/security-architecture.md`, `security/abuse-threat-model.md`, and `ml/ml-security-shadow-layer.md`.
