#!/usr/bin/env node
/**
 * openagent-cli (MT-002, partial)
 *
 * Commands:
 *   validate <manifest.json>                      validate a microtask manifest
 *   index <workspace> [--out file]                snapshot a repo index
 *   run --manifest <m> --workspace <w> --dry-run  plan a microtask, emit plan.json + pr_metadata.json
 *   adapters                                      list adapters and health
 *
 * Sandboxed execution and staged diff application land in MT-004/MT-005;
 * until then `run` requires --dry-run and performs no writes to the workspace
 * beyond its own artifact files.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { parseManifest } from '../../agent-harness/src/manifest.js';
import { indexWorkspace } from '../../agent-harness/src/indexer.js';
import { planMicrotask, orchestrateMicrotask } from '../../agent-harness/src/index.js';
import { createAdapter, ADAPTER_NAMES } from '../../adapters/src/index.js';

const USAGE = `openagent-cli — OpenAgent agent harness CLI

Usage:
  openagent-cli validate <manifest.json>
  openagent-cli index <workspace> [--out <file>]
  openagent-cli run --manifest <file> --workspace <dir> --dry-run [--adapter <name>] [--out-dir <dir>]
  openagent-cli adapters

Adapters: ${ADAPTER_NAMES.join(', ')} (default: $OPENAGENT_ADAPTER or "mock")
`;

/** Parse ["--key", "value", "--flag"] into { key: "value", flag: true } plus positionals. */
export function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { flags, positionals };
}

export async function main(argv = process.argv.slice(2), io = console) {
  const [command, ...rest] = argv;
  const { flags, positionals } = parseArgs(rest);

  try {
    switch (command) {
      case 'validate': {
        const file = positionals[0];
        if (!file) throw new UsageError('validate requires a manifest path');
        const { valid, errors, manifest } = parseManifest(readFileSync(file, 'utf8'));
        if (!valid) {
          io.error(`INVALID: ${file}`);
          for (const e of errors) io.error(`  - ${e}`);
          return 1;
        }
        io.log(`VALID: ${manifest.id} — ${manifest.title}`);
        return 0;
      }

      case 'index': {
        const workspace = positionals[0];
        if (!workspace) throw new UsageError('index requires a workspace path');
        const snapshot = indexWorkspace(workspace);
        const out = typeof flags.out === 'string' ? flags.out : 'index_snapshot.json';
        writeFileSync(out, JSON.stringify(snapshot, null, 2));
        const s = snapshot.stats;
        io.log(`indexed ${s.indexed_count}/${s.file_count} files, ${s.token_count} tokens → ${out}`);
        return 0;
      }

      case 'run': {
        if (typeof flags.manifest !== 'string') throw new UsageError('run requires --manifest <file>');
        if (typeof flags.workspace !== 'string') throw new UsageError('run requires --workspace <dir>');
        if (flags['dry-run'] !== true) {
          throw new UsageError('sandboxed execution lands in MT-005; run currently requires --dry-run');
        }

        const parsed = parseManifest(readFileSync(flags.manifest, 'utf8'));
        if (!parsed.valid) {
          io.error(`INVALID manifest: ${flags.manifest}`);
          for (const e of parsed.errors) io.error(`  - ${e}`);
          return 1;
        }

        const adapter = createAdapter(typeof flags.adapter === 'string' ? flags.adapter : undefined);
        const health = await adapter.health();
        if (!health.ok) {
          io.error(`adapter unavailable — ${health.detail}`);
          return 1;
        }

        const snapshot = indexWorkspace(flags.workspace);
        // Use enhanced orchestrator for complex tasks, fallback to basic planner
        const useOrchestrator = parsed.manifest.allowed_actions.includes('delegate') || 
                              parsed.manifest.goal.toLowerCase().includes('complex') ||
                              parsed.manifest.goal.toLowerCase().includes('multi');
        const { plan, prMetadata } = useOrchestrator 
          ? await orchestrateMicrotask(parsed.manifest, snapshot, adapter)
          : await planMicrotask(parsed.manifest, snapshot, adapter);

        const outDir = typeof flags['out-dir'] === 'string' ? flags['out-dir'] : '.';
        const planPath = resolve(outDir, 'plan.json');
        const prPath = resolve(outDir, 'pr_metadata.json');
        writeFileSync(planPath, JSON.stringify(plan, null, 2));
        writeFileSync(prPath, JSON.stringify(prMetadata, null, 2));

        io.log(`planned ${plan.steps.length} step(s) for ${plan.microtask_id} via ${adapter.name}`);
        for (const step of plan.steps) {
          io.log(`  ${step.order}. [${step.action}] ${step.target}${step.requires_approval ? '  (requires approval)' : ''}`);
        }
        io.log(`wrote ${planPath}`);
        io.log(`wrote ${prPath}`);
        return 0;
      }

      case 'adapters': {
        for (const name of ADAPTER_NAMES) {
          const health = await createAdapter(name).health();
          io.log(`${health.ok ? 'ready  ' : 'blocked'}  ${name.padEnd(10)} ${health.detail}`);
        }
        return 0;
      }

      case undefined:
      case 'help':
      case '--help': {
        io.log(USAGE);
        return 0;
      }

      default:
        throw new UsageError(`unknown command "${command}"`);
    }
  } catch (err) {
    if (err instanceof UsageError) {
      io.error(`error: ${err.message}\n`);
      io.error(USAGE);
    } else {
      io.error(`error: ${err.message}`);
    }
    return 1;
  }
}

class UsageError extends Error {}

// Only execute when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
    process.argv[1]?.endsWith('cli.js')) {
  process.exitCode = await main();
}
