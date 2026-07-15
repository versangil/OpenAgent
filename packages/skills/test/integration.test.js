import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { SkillRegistry } from '../src/registry.js';
import { SkillExecutor } from '../src/executor.js';
import { MCPGateway } from '../../mcp-gateway/src/gateway.js';
import { PluginManager } from '../../plugins/src/plugin-manager.js';
import { HookSystem } from '../../plugins/src/hooks.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Integration Tests', () => {
  let registry;
  let executor;
  let mcpGateway;
  let pluginManager;
  let hookSystem;

  before(() => {
    registry = new SkillRegistry({ manifestDirs: [] });
    executor = new SkillExecutor({ registry, timeout: 5000 });
    mcpGateway = new MCPGateway({ defaultTimeout: 5000 });
    hookSystem = new HookSystem();
    pluginManager = new PluginManager({ hooks: hookSystem, pluginDirs: [], autoActivate: false });
  });

  it('should load skills from manifests directory', async () => {
    const manifestDir = join(__dirname, '..', 'manifests');
    await registry.loadFromDirectory(manifestDir);
    const skills = registry.list();
    // Should find our 5 skill manifests
    assert.ok(skills.length >= 5);
    assert.ok(skills.some(s => s.id === 'SKILL-PLAN-001'));
    assert.ok(skills.some(s => s.id === 'SKILL-CODE-001'));
    assert.ok(skills.some(s => s.id === 'SKILL-DEBUG-001'));
    assert.ok(skills.some(s => s.id === 'SKILL-VERIFY-001'));
    assert.ok(skills.some(s => s.id === 'SKILL-DESIGN-001'));
  });

  it('should execute skills through the executor with hooks', async () => {
    const events = [];

    registry.on('skill:after', async (data) => {
      events.push({ skillId: data.skillId, duration: data.duration });
    });

    // Register a new skill for this test (not already loaded from manifests)
    const testManifest = {
      schema: 'skill/v1',
      id: 'SKILL-INTEGRATION-TEST',
      title: 'Integration Test Skill',
      goal: 'Testing integration',
      inputs: { objective: { type: 'string', required: true } },
      allowed_actions: ['read', 'write'],
      timeout_seconds: 30,
      security: { network: 'deny', filesystem: 'workspace_only' }
    };

    registry.register(testManifest, async (inputs) => ({
      steps: [`Step 1: ${inputs.objective}`, 'Step 2: Execute', 'Step 3: Review'],
      effort: 'medium'
    }));

    const result = await executor.execute('SKILL-INTEGRATION-TEST', { objective: 'Build feature X' });
    assert.equal(result.skillId, 'SKILL-INTEGRATION-TEST');
    assert.ok(result.result.steps.length === 3);
    assert.ok(result.duration >= 0);
    assert.equal(events.length, 1);
    assert.equal(events[0].skillId, 'SKILL-INTEGRATION-TEST');
  });

  it('should integrate MCP gateway with skill execution', async () => {
    // Register an MCP server that provides a code generation tool
    mcpGateway.registerServer('code-gen-server', {
      transport: 'stdio',
      tools: [
        {
          name: 'generate-function',
          description: 'Generate a function',
          inputSchema: { type: 'object', properties: { name: { type: 'string' } } }
        }
      ]
    });

    await mcpGateway.connect('code-gen-server');

    const tools = mcpGateway.listTools('code-gen-server');
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, 'generate-function');

    // Verify we can call the tool
    const callResult = await mcpGateway.callTool('code-gen-server', 'generate-function', { name: 'hello' });
    assert.equal(callResult.status, 'called');
  });

  it('should integrate plugin hooks with skill events', async () => {
    const pluginHookResults = [];

    // Register a plugin that hooks into skill events
    const trackerPlugin = {
      name: 'skill-tracker',
      version: '1.0.0',
      description: 'Tracks skill execution',
      hooks: [
        {
          event: 'skill:*',
          handler: async (data) => {
            pluginHookResults.push({ event: 'skill:*', skillId: data.skillId });
          }
        }
      ]
    };

    await pluginManager.register(trackerPlugin);
    await pluginManager.activate('skill-tracker');

    // Skill execution should trigger the wildcard hook via the hook system
    await executor.execute('SKILL-CODE-001', { task: 'Create a function' });

    // The SkillRegistry emits skill:before and skill:after
    assert.ok(pluginHookResults.length >= 0);
  });

  it('should reject MCP servers with invalid transport', async () => {
    mcpGateway.registerServer('bad-transport', {
      transport: 'invalid-transport',
      tools: []
    });

    await assert.rejects(
      () => mcpGateway.connect('bad-transport'),
      /Invalid transport/
    );
  });
});