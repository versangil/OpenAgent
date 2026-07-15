import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { indexWorkspace, searchIndex } from '../src/indexer.js';

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'openagent-idx-'));
  writeFileSync(join(root, 'alpha.js'), 'export function calculateTotal(items) { return items.length; }\n');
  writeFileSync(join(root, 'beta.py'), 'def calculate_total(items):\n    return len(items)\n');
  writeFileSync(join(root, 'notes.md'), '# calculateTotal notes\n');
  mkdirSync(join(root, 'node_modules', 'junk'), { recursive: true });
  writeFileSync(join(root, 'node_modules', 'junk', 'skipme.js'), 'const skipMeToken = 1;\n');
  mkdirSync(join(root, '.git'));
  writeFileSync(join(root, '.git', 'config'), '[core]\n');
  writeFileSync(join(root, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return root;
}

test('indexes files with metadata and hashes', () => {
  const root = makeFixture();
  try {
    const snap = indexWorkspace(root);
    assert.equal(snap.schema, 'openagent-index/v1');

    const paths = snap.files.map((f) => f.path);
    assert.deepEqual(paths, ['alpha.js', 'beta.py', 'notes.md']);

    const alpha = snap.files.find((f) => f.path === 'alpha.js');
    assert.equal(alpha.language, 'javascript');
    assert.equal(alpha.lines, 2);
    assert.match(alpha.sha256, /^[0-9a-f]{64}$/);
    assert.equal(alpha.indexed, true);

    assert.equal(snap.stats.file_count, 3);
    assert.equal(snap.stats.skipped_binary, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('skips node_modules and dot-directories', () => {
  const root = makeFixture();
  try {
    const snap = indexWorkspace(root);
    assert.equal(snap.files.some((f) => f.path.includes('node_modules')), false);
    assert.equal(snap.files.some((f) => f.path.includes('.git')), false);
    assert.equal('skipmetoken' in snap.token_index, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('token index maps identifiers to files; search ranks by matches', () => {
  const root = makeFixture();
  try {
    const snap = indexWorkspace(root);
    assert.deepEqual(snap.token_index['calculatetotal'], ['alpha.js', 'notes.md']);

    const hits = searchIndex(snap, 'calculateTotal items');
    assert.equal(hits[0], 'alpha.js', 'file matching both tokens ranks first');
    assert.ok(hits.includes('notes.md'));

    assert.deepEqual(searchIndex(snap, ''), []);
    assert.deepEqual(searchIndex(snap, 'zzz_not_present'), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects missing or non-directory workspaces', () => {
  assert.throws(() => indexWorkspace(join(tmpdir(), 'openagent-does-not-exist-xyz')), /does not exist/);
  const root = makeFixture();
  try {
    assert.throws(() => indexWorkspace(join(root, 'alpha.js')), /not a directory/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('snapshot is deterministic for identical content (modulo timestamp)', () => {
  const root = makeFixture();
  try {
    const a = indexWorkspace(root);
    const b = indexWorkspace(root);
    assert.deepEqual(a.files, b.files);
    assert.deepEqual(a.token_index, b.token_index);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
