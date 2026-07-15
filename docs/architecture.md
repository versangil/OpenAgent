# OpenAgent architecture

## Overview

```
┌────────────────────────────┐   ┌──────────────────────────┐
│  apps/desktop (Electron)   │   │  apps/web (React/Vite)   │
│  workspace UI, diff review │   │  feature parity target   │
└─────────────┬──────────────┘   └────────────┬─────────────┘
              └──────────────┬────────────────┘
                             ▼
                 ┌───────────────────────┐
                 │  packages/cli          │  openagent-cli
                 │  validate│index│run    │
                 └───────────┬───────────┘
                             ▼
              ┌──────────────────────────────┐
              │  packages/agent-harness      │
              │  manifest.js  → MT-001       │
              │  indexer.js   → MT-003       │
              │  planner.js   → MT-004 (v0)  │
              └───────────┬──────────────────┘
                          ▼
              ┌──────────────────────────────┐
              │  packages/adapters           │  MT-006
              │  contract: complete(request) │
              │  mock │ openai │ anthropic   │
              │  qwen │ local (ollama)       │
              └──────────────────────────────┘
```

Future services (MT-005..009): sandboxed executor, MCP gateway, skills registry, marketplace.

## Key contracts

### Microtask manifest (`microtask/v1`)

Declarative description of a unit of agent work: goal, inputs, allowed actions,
timeout, approval policy, MCP calls, and security constraints. Schema:
`packages/agent-harness/schemas/microtask_schema_v1.json`. The validator is
hand-rolled and dependency-free; it enforces required fields, types, enums, and
security invariants (e.g. `network` must be `deny` or `allowlist`, never `allow`).

### Repo index snapshot

`indexer.js` walks the workspace (skipping `node_modules`, `.git`, binaries),
recording per-file: path, size, language, line count, SHA-256, and identifier
tokens. It emits an inverted token index for planner context retrieval.

### Adapter contract

```js
class Adapter {
  get name() {}                    // provider id
  async complete({ system, prompt, context }) {} // → { text, usage, model }
  async health() {}                // → { ok, detail }
}
```

The planner receives an adapter instance — never a provider name — so providers
swap without planner changes (masterplan MVP acceptance criterion). CI always
uses the deterministic `MockAdapter`; real adapters read API keys from env vars
and fail closed when unset.

### Planner output (`plan.json`)

Ordered steps derived from the manifest goal plus index context, each with an
action from the manifest's `allowed_actions`, a target, and rationale. Also
emits `pr_metadata.json` (title, body, branch name, labels) for PR automation
(MT-011).

## Security invariants

1. Validator rejects manifests requesting unrestricted network.
2. Adapters never log or persist credentials.
3. Planner marks any side-effectful step `requires_approval: true` when the
   manifest's approval policy demands it.
4. Indexer never follows symlinks outside the workspace.

## Decisions

- **Zero runtime dependencies in core** — auditable supply chain, instant CI,
  no install step for the MVP. Revisit per-package when real HTTP clients land.
- **ES modules + node:test** — standard library only, Node ≥ 18.
- **Monorepo with npm workspaces** — shared versioning, single test command.
