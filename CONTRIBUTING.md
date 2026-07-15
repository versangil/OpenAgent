# Contributing to OpenAgent

## Workflow

1. Pick a microtask from [docs/backlog.md](docs/backlog.md) (or open an issue proposing one).
2. Create a feature branch from `main`: `feat/MT-XXX-short-name`.
3. Implement code + unit tests + docs. Update `AGENTS.md` if agent-facing behavior changes.
4. Open a PR with the checklist below.
5. CI must pass (lint, unit, integration with mocked adapters, sandbox security tests).
6. One approving review required; security-sensitive changes need a security review.
7. Squash-merge to `main`.

## PR checklist

- [ ] Tests added/updated and passing locally (`npm test`)
- [ ] No external API calls in tests — use the mock adapter
- [ ] No secrets, tokens, or credentials in code or fixtures
- [ ] Docs updated (README, AGENTS.md, or docs/ as applicable)
- [ ] Backlog item referenced in PR description (e.g. `MT-004`)

## Code style

- Node >= 18, ES modules, zero runtime dependencies in core packages unless justified in the PR
- Small, single-purpose modules; every exported function documented with JSDoc
- Critical and high-severity bugs block merge to `main`

## Testing

```bash
npm test          # all suites (node:test)
node --test packages/agent-harness/test   # one package
```

## Reporting bugs

Open an issue with reproduction steps. Security vulnerabilities: see [SECURITY.md](SECURITY.md) — do not open public issues.
