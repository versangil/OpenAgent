/**
 * Hook System.
 * Event-driven architecture for IDE lifecycle events.
 */

export class HookSystem {
  constructor() {
    this._hooks = new Map();
    this._history = [];
    this.maxHistory = 1000;
  }

  /**
   * Register a hook for an event.
   * @param {string} event - Event name (supports wildcards: 'file:*', 'agent:*')
   * @param {Function} handler - Async handler function
   * @param {Object} options
   * @param {number} options.priority - Priority (higher = executed first, default 0)
   * @returns {Function} Unsubscribe function
   */
  on(event, handler, options = {}) {
    if (!this._hooks.has(event)) {
      this._hooks.set(event, []);
    }

    const hook = {
      handler,
      priority: options.priority || 0,
      id: `hook_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString()
    };

    this._hooks.get(event).push(hook);
    // Sort by priority descending
    this._hooks.get(event).sort((a, b) => b.priority - a.priority);

    return () => this.off(event, hook.id);
  }

  /**
   * Register a one-time hook.
   */
  once(event, handler, options = {}) {
    const wrapped = async (data) => {
      await handler(data);
      this.off(event, wrapped);
    };
    return this.on(event, wrapped, { ...options, id: options.id });
  }

  /**
   * Remove a hook by event and handler or ID.
   */
  off(event, handlerOrId) {
    const hooks = this._hooks.get(event);
    if (!hooks) return false;

    const initialLength = hooks.length;

    if (typeof handlerOrId === 'string') {
      // Remove by ID
      this._hooks.set(event, hooks.filter(h => h.id !== handlerOrId));
    } else {
      // Remove by handler reference
      this._hooks.set(event, hooks.filter(h => h.handler !== handlerOrId));
    }

    return hooks.length !== initialLength;
  }

  /**
   * Emit an event to all registered hooks.
   * @param {string} event - Event name
   * @param {*} data - Event data payload
   * @returns {Promise<Array>} Results from all handlers
   */
  async emit(event, data = {}) {
    const results = [];

    // Collect hooks for this exact event
    const exactHooks = this._hooks.get(event) || [];

    // Collect wildcard hooks
    const wildcardHooks = [];
    for (const [key, hooks] of this._hooks) {
      if (key.includes('*')) {
        const pattern = key.replace(/\*/g, '.*');
        if (new RegExp(`^${pattern}$`).test(event)) {
          wildcardHooks.push(...hooks);
        }
      }
    }

    // Merge and sort by priority
    const allHooks = [...exactHooks, ...wildcardHooks].sort((a, b) => b.priority - a.priority);

    // Track in history
    this._history.push({
      event,
      data,
      timestamp: new Date().toISOString(),
      hookCount: allHooks.length
    });

    // Trim history
    if (this._history.length > this.maxHistory) {
      this._history = this._history.slice(-this.maxHistory);
    }

    // Execute hooks
    for (const hook of allHooks) {
      try {
        const result = await hook.handler(data);
        results.push({ hookId: hook.id, status: 'success', result });
      } catch (err) {
        results.push({ hookId: hook.id, status: 'error', error: err.message });
      }
    }

    return results;
  }

  /**
   * Get event history.
   */
  getHistory(event) {
    if (event) {
      return this._history.filter(h => h.event === event);
    }
    return this._history;
  }

  /**
   * List all registered events and hook counts.
   */
  listEvents() {
    const events = [];
    for (const [event, hooks] of this._hooks) {
      events.push({
        event,
        hookCount: hooks.length,
        createdAgo: hooks[0]?.createdAt
      });
    }
    return events;
  }

  /**
   * Remove all hooks.
   */
  clear() {
    this._hooks.clear();
    this._history = [];
  }
}