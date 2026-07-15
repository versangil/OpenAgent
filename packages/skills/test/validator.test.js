import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateSkillManifest, validateSkillInputs, SkillValidationError } from '../src/validator.js';

describe('SkillValidator', () => {
  const validManifest = {
    schema: 'skill/v1',
    id: 'SKILL-TEST-001',
    title: 'Test Skill',
    goal: 'A test skill for validation',
    inputs: { test: { type: 'string', required: true } },
    allowed_actions: ['read', 'write'],
    timeout_seconds: 60,
    security: { network: 'deny', filesystem: 'workspace_only' }
  };

  it('should validate a correct manifest', () => {
    const result = validateSkillManifest(validManifest);
    assert.ok(result.valid);
    assert.equal(result.errors.length, 0);
  });

  it('should reject missing required fields', () => {
    const result = validateSkillManifest({});
    assert.ok(!result.valid);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some(e => e.message.includes('schema')));
  });

  it('should reject invalid schema', () => {
    const result = validateSkillManifest({ ...validManifest, schema: 'invalid' });
    assert.ok(!result.valid);
  });

  it('should reject invalid allowed_actions', () => {
    const result = validateSkillManifest({ ...validManifest, allowed_actions: ['invalid_action'] });
    assert.ok(!result.valid);
  });

  it('should reject network allow policy', () => {
    const result = validateSkillManifest({
      ...validManifest,
      security: { network: 'allow', filesystem: 'workspace_only' }
    });
    assert.ok(!result.valid);
  });

  it('should validate skill inputs against schema', () => {
    const schema = {
      inputs: {
        name: { type: 'string', required: true },
        count: { type: 'number', required: false }
      }
    };

    const valid = validateSkillInputs({ name: 'test', count: 5 }, schema);
    assert.ok(valid.valid);

    const missing = validateSkillInputs({ count: 5 }, schema);
    assert.ok(!missing.valid);
  });
});