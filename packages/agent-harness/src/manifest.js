/**
 * MT-001: Microtask manifest validation (microtask/v1).
 *
 * Zero-dependency validator matching schemas/microtask_schema_v1.json,
 * plus cross-field security invariants that JSON Schema alone can't express.
 */

export const SCHEMA_ID = 'microtask/v1';

export const ALLOWED_ACTIONS = Object.freeze([
  'read', 'write', 'run_tests', 'format', 'git', 'install_deps', 'mcp_call',
]);

export const APPROVAL_POLICIES = Object.freeze([
  'auto', 'require_approval_for_side_effects', 'require_approval_for_all',
]);

export const NETWORK_POLICIES = Object.freeze(['deny', 'allowlist']);
export const FILESYSTEM_POLICIES = Object.freeze(['workspace_only', 'workspace_and_temp']);

const ID_PATTERN = /^[A-Z]{2,8}-[A-Za-z0-9-]{1,64}$/;
const SIDE_EFFECT_ACTIONS = new Set(['git', 'install_deps', 'mcp_call']);
const TOP_LEVEL_KEYS = new Set([
  'schema', 'id', 'title', 'goal', 'inputs', 'allowed_actions',
  'timeout_seconds', 'approval_policy', 'mcp_calls', 'security',
]);
const SECURITY_KEYS = new Set([
  'network', 'network_allowlist', 'filesystem', 'max_memory_mb', 'max_cpu_percent',
]);

/**
 * Validate a parsed manifest object.
 * @param {unknown} manifest
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateManifest(manifest) {
  const errors = [];
  const err = (msg) => errors.push(msg);

  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { valid: false, errors: ['manifest must be a JSON object'] };
  }

  for (const key of Object.keys(manifest)) {
    if (!TOP_LEVEL_KEYS.has(key)) err(`unknown property "${key}"`);
  }

  if (manifest.schema !== SCHEMA_ID) err(`schema must be "${SCHEMA_ID}"`);

  if (typeof manifest.id !== 'string' || !ID_PATTERN.test(manifest.id)) {
    err('id must match ^[A-Z]{2,8}-[A-Za-z0-9-]{1,64}$ (e.g. "MT-001")');
  }

  if (typeof manifest.title !== 'string' || manifest.title.length < 3 || manifest.title.length > 200) {
    err('title must be a string of 3..200 characters');
  }

  if (typeof manifest.goal !== 'string' || manifest.goal.length < 10 || manifest.goal.length > 4000) {
    err('goal must be a string of 10..4000 characters');
  }

  if (manifest.inputs !== undefined &&
      (manifest.inputs === null || typeof manifest.inputs !== 'object' || Array.isArray(manifest.inputs))) {
    err('inputs must be an object when present');
  }

  const actions = manifest.allowed_actions;
  if (!Array.isArray(actions) || actions.length < 1) {
    err('allowed_actions must be a non-empty array');
  } else {
    if (new Set(actions).size !== actions.length) err('allowed_actions must not contain duplicates');
    for (const a of actions) {
      if (!ALLOWED_ACTIONS.includes(a)) err(`allowed_actions contains unknown action "${a}"`);
    }
  }

  if (!Number.isInteger(manifest.timeout_seconds) ||
      manifest.timeout_seconds < 1 || manifest.timeout_seconds > 86400) {
    err('timeout_seconds must be an integer in 1..86400');
  }

  if (!APPROVAL_POLICIES.includes(manifest.approval_policy)) {
    err(`approval_policy must be one of ${APPROVAL_POLICIES.join(', ')}`);
  }

  if (manifest.mcp_calls !== undefined) {
    if (!Array.isArray(manifest.mcp_calls)) {
      err('mcp_calls must be an array when present');
    } else {
      manifest.mcp_calls.forEach((call, i) => {
        if (call === null || typeof call !== 'object' || Array.isArray(call)) {
          err(`mcp_calls[${i}] must be an object`);
          return;
        }
        if (typeof call.server !== 'string' || call.server.length < 1) err(`mcp_calls[${i}].server is required`);
        if (typeof call.tool !== 'string' || call.tool.length < 1) err(`mcp_calls[${i}].tool is required`);
        for (const key of Object.keys(call)) {
          if (!['server', 'tool', 'purpose'].includes(key)) err(`mcp_calls[${i}] has unknown property "${key}"`);
        }
      });
    }
  }

  const sec = manifest.security;
  if (sec === null || typeof sec !== 'object' || Array.isArray(sec)) {
    err('security must be an object');
  } else {
    for (const key of Object.keys(sec)) {
      if (!SECURITY_KEYS.has(key)) err(`security has unknown property "${key}"`);
    }
    if (!NETWORK_POLICIES.includes(sec.network)) {
      err(`security.network must be one of ${NETWORK_POLICIES.join(', ')} (unrestricted network is not expressible)`);
    }
    if (!FILESYSTEM_POLICIES.includes(sec.filesystem)) {
      err(`security.filesystem must be one of ${FILESYSTEM_POLICIES.join(', ')}`);
    }
    if (sec.network === 'allowlist') {
      if (!Array.isArray(sec.network_allowlist) || sec.network_allowlist.length < 1 ||
          !sec.network_allowlist.every((h) => typeof h === 'string' && h.length > 0)) {
        err('security.network_allowlist must be a non-empty array of hostnames when network is "allowlist"');
      }
    } else if (sec.network_allowlist !== undefined) {
      err('security.network_allowlist is only permitted when network is "allowlist"');
    }
    if (sec.max_memory_mb !== undefined &&
        (!Number.isInteger(sec.max_memory_mb) || sec.max_memory_mb < 16 || sec.max_memory_mb > 65536)) {
      err('security.max_memory_mb must be an integer in 16..65536');
    }
    if (sec.max_cpu_percent !== undefined &&
        (!Number.isInteger(sec.max_cpu_percent) || sec.max_cpu_percent < 1 || sec.max_cpu_percent > 100)) {
      err('security.max_cpu_percent must be an integer in 1..100');
    }

    // Cross-field security invariants
    if (Array.isArray(manifest.mcp_calls) && manifest.mcp_calls.length > 0 && sec.network === 'deny') {
      err('mcp_calls must be empty when security.network is "deny"');
    }
    if (manifest.approval_policy === 'auto') {
      const sideEffects = (Array.isArray(actions) ? actions : []).filter((a) => SIDE_EFFECT_ACTIONS.has(a));
      if (sec.network !== 'deny' || sideEffects.length > 0) {
        err(`approval_policy "auto" requires security.network "deny" and no side-effect actions (found: ${sideEffects.join(', ') || 'network=' + sec.network})`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse and validate manifest JSON text.
 * @param {string} text
 * @returns {{ valid: boolean, errors: string[], manifest: object|null }}
 */
export function parseManifest(text) {
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (e) {
    return { valid: false, errors: [`invalid JSON: ${e.message}`], manifest: null };
  }
  const { valid, errors } = validateManifest(manifest);
  return { valid, errors, manifest: valid ? manifest : null };
}
