/**
 * Skill manifest validator.
 * Validates skill manifests against the schema specification.
 */

const REQUIRED_FIELDS = ['schema', 'id', 'title', 'goal', 'inputs'];
const VALID_ACTIONS = ['read', 'write', 'run_tests', 'network', 'execute'];

export class SkillValidationError extends Error {
  constructor(message, path) {
    super(`[${path}] ${message}`);
    this.name = 'SkillValidationError';
    this.path = path;
  }
}

export function validateSkillManifest(manifest) {
  const errors = [];

  // Check required top-level fields
  for (const field of REQUIRED_FIELDS) {
    if (manifest[field] === undefined || manifest[field] === null) {
      errors.push(new SkillValidationError(`Missing required field: ${field}`, field));
    }
  }

  // Validate schema
  if (manifest.schema && !manifest.schema.startsWith('skill/v') && manifest.schema !== 'microtask/v1') {
    errors.push(new SkillValidationError(
      `Invalid schema "${manifest.schema}". Must start with "skill/v" or be "microtask/v1"`,
      'schema'
    ));
  }

  // Validate ID format
  if (manifest.id && !/^[A-Z0-9_-]+$/i.test(manifest.id)) {
    errors.push(new SkillValidationError(
      `Invalid ID "${manifest.id}". Must match /^[A-Z0-9_-]+$/i`,
      'id'
    ));
  }

  // Validate allowed_actions
  if (manifest.allowed_actions) {
    if (!Array.isArray(manifest.allowed_actions)) {
      errors.push(new SkillValidationError('allowed_actions must be an array', 'allowed_actions'));
    } else {
      for (const action of manifest.allowed_actions) {
        if (!VALID_ACTIONS.includes(action)) {
          errors.push(new SkillValidationError(
            `Invalid action "${action}". Valid: ${VALID_ACTIONS.join(', ')}`,
            'allowed_actions'
          ));
        }
      }
    }
  }

  // Validate security policy
  if (manifest.security) {
    if (manifest.security.network === 'allow') {
      errors.push(new SkillValidationError(
        'network policy "allow" is forbidden. Use "deny" or "allowlist"',
        'security.network'
      ));
    }
    if (manifest.security.filesystem && !['workspace_only', 'read_only', 'deny'].includes(manifest.security.filesystem)) {
      errors.push(new SkillValidationError(
        `Invalid filesystem policy "${manifest.security.filesystem}". Valid: workspace_only, read_only, deny`,
        'security.filesystem'
      ));
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateSkillInputs(inputs, schema) {
  if (!schema || !schema.inputs) {
    return { valid: true, errors: [] };
  }

  const errors = [];

  for (const [key, rule] of Object.entries(schema.inputs)) {
    if (rule.required && (inputs[key] === undefined || inputs[key] === null)) {
      errors.push(new SkillValidationError(`Missing required input: ${key}`, key));
    }

    if (inputs[key] !== undefined && rule.type) {
      const actualType = typeof inputs[key];
      if (actualType !== rule.type) {
        errors.push(new SkillValidationError(
          `Input "${key}" expected type "${rule.type}", got "${actualType}"`,
          key
        ));
      }
    }

    // Validate enum values
    if (rule.enum && inputs[key] !== undefined) {
      if (!rule.enum.includes(inputs[key])) {
        errors.push(new SkillValidationError(
          `Input "${key}" value "${inputs[key]}" is not in allowed enum: ${rule.enum.join(', ')}`,
          key
        ));
      }
    }
  }

  return { valid: errors.length === 0, errors };
}