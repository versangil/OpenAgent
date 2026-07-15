/**
 * MCP Gateway.
 * Manages connections to external MCP servers, tool discovery, and session management.
 */

export class MCPConnectionError extends Error {
  constructor(message, serverName) {
    super(`[MCP:${serverName}] ${message}`);
    this.name = 'MCPConnectionError';
    this.serverName = serverName;
  }
}

export class MCPGateway {
  constructor(options = {}) {
    this.servers = new Map();
    this.sessions = new Map();
    this.toolRegistry = new Map();
    this.defaultTimeout = options.defaultTimeout || 30_000;
    this.maxSessions = options.maxSessions || 100;
  }

  /**
   * Register an MCP server connection.
   */
  registerServer(name, config) {
    if (this.servers.has(name)) {
      throw new MCPConnectionError(`Server "${name}" already registered`, name);
    }

    const server = {
      name,
      config,
      tools: new Map(),
      status: 'disconnected',
      connectedAt: null,
      errorCount: 0
    };

    this.servers.set(name, server);
    return server;
  }

  /**
   * Unregister an MCP server.
   */
  unregisterServer(name) {
    const server = this.servers.get(name);
    if (server) {
      // Clean up any active sessions for this server
      for (const [sessionId, session] of this.sessions) {
        if (session.serverName === name) {
          this.sessions.delete(sessionId);
        }
      }
    }
    return this.servers.delete(name);
  }

  /**
   * Connect to a registered MCP server.
   */
  async connect(name) {
    const server = this.servers.get(name);
    if (!server) {
      throw new MCPConnectionError(`Server "${name}" not found`, name);
    }

    if (server.status === 'connected') {
      return server;
    }

    // Validate transport type if specified
    if (server.config.transport) {
      const validTransports = ['stdio', 'tcp', 'http', 'sse'];
      if (!validTransports.includes(server.config.transport)) {
        throw new MCPConnectionError(
          `Invalid transport "${server.config.transport}". Valid: ${validTransports.join(', ')}`,
          name
        );
      }
    }

    try {
      // In a real implementation, this would establish a connection
      // via stdio, TCP, or HTTP transport to the MCP server process
      server.status = 'connected';
      server.connectedAt = new Date().toISOString();
      server.errorCount = 0;

      // Discover tools from the server
      await this._discoverTools(server);

      return server;
    } catch (err) {
      server.status = 'error';
      server.errorCount++;
      throw new MCPConnectionError(
        `Failed to connect: ${err.message}`,
        name
      );
    }
  }

  /**
   * Disconnect from an MCP server.
   */
  async disconnect(name) {
    const server = this.servers.get(name);
    if (!server) return;

    server.status = 'disconnected';
    server.connectedAt = null;

    // Clean up sessions
    for (const [sessionId, session] of this.sessions) {
      if (session.serverName === name) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Discover tools from a connected MCP server.
   */
  async _discoverTools(server) {
    // In a real implementation, this would call the MCP list_tools endpoint
    // For now, we register tools from the server config
    if (server.config.tools) {
      for (const tool of server.config.tools) {
        server.tools.set(tool.name, tool);
        this.toolRegistry.set(`${server.name}:${tool.name}`, {
          serverName: server.name,
          ...tool
        });
      }
    }
  }

  /**
   * List all available tools across all connected servers.
   */
  listTools(serverName) {
    if (serverName) {
      const server = this.servers.get(serverName);
      if (!server) return [];
      return Array.from(server.tools.values());
    }

    return Array.from(this.toolRegistry.values());
  }

  /**
   * Call a tool on an MCP server.
   */
  async callTool(serverName, toolName, args = {}) {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new MCPConnectionError(`Server "${serverName}" not found`, serverName);
    }

    if (server.status !== 'connected') {
      throw new MCPConnectionError(
        `Server "${serverName}" is not connected (status: ${server.status})`,
        serverName
      );
    }

    const tool = server.tools.get(toolName);
    if (!tool) {
      throw new MCPConnectionError(
        `Tool "${toolName}" not found on server "${serverName}"`,
        serverName
      );
    }

    // In a real implementation, this would send a JSON-RPC call
    // to the MCP server via the configured transport
    return {
      serverName,
      toolName,
      args,
      status: 'called',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a new MCP session.
   */
  createSession(serverName, metadata = {}) {
    if (this.sessions.size >= this.maxSessions) {
      throw new MCPConnectionError('Maximum session limit reached', serverName);
    }

    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session = {
      id: sessionId,
      serverName,
      metadata,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      toolCalls: []
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get a session by ID.
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Destroy a session.
   */
  destroySession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get server status.
   */
  getServerStatus(name) {
    const server = this.servers.get(name);
    if (!server) return null;

    return {
      name: server.name,
      status: server.status,
      connectedAt: server.connectedAt,
      toolCount: server.tools.size,
      errorCount: server.errorCount
    };
  }

  /**
   * List all registered servers.
   */
  listServers() {
    return Array.from(this.servers.values()).map(s => ({
      name: s.name,
      status: s.status,
      toolCount: s.tools.size
    }));
  }
}