import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { HookSystem } from '../src/hooks.js';

describe('HookSystem', () => {
  let hooks;

  before(() => {
    hooks = new HookSystem();
  });

  it('should register and emit hooks', async () => {
    const results = [];
    hooks.on('file:created', async (data) => {
      results.push(data);
    });

    await hooks.emit('file:created', { path: '/test/file.js' });
    assert.equal(results.length, 1);
    assert.equal(results[0].path, '/test/file.js');
  });

  it('should support wildcard events', async () => {
    const results = [];
    hooks.on('file:*', async (data) => {
      results.push(data);
    });

    await hooks.emit('file:modified', { path: '/test/file2.js' });
    assert.equal(results.length, 1);
    assert.equal(results[0].path, '/test/file2.js');
  });

  it('should support priority ordering', async () => {
    const order = [];
    hooks.on('priority:test', async () => order.push('low'), { priority: 0 });
    hooks.on('priority:test', async () => order.push('high'), { priority: 100 });
    hooks.on('priority:test', async () => order.push('mid'), { priority: 50 });

    await hooks.emit('priority:test');
    assert.equal(order[0], 'high');
    assert.equal(order[1], 'mid');
    assert.equal(order[2], 'low');
  });

  it('should support one-time hooks', async () => {
    let count = 0;
    hooks.once('once:test', async () => { count++; });

    await hooks.emit('once:test');
    await hooks.emit('once:test');
    assert.equal(count, 1);
  });

  it('should handle hook errors gracefully', async () => {
    hooks.on('error:test', async () => { throw new Error('Hook error'); });
    hooks.on('error:test', async () => 'success');

    const results = await hooks.emit('error:test');
    assert.equal(results.length, 2);
    assert.equal(results[0].status, 'error');
    assert.equal(results[1].status, 'success');
  });

  it('should list events', () => {
    const events = hooks.listEvents();
    assert.ok(events.length > 0);
  });

  it('should get event history', () => {
    const history = hooks.getHistory('error:test');
    assert.ok(history.length >= 1);
    assert.equal(history[0].event, 'error:test');
  });

  it('should clear all hooks', () => {
    hooks.clear();
    assert.equal(hooks.listEvents().length, 0);
    assert.equal(hooks.getHistory().length, 0);
  });
});