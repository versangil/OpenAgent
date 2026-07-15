/**
 * Skill Registry.
 * Manages discovery, registration, and lookup of skills.
 */

import { validateSkillManifest, SkillValidationError } from './validator.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

export class SkillRegistry {
  constructor(options = {}) {
    this.skills = new Map();
    this.manifestDirs = options.manifestDirs || [];
    this.allowHooks = options.allowHooks !== false;
    this._hooks = new Map();
  }

  /**
   * Register a skill from a manifest object and handler function.
   */
  register(manifest, handler) {
    const validation = validateSkillManifest(manifest);
    if (!validation.valid) {
      throw validation.errors[0];
    }

    if (this.skills.has(manifest.id)) {
      throw new SkillValidationError(`Skill "${manifest.id}" already registered`, manifest.id);
    }

    this.skills.set(manifest.id, {
      manifest,
      handler,
      registeredAt: new Date().toISOString()
    });
  }

  /**
   * Unregister a skill by ID.
   */
  unregister(id) {
    return this.skills.delete(id);
  }

  /**
   * Get a registered skill by ID.
   */
  get(id) {
    return this.skills.get(id);
  }

  /**
   * List all registered skills.
   */
  list() {
    return Array.from(this.skills.values()).map(s => ({
      id: s.manifest.id,
      title: s.manifest.title,
      description: s.manifest.description || s.manifest.goal
    }));
  }

  /**
   * Search skills by keyword in title, ID, description, or goal.
   */
  search(query) {
    const q = query.toLowerCase();
    return this.list().filter(s =>
      s.id.toLowerCase().includes(q) ||
      s.title.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q))
    );
  }

  /**
   * Load skills from manifest files in a directory.
   */
  async loadFromDirectory(dirPath) {
    const files = await readdir(dirPath, { withFileTypes: true });
    const jsonFiles = files.filter(f => f.isFile() && extname(f.name) === '.json');

    for (const file of jsonFiles) {
      const filePath = join(dirPath, file.name);
      const content = await readFile(filePath, 'utf-8');
      const manifest = JSON.parse(content);
      // Register with a default passthrough handler
      this.register(manifest, async (inputs) => ({ result: inputs }));
    }
  }

  /**
   * Load all skills from all configured manifest directories.
   */
  async loadAll() {
    for (const dir of this.manifestDirs) {
      try {
        const dirStat = await stat(dir);
        if (dirStat.isDirectory()) {
          await this.loadFromDirectory(dir);
        }
      } catch {
        // Directory doesn't exist or can't be read, skip silently
      }
    }
  }

  // --- Hook system ---

  /**
   * Register a hook for a lifecycle event.
   */
  on(event, handler) {
    if (!this._hooks.has(event)) {
      this._hooks.set(event, []);
    }
    this._hooks.get(event).push(handler);
    return () => this.off(event, handler);
  }

  /**
   * Remove a hook handler.
   */
  off(event, handler) {
    const handlers = this._hooks.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
  }

  /**
   * Emit a lifecycle event to all registered hooks.
   */
  async emit(event, data) {
    if (!this.allowHooks) return [];
    const handlers = this._hooks.get(event);
    if (!handlers) return [];

    const results = [];
    for (const handler of handlers) {
      try {
        results.push(await handler(data));
      } catch (err) {
        results.push({ error: err.message });
      }
    }
    return results;
  }
}