import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateManifest, parseManifest } from '../src/manifest.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = join(HERE, '..', '..', '..', 'microtasks', 'example_manifest.json');

const valid = () => ({
  schema: 'microtask/v1',
  id: 'MT-100',
  title: 'A perfectly reasonable microtask',
  goal: 'Do a small, well-scoped thing to the codebase.',
  inputs: { workspace: '.' },
  allowed_actions: ['read', 'write', 'run_tests'],
  timeout_seconds: 600,
  approval_policy: 'require_approval_for_side_effects',
  mcp_calls: [],
  security: { network: 'deny', filesystem: 'workspace_only' },
});

test('example manifest in repo validates', () => {
  const { valid: ok, errors } = parseManifest(readFileSync(EXAMPLE, 'utf8'));
  assert.equal(ok, true, errors.join('; '));
});

test('accepts a fully valid manifest', () => {
  const result = validateManifest(valid());
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('rejects non-object manifests', () => {
  for (const bad of [null, [], 'x', 42]) {
    assert.equal(validateManifest(bad).valid, false);
  }
});

test('rejects wrong schema id', () => {
  const m = { ...valid(), schema: 'microtask/v2' };
  const { valid: ok, errors } = validateManifest(m);
  assert.equal(ok, false);
  assert.match(errors.join(), /schema must be/);
});

test('rejects malformed id', () => {
  for (const id of ['mt-001', 'M-1', 'TOOLONGPREFIX-1', 'MT_001', '']) {
    const { valid: ok } = validateManifest({ ...valid(), id });
    assert.equal(ok, false, `id "${id}" should be rejected`);
  }
});

test('rejects unknown top-level and security properties', () => {
  assert.equal(validateManifest({ ...valid(), surprise: 1 }).valid, false);
  const m = valid();
  m.security.exfiltrate = true;
  assert.equal(validateManifest(m).valid, false);
});

test('rejects unknown and duplicate actions', () => {
  assert.equal(validateManifest({ ...valid(), allowed_actions: ['read', 'sudo'] }).valid, false);
  assert.equal(validateManifest({ ...valid(), allowed_actions: ['read', 'read'] }).valid, false);
  assert.equal(validateManifest({ ...valid(), allowed_actions: [] }).valid, false);
});

test('rejects out-of-range timeout', () => {
  for (const t of [0, -5, 86401, 1.5, '600']) {
    assert.equal(validateManifest({ ...valid(), timeout_seconds: t }).valid, false);
  }
});

test('security: unrestricted network is not expressible', () => {
  const m = valid();
  m.security.network = 'allow';
  const { valid: ok, errors } = validateManifest(m);
  assert.equal(ok, false);
  assert.match(errors.join(), /network must be one of deny, allowlist/);
});

test('security: allowlist requires network_allowlist, deny forbids it', () => {
  const m1 = valid();
  m1.security.network = 'allowlist';
  assert.equal(validateManifest(m1).valid, false);

  m1.security.network_allowlist = ['api.anthropic.com'];
  assert.equal(validateManifest(m1).valid, true);

  const m2 = valid();
  m2.security.network_allowlist = ['example.com'];
  assert.equal(validateManifest(m2).valid, false);
});

test('cross-field: mcp_calls forbidden when network is deny', () => {
  const m = valid();
  m.allowed_actions.push('mcp_call');
  m.mcp_calls = [{ server: 'github', tool: 'create_pr' }];
  const { valid: ok, errors } = validateManifest(m);
  assert.equal(ok, false);
  assert.match(errors.join(), /mcp_calls must be empty/);
});

test('cross-field: approval_policy auto requires deny + no side effects', () => {
  const m = valid();
  m.approval_policy = 'auto';
  assert.equal(validateManifest(m).valid, true, 'deny + read/write/run_tests is auto-eligible');

  const withGit = valid();
  withGit.approval_policy = 'auto';
  withGit.allowed_actions = ['read', 'git'];
  assert.equal(validateManifest(withGit).valid, false);
});

test('parseManifest reports invalid JSON', () => {
  const { valid: ok, errors } = parseManifest('{ nope');
  assert.equal(ok, false);
  assert.match(errors[0], /invalid JSON/);
});
