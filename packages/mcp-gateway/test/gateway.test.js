import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { MCPGateway, MCPConnectionError } from '../src/gateway.js';

describe('MCPGateway', () => {
  let gateway;

  before(() => {
    gateway = new MCPGateway({ defaultTimeout: 5000, maxSessions: 10 });
  });

  it('should register an MCP server', () => {
    const server = gateway.registerServer('test-server', {
      tools: [
        { name: 'echo', description: 'Echo input', inputSchema: { type: 'object' } },
        { name: 'ping', description: 'Health check', inputSchema: {} }
      ]
    });
    assert.ok(server);
    assert.equal(server.name, 'test-server');
    assert.equal(server.status, 'disconnected');
  });

  it('should reject duplicate server registration', () => {
    assert.throws(() => {
      gateway.registerServer('test-server', {});
    }, MCPConnectionError);
  });

  it('should connect to a server and discover tools', async () => {
    const server = await gateway.connect('test-server');
    assert.equal(server.status, 'connected');
    assert.ok(server.connectedAt);
    assert.equal(server.tools.size, 2);
  });

  it('should list tools from a server', () => {
    const tools = gateway.listTools('test-server');
    assert.equal(tools.length, 2);
    assert.ok(tools.some(t => t.name === 'echo'));
  });

  it('should list all tools across servers', () => {
    const allTools = gateway.listTools();
    assert.ok(allTools.length >= 2);
  });

  it('should call a tool', async () => {
    const result = await gateway.callTool('test-server', 'echo', { message: 'hello' });
    assert.equal(result.serverName, 'test-server');
    assert.equal(result.toolName, 'echo');
    assert.equal(result.status, 'called');
  });

  it('should fail calling tool on unknown server', async () => {
    await assert.rejects(
      () => gateway.callTool('unknown-server', 'echo', {}),
      MCPConnectionError
    );
  });

  it('should create and manage sessions', () => {
    const session = gateway.createSession('test-server', { user: 'test' });
    assert.ok(session.id);
    assert.equal(session.serverName, 'test-server');

    const retrieved = gateway.getSession(session.id);
    assert.ok(retrieved);
    assert.equal(retrieved.id, session.id);

    gateway.destroySession(session.id);
    assert.equal(gateway.getSession(session.id), undefined);
  });

  it('should get server status', () => {
    const status = gateway.getServerStatus('test-server');
    assert.ok(status);
    assert.equal(status.name, 'test-server');
    assert.equal(status.status, 'connected');
    assert.equal(status.toolCount, 2);
  });

  it('should list all servers', () => {
    const servers = gateway.listServers();
    assert.ok(servers.length >= 1);
    assert.ok(servers.some(s => s.name === 'test-server'));
  });

  it('should disconnect from a server', async () => {
    await gateway.disconnect('test-server');
    const status = gateway.getServerStatus('test-server');
    assert.equal(status.status, 'disconnected');
  });

  it('should unregister a server', () => {
    const result = gateway.unregisterServer('test-server');
    assert.ok(result);
    assert.equal(gateway.listServers().length, 0);
  });
});