# Security Policy

## Reporting a vulnerability

Do **not** open a public issue for security vulnerabilities. Email the maintainers (see repository owner profile) with a description, reproduction steps, and impact assessment. You will receive an acknowledgment within 72 hours and a remediation timeline within 7 days.

## Principles

- **Least privilege** — agents only get the capabilities their manifest declares.
- **Explicit user approval for side effects** — pushing upstream, publishing, or billing actions always require human confirmation.
- **No secrets in artifacts** — credentials come from the environment at runtime; CI scans block committed secrets.
- **Opt-in telemetry only** — no data leaves the machine unless the user enables it.

## Sandbox controls (target state, MT-005)

| Control | Policy |
|---|---|
| Network | Deny by default; allowlist provider/marketplace endpoints |
| Filesystem | Workspace + temp only; no host root access |
| Processes | CPU/memory/time quotas |
| Actions | Whitelist: git, npm/pip install, run tests, format |

## Audit and logging

Agent decisions, tool calls, and user approvals are written to immutable, tamper-evident logs (planned; see backlog MT-005/MT-014).

## Data and privacy

Telemetry is opt-in. PII handling, data retention, and deletion procedures will be documented here before the first production release (Milestone 6 security audit gate).

## Supported versions

Pre-1.0: only the latest `main` receives security fixes.
