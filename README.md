# OpenAgent

Open-source, cross-platform agentic AI IDE (desktop + web) with full MCP/Skills/Marketplace support and provider-agnostic adapters compatible with Codex and Claude ecosystems.

## Vision

OpenAgent lets developers run auditable, sandboxed AI agents against their repositories: index the codebase, plan multi-file changes, produce staged diffs for human review, and automate PR workflows — with any model provider (OpenAI, Anthropic, Qwen, or local runtimes via Ollama/llama.cpp).

## Status

**Milestone 2 in progress — Scaffold & MVP CLI.** Working today:

- `openagent-cli validate` — validate microtask manifests against `microtask_schema_v1`
- `openagent-cli index` — snapshot a repository index (file metadata, hashes, token search index)
- `openagent-cli run --dry-run` — plan a microtask against an index using a swappable provider adapter (mock adapter by default) and emit `plan.json` + PR metadata

See [docs/backlog.md](docs/backlog.md) for the full roadmap and [docs/architecture.md](docs/architecture.md) for system design.

## Repository layout

```
apps/desktop        Electron + React + TypeScript desktop shell (skeleton)
apps/web            React + Vite + TypeScript web app (skeleton)
packages/agent-harness   Manifest validation, repo indexer, planner
packages/adapters   Provider adapter SDK: mock, OpenAI, Anthropic, Qwen, local
packages/cli        openagent-cli entry point
microtasks/         Example microtask manifests
infra/              Deployment and sandbox infrastructure
ci/                 CI helpers and lint
docs/               Masterplan, architecture, backlog
```

## Quick start

Requires Node.js >= 18. The MVP core has zero runtime dependencies.

```bash
# validate the example manifest
node packages/cli/src/cli.js validate microtasks/example_manifest.json

# index this repository
node packages/cli/src/cli.js index . --out index_snapshot.json

# dry-run a microtask (mock adapter, no network)
node packages/cli/src/cli.js run --manifest microtasks/example_manifest.json --workspace . --dry-run

# run the test suite
npm test
```

## Provider adapters

Adapters implement a single contract (`packages/adapters/src/adapter.js`) so the planner never depends on a specific provider. The mock adapter is deterministic and used in CI; real adapters read credentials from environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, ...) and are never bundled with secrets.

## Security model

- Deny-by-default network policy for agent execution (sandbox executor lands in MT-005)
- Explicit human approval required for side effects (push, publish, billing)
- No secrets in the repo or artifacts — see [SECURITY.md](SECURITY.md)
- Immutable audit logs for agent decisions and tool calls (planned)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All work flows through microtasks defined in [docs/backlog.md](docs/backlog.md); PRs require passing CI.

## License

[MIT](LICENSE)
