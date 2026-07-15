# OpenAgent backlog

Seeded from `docs/openagent_masterplan.json`. Status legend: ✅ done · 🔨 in progress · ⬜ pending

## Milestones

| # | Milestone | Weeks | Status |
|---|---|---|---|
| 1 | Discovery & Architecture | 2 | 🔨 |
| 2 | Scaffold & MVP CLI | 4 | 🔨 |
| 3 | Desktop Shell + Repo Indexer | 6 | ⬜ (indexer service delivered early) |
| 4 | Provider Adapter Framework & Local Bridge | 6 | 🔨 (contract + mock delivered) |
| 5 | MCP Connectors & Skills SDK | 6 | ⬜ |
| 6 | Marketplace & Security Audit | 8 | ⬜ |
| 7 | Polish, QA, and Launch | 4 | ⬜ |

## Microtasks

| ID | Title | Est. days | Status |
|---|---|---|---|
| MT-001 | Microtask manifest schema | 3 | ✅ schema v1 + example + validator |
| MT-002 | OpenAgent CLI scaffold | 10 | 🔨 validate/index/run --dry-run shipped; sandbox exec + staged diffs pending |
| MT-003 | Repo indexer | 7 | ✅ walker, hashes, token index, snapshot |
| MT-004 | Planner and staged diff generator | 8 | 🔨 planner v0 shipped (adapter-backed); diff generator pending |
| MT-005 | Sandboxed executor | 10 | ⬜ |
| MT-006 | Provider adapter SDK and example adapters | 12 | 🔨 contract + mock + provider stubs; real HTTP clients pending |
| MT-007 | MCP gateway and connector SDKs | 12 | ⬜ |
| MT-008 | Skills SDK and registry | 10 | ⬜ |
| MT-009 | Marketplace registry and review automation | 14 | ⬜ |
| MT-010 | Desktop UI skeleton and workspace UX | 14 | ⬜ (folder skeletons only) |
| MT-011 | PR automation and CI templates | 7 | 🔨 CI workflow + PR metadata generator shipped |
| MT-012 | Docs, AGENTS.md examples, and onboarding | 8 | 🔨 AGENTS.md + docs seeded |
| MT-013 | Accessibility and UX polish | 7 | ⬜ |
| MT-014 | Security hardening and audit fixes | 10 | ⬜ |
| MT-015 | Release packaging and installers | 7 | ⬜ |

## Quality gates (from masterplan)

- All tests passing; no critical/high security findings
- Critical bugs: 0 · High bugs: 0 · Medium: ≤ 5 pre-launch
- Usability (SUS) ≥ 85 · WCAG 2.1 AA
- Unit coverage ≥ 80% module-level
