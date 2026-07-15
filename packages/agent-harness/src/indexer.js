/**
 * MT-003: Repo indexer.
 *
 * Walks a workspace, producing per-file metadata (path, size, language,
 * line count, SHA-256) and a tokenized inverted index of identifiers for
 * planner context retrieval. Never follows symlinks outside the workspace.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, lstatSync, existsSync, statSync, readlinkSync } from 'node:fs';
import { join, relative, extname, resolve, sep } from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.openagent', '.idea', '.vscode',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz',
  '.tar', '.exe', '.dll', '.so', '.dylib', '.woff', '.woff2', '.ttf', '.mp3', '.mp4',
]);

const LANGUAGES = {
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript', '.jsx': 'javascript',
  '.py': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java',
  '.json': 'json', '.md': 'markdown', '.yml': 'yaml', '.yaml': 'yaml',
  '.html': 'html', '.css': 'css', '.sh': 'shell', '.toml': 'toml',
};

const MAX_FILE_BYTES = 2 * 1024 * 1024; // skip content indexing beyond 2 MB
const TOKEN_PATTERN = /[A-Za-z_][A-Za-z0-9_]{2,63}/g;
const STOP_TOKENS = new Set([
  'the', 'and', 'for', 'this', 'that', 'with', 'from', 'const', 'function',
  'return', 'import', 'export', 'default', 'true', 'false', 'null', 'undefined',
  'var', 'let', 'new', 'typeof', 'instanceof',
]);

/**
 * Index a workspace directory.
 * @param {string} workspace - path to the repository root
 * @param {{ maxFiles?: number }} [options]
 * @returns {{ schema: string, workspace: string, created_at: string,
 *            stats: object, files: object[], token_index: Record<string, string[]> }}
 */
export function indexWorkspace(workspace, options = {}) {
  const root = resolve(workspace);
  if (!existsSync(root)) {
    throw new Error(`workspace does not exist: ${workspace}`);
  }
  if (!statSync(root).isDirectory()) {
    throw new Error(`workspace is not a directory: ${workspace}`);
  }

  const maxFiles = options.maxFiles ?? 20000;
  const files = [];
  const tokenIndex = new Map();
  let skippedBinary = 0;
  let skippedLarge = 0;

  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir: skip, don't fail the whole index
    }
    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      const full = join(dir, entry.name);

      if (entry.isSymbolicLink()) {
        // Security invariant: never follow symlinks that escape the workspace.
        let target;
        try {
          target = resolve(dir, readlinkSync(full));
        } catch {
          continue;
        }
        if (!(target === root || target.startsWith(root + sep))) continue;
        // In-workspace symlinks are skipped too (targets are indexed directly).
        continue;
      }

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;

      const ext = extname(entry.name).toLowerCase();
      const relPath = relative(root, full).split(sep).join('/');
      const size = lstatSync(full).size;

      if (BINARY_EXTENSIONS.has(ext)) {
        skippedBinary++;
        continue;
      }
      if (size > MAX_FILE_BYTES) {
        skippedLarge++;
        files.push({ path: relPath, size, language: LANGUAGES[ext] ?? 'unknown', lines: null, sha256: null, indexed: false });
        continue;
      }

      let content;
      try {
        content = readFileSync(full);
      } catch {
        continue;
      }

      const sha256 = createHash('sha256').update(content).digest('hex');
      const text = content.toString('utf8');
      const lines = text.length === 0 ? 0 : text.split('\n').length;

      files.push({
        path: relPath,
        size,
        language: LANGUAGES[ext] ?? 'unknown',
        lines,
        sha256,
        indexed: true,
      });

      for (const match of text.matchAll(TOKEN_PATTERN)) {
        const token = match[0].toLowerCase();
        if (STOP_TOKENS.has(token)) continue;
        if (!tokenIndex.has(token)) tokenIndex.set(token, new Set());
        tokenIndex.get(token).add(relPath);
      }
    }
  };

  walk(root);
  files.sort((a, b) => a.path.localeCompare(b.path));

  const token_index = {};
  for (const [token, paths] of [...tokenIndex.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    token_index[token] = [...paths].sort();
  }

  return {
    schema: 'openagent-index/v1',
    workspace: root,
    created_at: new Date().toISOString(),
    stats: {
      file_count: files.length,
      indexed_count: files.filter((f) => f.indexed).length,
      token_count: Object.keys(token_index).length,
      skipped_binary: skippedBinary,
      skipped_large: skippedLarge,
    },
    files,
    token_index,
  };
}

/**
 * Search the token index for files matching all query tokens.
 * @param {{ token_index: Record<string, string[]> }} snapshot
 * @param {string} query - whitespace-separated identifiers
 * @returns {string[]} matching file paths, ranked by match count
 */
export function searchIndex(snapshot, query) {
  const tokens = (query.toLowerCase().match(TOKEN_PATTERN) ?? []).filter((t) => !STOP_TOKENS.has(t));
  if (tokens.length === 0) return [];
  const scores = new Map();
  for (const token of tokens) {
    for (const path of snapshot.token_index[token] ?? []) {
      scores.set(path, (scores.get(path) ?? 0) + 1);
    }
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([path]) => path);
}
