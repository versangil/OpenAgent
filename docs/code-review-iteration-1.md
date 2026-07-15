# Ponytail Code Review — Iteration 1

## Audit Findings

### Critical Issues
1. **`packages/skills/src/registry.js`** — `__dirname` and `__filename` are computed but never used (unnecessary computation)
2. **`packages/skills/src/executor.js`** — `_executeWithTimeout` mixes async/await with `.then()` callbacks; `this.sandbox` is set but never enforced
3. **`packages/plugins/src/plugin-manager.js`** — `readFile` is imported from `fs/promises` but never used
4. **No executor tests** — `packages/skills/test/` has no `executor.test.js`
5. **No plugin-manager tests** — `packages/plugins/test/` has no `plugin-manager.test.js`
6. **No integration tests** — No cross-package integration tests

### Medium Issues
7. **`packages/mcp-gateway/src/gateway.js`** — `_discoverTools` is `async` but performs no actual async work
8. **MCP Gateway** — No transport abstraction for stdio/TCP/HTTP connections
9. **Error handling** — No consistent error boundary pattern across packages

### Minor Issues
10. **Manifests** — No version field, making skill evolution tracking difficult
11. **`packages/skills/src/validator.js`** — No support for `enum` validation on input fields

## Improvements Applied

### Fix: executor.js — Clean up async patterns and enforce sandbox
- Convert `_executeWithTimeout` to consistent async/await
- Add sandbox enforcement that restricts `allowed_actions`

### Fix: registry.js — Remove unused imports
- Remove unused `__filename` and `__dirname` declarations

### Fix: plugin-manager.js — Remove unused import
- Remove `readFile` import

### New: executor.test.js
- Comprehensive tests for execution, timeout, output size limits, sandbox enforcement

### New: plugin-manager.test.js
- Tests for plugin lifecycle (register, activate, deactivate, unregister)

### Enhancement: gateway.js — Add transport config validation
- Validate transport type on connect

### Enhancement: validator.js — Add enum validation support
- Input fields can now specify `enum` values for validation