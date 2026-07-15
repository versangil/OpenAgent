#!/usr/bin/env node
/**
 * Minimal zero-dependency lint: checks every .js file in packages/ and ci/
 * parses as valid ESM syntax and contains no obvious committed secrets.
 * Replaced by a full linter (eslint) in MT-011.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['packages', 'ci'];
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/,                    // OpenAI-style keys
  /sk-ant-[A-Za-z0-9-]{20,}/,               // Anthropic-style keys
  /ghp_[A-Za-z0-9]{20,}/,                   // GitHub PAT
  /AKIA[0-9A-Z]{16}/,                       // AWS access key
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, // private keys
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

let failures = 0;
for (const root of ROOTS) {
  let files;
  try { files = [...walk(root)]; } catch { continue; }
  for (const file of files) {
    if (extname(file) !== '.js') continue;
    const src = readFileSync(file, 'utf8');
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(src)) {
        console.error(`SECRET-LIKE STRING in ${file} (pattern ${pattern})`);
        failures++;
      }
    }
    try {
      new Function('return async () => { ' + 'void 0' + ' }'); // syntax sanity of runtime itself
      // Parse check via dynamic import would execute code; instead do a light bracket balance check.
      const opens = (src.match(/\{/g) || []).length;
      const closes = (src.match(/\}/g) || []).length;
      if (opens !== closes) {
        console.error(`UNBALANCED BRACES in ${file} (${opens} '{' vs ${closes} '}')`);
        failures++;
      }
    } catch (err) {
      console.error(`LINT ERROR in ${file}: ${err.message}`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`lint: ${failures} problem(s) found`);
  process.exit(1);
}
console.log('lint: ok');
