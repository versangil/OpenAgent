/**
 * Plugin Manager.
 * Manages plugin lifecycle: installation, activation, deactivation, and removal.
 */

import { HookSystem } from './hooks.js';
import { readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

export class PluginError extends Error {
  constructor(message, pluginName) {
    super(`[Plugin:${pluginName}] ${message}`);
    this.name = 'PluginError';
    this.pluginName = pluginName;
  }
}

export class PluginManager {
  constructor(options = {}) {
    this.plugins = new Map();
    this.hooks = options.hooks || new HookSystem();
    this.pluginDirs = options.pluginDirs || [];
    this.autoActivate = options.autoActivate !== false;
  }

  /**
   * Register and optionally activate a plugin.
   */
  async register(pluginDef) {
    if (this.plugins.has(pluginDef.name)) {
      throw new PluginError(`Plugin "${pluginDef.name}" already registered`, pluginDef.name);
    }

    const plugin = {
      name: pluginDef.name,
      version: pluginDef.version || '0.1.0',
      description: pluginDef.description || '',
      author: pluginDef.author || 'unknown',
      hooks: pluginDef.hooks || [],
      _module: null,
      status: 'registered',
      registeredAt: new Date().toISOString(),
      metadata: pluginDef.metadata || {}
    };

    this.plugins.set(pluginDef.name, plugin);

    if (this.autoActivate && pluginDef.autoActivate !== false) {
      await this.activate(pluginDef.name);
    }

    return plugin;
  }

  /**
   * Activate a registered plugin.
   */
  async activate(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new PluginError(`Plugin "${name}" not found`, name);
    }

    if (plugin.status === 'active') {
      return plugin;
    }

    try {
      // Load and execute plugin module
      if (plugin._module && typeof plugin._module.activate === 'function') {
        await plugin._module.activate(this.hooks);
      }

      // Register plugin hooks
      for (const hookDef of plugin.hooks) {
        this.hooks.on(hookDef.event, hookDef.handler, { priority: hookDef.priority || 0 });
      }

      plugin.status = 'active';
      plugin.activatedAt = new Date().toISOString();

      // Emit activation event
      await this.hooks.emit('plugin:activated', { name });

      return plugin;
    } catch (err) {
      plugin.status = 'error';
      throw new PluginError(`Failed to activate: ${err.message}`, name);
    }
  }

  /**
   * Deactivate an active plugin.
   */
  async deactivate(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new PluginError(`Plugin "${name}" not found`, name);
    }

    if (plugin.status !== 'active') {
      return plugin;
    }

    // Remove plugin hooks
    for (const hookDef of plugin.hooks) {
      this.hooks.off(hookDef.event, hookDef.handler);
    }

    // Call plugin deactivate
    if (plugin._module && typeof plugin._module.deactivate === 'function') {
      await plugin._module.deactivate();
    }

    plugin.status = 'inactive';
    plugin.deactivatedAt = new Date().toISOString();

    // Emit deactivation event
    await this.hooks.emit('plugin:deactivated', { name });

    return plugin;
  }

  /**
   * Unregister a plugin completely.
   */
  async unregister(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;

    if (plugin.status === 'active') {
      await this.deactivate(name);
    }

    this.plugins.delete(name);
    await this.hooks.emit('plugin:unregistered', { name });

    return true;
  }

  /**
   * Load plugins from a directory.
   */
  async loadFromDirectory(dirPath) {
    try {
      const dirStat = await stat(dirPath);
      if (!dirStat.isDirectory()) return;
    } catch {
      return; // Directory doesn't exist
    }

    const files = await readdir(dirPath, { withFileTypes: true });
    const pluginFiles = files.filter(f => f.isFile() && (extname(f.name) === '.js' || extname(f.name) === '.mjs'));

    for (const file of pluginFiles) {
      try {
        const modulePath = join(dirPath, file.name);
        const module = await import(modulePath);

        if (module.manifest) {
          const pluginDef = {
            name: module.manifest.name || file.name.replace(extname(file.name), ''),
            version: module.manifest.version,
            description: module.manifest.description,
            hooks: module.manifest.hooks || [],
            metadata: module.manifest.metadata,
            _module: module
          };

          await this.register(pluginDef);
        }
      } catch (err) {
        console.error(`Failed to load plugin ${file.name}: ${err.message}`);
      }
    }
  }

  /**
   * Load plugins from all configured directories.
   */
  async loadAll() {
    for (const dir of this.pluginDirs) {
      await this.loadFromDirectory(dir);
    }
  }

  /**
   * Get plugin info.
   */
  get(name) {
    return this.plugins.get(name);
  }

  /**
   * List all plugins with their status.
   */
  list() {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.name,
      version: p.version,
      description: p.description,
      status: p.status,
      registeredAt: p.registeredAt,
      activatedAt: p.activatedAt || null
    }));
  }

  /**
   * Search plugins.
   */
  search(query) {
    const q = query.toLowerCase();
    return this.list().filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }
}