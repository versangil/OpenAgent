# Cline Rules — OpenAgent

## Ground rules

- Node >= 18, ES modules, zero runtime dependencies in core packages.
- Every change ships with tests. Run `npm test` before proposing a diff.
- Never call external provider APIs in tests — use `packages/adapters/src/mock.js`.
- Never write secrets into files. Credentials are environment variables only.
- Side effects (git push, publish, network egress) require explicit human approval.
- Deny-by-default network policy for agents; explicit allowlists only.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- Branches: `feat/MT-XXX-short-name`.

## Microtask manifests

All agent work is described by a manifest conforming to `packages/agent-harness/schemas/microtask_schema_v1.json`.

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
| `packages/skills` | skill manifests, implementations | `packages/skills/test` |

## Conventions

- Keep core packages zero-dependency; add HTTP/network adapters only as optional providers.
- Use `node:test` runner; no third-party test frameworks.
- Mock adapters must be deterministic for CI.
- Skills use standardized manifests with inputs/outputs and sandboxed execution.
- MCP connectors are isolated, stateless, and fail-closed on missing credentials.
- Hooks fire after events; never block critical paths without timeout.