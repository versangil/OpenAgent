# AGENTS.md — Agent operating manual for OpenAgent

This file tells coding agents (and humans) how to work in this repository.

## Ground rules

- Node >= 18, ES modules, zero runtime dependencies in core packages.
- Every change ships with tests. Run `npm test` before proposing a diff.
- Never call external provider APIs in tests — use `packages/adapters/src/mock.js`.
- Never write secrets into files. Credentials are environment variables only.
- Side effects (git push, publish, network egress) require explicit human approval.

## Microtask manifests

All agent work is described by a manifest conforming to
`packages/agent-harness/schemas/microtask_schema_v1.json`. Example:

```json
{
  "schema": "microtask/v1",
  "id": "MT-EX-001",
  "title": "Add input validation to indexer",
  "goal": "Reject non-existent workspace paths with a clear error",
  "inputs": { "workspace": "." },
  "allowed_actions": ["read", "write", "run_tests"],
  "timeout_seconds": 600,
  "approval_policy": "require_approval_for_side_effects",
  "mcp_calls": [],
  "security": { "network": "deny", "filesystem": "workspace_only" }
}
```

Validate with: `node packages/cli/src/cli.js validate <manifest.json>`

## Standard agent loop

1. `openagent-cli index <workspace>` — snapshot the repo index.
2. `openagent-cli run --manifest <m.json> --workspace <w> --dry-run` — produce `plan.json` + `pr_metadata.json`.
3. Implement plan steps; keep edits minimal and scoped to the manifest goal.
4. `npm test` — all suites must pass.
5. Emit staged diff for human review. Never push without approval.

## Package map

| Path | Purpose | Tests |
|---|---|---|
| `packages/agent-harness` | manifest validator, indexer, planner | `packages/agent-harness/test` |
| `packages/adapters` | provider adapter contract + implementations | `packages/adapters/test` |
| `packages/cli` | `openagent-cli` command surface | `packages/cli/test` |

## Conventions

- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- Branches: `feat/MT-XXX-short-name`.
- Diff style: staged, reviewable patches; no drive-by refactors.
