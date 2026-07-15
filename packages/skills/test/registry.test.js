import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { SkillRegistry } from '../src/registry.js';

describe('SkillRegistry', () => {
  let registry;

  before(() => {
    registry = new SkillRegistry({ manifestDirs: [] });
  });

  const validManifest = {
    schema: 'skill/v1',
    id: 'SKILL-TEST-002',
    title: 'Registry Test Skill',
    goal: 'Testing registry functionality',
    inputs: { data: 'string' },
    allowed_actions: ['read'],
    timeout_seconds: 30,
    security: { network: 'deny', filesystem: 'workspace_only' }
  };

  it('should register a skill', () => {
    const handler = async (inputs) => ({ processed: inputs.data });
    registry.register(validManifest, handler);
    const skill = registry.get('SKILL-TEST-002');
    assert.ok(skill);
    assert.equal(skill.manifest.id, 'SKILL-TEST-002');
  });

  it('should reject duplicate registration', () => {
    assert.throws(() => {
      registry.register(validManifest, async () => {});
    }, /already registered/);
  });

  it('should list registered skills', () => {
    const skills = registry.list();
    assert.ok(Array.isArray(skills));
    assert.ok(skills.some(s => s.id === 'SKILL-TEST-002'));
  });

  it('should search skills by keyword', () => {
    const results = registry.search('registry');
    assert.ok(results.length > 0);
    assert.equal(results[0].id, 'SKILL-TEST-002');
  });

  it('should unregister a skill', () => {
    const result = registry.unregister('SKILL-TEST-002');
    assert.ok(result);
    assert.equal(registry.get('SKILL-TEST-002'), undefined);
  });

  it('should support hook registration and emission', async () => {
    const events = [];
    const unsubscribe = registry.on('test:event', async (data) => {
      events.push(data);
    });

    await registry.emit('test:event', { msg: 'hello' });
    assert.equal(events.length, 1);
    assert.equal(events[0].msg, 'hello');

    unsubscribe();
    await registry.emit('test:event', { msg: 'world' });
    assert.equal(events.length, 1); // Still 1 because unsubscribed
  });
});