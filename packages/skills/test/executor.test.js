import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { SkillRegistry } from '../src/registry.js';
import { SkillExecutor, SkillExecutionError } from '../src/executor.js';
import { SkillValidationError } from '../src/validator.js';

describe('SkillExecutor', () => {
  let registry;
  let executor;

  before(() => {
    registry = new SkillRegistry({ manifestDirs: [] });
    executor = new SkillExecutor({ registry, timeout: 1000, maxOutputSize: 1024 });
  });

  const validManifest = {
    schema: 'skill/v1',
    id: 'SKILL-EXEC-TEST',
    title: 'Executor Test Skill',
    goal: 'Testing executor functionality',
    inputs: { data: { type: 'string', required: true } },
    allowed_actions: ['read', 'write'],
    timeout_seconds: 30,
    security: { network: 'deny', filesystem: 'workspace_only' }
  };

  it('should execute a registered skill successfully', async () => {
    registry.register(validManifest, async (inputs) => ({
      result: `processed: ${inputs.data}`
    }));

    const output = await executor.execute('SKILL-EXEC-TEST', { data: 'hello' });
    assert.equal(output.skillId, 'SKILL-EXEC-TEST');
    assert.equal(output.result.result, 'processed: hello');
    assert.ok(output.duration >= 0);
    assert.ok(output.completedAt);
  });

  it('should reject unknown skill ID', async () => {
    await assert.rejects(
      () => executor.execute('SKILL-UNKNOWN', {}),
      SkillExecutionError
    );
  });

  it('should reject missing required inputs', async () => {
    await assert.rejects(
      () => executor.execute('SKILL-EXEC-TEST', {}),
      SkillValidationError
    );
  });

  it('should reject execution with no registry configured', async () => {
    const badExecutor = new SkillExecutor({});
    await assert.rejects(
      () => badExecutor.execute('any', {}),
      SkillExecutionError
    );
  });

  it('should timeout long-running skills', async () => {
    const timeoutExecutor = new SkillExecutor({ registry, timeout: 50 });
    timeoutExecutor.registry.register({
      schema: 'skill/v1',
      id: 'SKILL-SLOW',
      title: 'Slow Skill',
      goal: 'Testing timeout',
      inputs: {},
      allowed_actions: ['read'],
      timeout_seconds: 1,
      security: { network: 'deny', filesystem: 'workspace_only' }
    }, async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { done: true };
    });

    await assert.rejects(
      () => timeoutExecutor.execute('SKILL-SLOW', {}),
      SkillExecutionError
    );
  });

  it('should enforce maximum output size', async () => {
    const smallOutputExecutor = new SkillExecutor({ registry, maxOutputSize: 10 });
    smallOutputExecutor.registry.register({
      schema: 'skill/v1',
      id: 'SKILL-BIG-OUTPUT',
      title: 'Big Output',
      goal: 'Testing output size limit',
      inputs: {},
      allowed_actions: ['read'],
      timeout_seconds: 1,
      security: { network: 'deny', filesystem: 'workspace_only' }
    }, async () => {
      return { large: 'x'.repeat(100) };
    });

    await assert.rejects(
      () => smallOutputExecutor.execute('SKILL-BIG-OUTPUT', {}),
      SkillExecutionError
    );
  });

  it('should emit lifecycle hooks', async () => {
    const hookEvents = [];
    registry.on('skill:before', async (data) => {
      hookEvents.push({ type: 'before', skillId: data.skillId });
    });
    registry.on('skill:after', async (data) => {
      hookEvents.push({ type: 'after', skillId: data.skillId, duration: data.duration });
    });

    await executor.execute('SKILL-EXEC-TEST', { data: 'hooks' });

    assert.equal(hookEvents.length, 2);
    assert.equal(hookEvents[0].type, 'before');
    assert.equal(hookEvents[1].type, 'after');
    assert.ok(hookEvents[1].duration >= 0);
  });
});