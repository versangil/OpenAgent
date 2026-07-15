import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { PluginManager, PluginError } from '../src/plugin-manager.js';

describe('PluginManager', () => {
  let manager;

  before(() => {
    manager = new PluginManager({ pluginDirs: [], autoActivate: false });
  });

  const testPlugin = {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'test-author',
    hooks: [
      { event: 'file:created', handler: async () => { return 'handled'; }, priority: 10 }
    ]
  };

  it('should register a plugin', async () => {
    const plugin = await manager.register(testPlugin);
    assert.equal(plugin.name, 'test-plugin');
    assert.equal(plugin.status, 'registered');
  });

  it('should reject duplicate registration', async () => {
    await assert.rejects(
      () => manager.register(testPlugin),
      PluginError
    );
  });

  it('should activate a plugin', async () => {
    const plugin = await manager.activate('test-plugin');
    assert.equal(plugin.status, 'active');
    assert.ok(plugin.activatedAt);
  });

  it('should deactivate a plugin', async () => {
    const plugin = await manager.deactivate('test-plugin');
    assert.equal(plugin.status, 'inactive');
    assert.ok(plugin.deactivatedAt);
  });

  it('should re-activate after deactivation', async () => {
    await manager.activate('test-plugin');
    const plugin = manager.get('test-plugin');
    assert.equal(plugin.status, 'active');
  });

  it('should unregister a plugin', async () => {
    const result = await manager.unregister('test-plugin');
    assert.ok(result);
    assert.equal(manager.get('test-plugin'), undefined);
  });

  it('should list registered plugins', async () => {
    await manager.register({
      name: 'plugin-a',
      description: 'Plugin A',
      hooks: []
    });
    await manager.register({
      name: 'plugin-b',
      description: 'Plugin B',
      hooks: []
    });

    const list = manager.list();
    assert.equal(list.length, 2);
    assert.ok(list.some(p => p.name === 'plugin-a'));
  });

  it('should search plugins by keyword', () => {
    const results = manager.search('plugin');
    assert.equal(results.length, 2);
  });

  it('should handle activation of non-existent plugin', async () => {
    await assert.rejects(
      () => manager.activate('non-existent'),
      PluginError
    );
  });

  it('should handle deactivation of non-existent plugin', async () => {
    await assert.rejects(
      () => manager.deactivate('non-existent'),
      PluginError
    );
  });
});