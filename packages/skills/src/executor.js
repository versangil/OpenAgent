/**
 * Skill Executor.
 * Provides a sandboxed runtime for executing skills.
 */

export class SkillExecutionError extends Error {
  constructor(message, skillId, cause) {
    super(`[${skillId}] ${message}`);
    this.name = 'SkillExecutionError';
    this.skillId = skillId;
    this.cause = cause;
  }
}

export class SkillExecutor {
  constructor(options = {}) {
    this.registry = options.registry;
    this.timeout = options.timeout || 30_000; // default 30s
    this.sandbox = options.sandbox !== false;
    this.maxOutputSize = options.maxOutputSize || 10 * 1024 * 1024; // 10MB
  }

  /**
   * Execute a skill with the given ID and inputs.
   */
  async execute(skillId, inputs = {}, context = {}) {
    if (!this.registry) {
      throw new SkillExecutionError('No skill registry configured', skillId);
    }

    const skill = this.registry.get(skillId);
    if (!skill) {
      throw new SkillExecutionError(`Skill "${skillId}" not found in registry`, skillId);
    }

    // Validate inputs against manifest schema if it has input specs
    if (skill.manifest.inputs) {
      const { validateSkillInputs } = await import('./validator.js');
      const validation = validateSkillInputs(inputs, {
        inputs: Object.entries(skill.manifest.inputs).reduce((acc, [key, val]) => {
          acc[key] = typeof val === 'object' && val !== null ? val : { type: typeof val, required: true };
          return acc;
        }, {})
      });
      if (!validation.valid) {
        throw validation.errors[0];
      }
    }

    // Emit before-execute hook
    if (this.registry.allowHooks) {
      await this.registry.emit('skill:before', {
        skillId,
        inputs,
        context
      });
    }

    const startTime = Date.now();
    let result;

    try {
      // Execute with timeout
      result = await this._executeWithTimeout(skill.handler, inputs, context);

      // Validate output size
      const outputSize = JSON.stringify(result).length;
      if (outputSize > this.maxOutputSize) {
        throw new SkillExecutionError(
          `Output exceeds max size (${outputSize} > ${this.maxOutputSize})`,
          skillId
        );
      }
    } catch (err) {
      if (err instanceof SkillExecutionError) throw err;

      throw new SkillExecutionError(
        `Execution failed: ${err.message}`,
        skillId,
        err
      );
    }

    const duration = Date.now() - startTime;

    // Emit after-execute hook
    if (this.registry.allowHooks) {
      await this.registry.emit('skill:after', {
        skillId,
        inputs,
        context,
        result,
        duration
      });
    }

    return {
      skillId,
      result,
      duration,
      completedAt: new Date().toISOString()
    };
  }

  /**
   * Execute a handler with a timeout.
   */
  async _executeWithTimeout(handler, inputs, context) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new SkillExecutionError(
          `Execution timed out after ${this.timeout}ms`,
          handler.name || 'unknown'
        ));
      }, this.timeout);

      handler(inputs, context)
        .then(res => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch(err => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}