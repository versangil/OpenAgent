/**
 * MT-006: Provider adapter contract.
 *
 * Every provider implements this interface. The planner and harness depend
 * only on this contract — never on a concrete provider — so models swap
 * without planner changes (masterplan MVP acceptance criterion).
 *
 * Security invariants:
 *  - Credentials come from the environment at construction time.
 *  - Adapters never log, persist, or echo credentials.
 *  - Adapters fail closed (health() → ok: false) when unconfigured.
 */

/**
 * @typedef {object} CompletionRequest
 * @property {string} system  - system instruction
 * @property {string} prompt  - user prompt
 * @property {object} [context] - structured context (index excerpts, stats)
 *
 * @typedef {object} CompletionResponse
 * @property {string} text   - model output
 * @property {string} model  - concrete model id used
 * @property {{ input_tokens: number|null, output_tokens: number|null }} usage
 */

export class Adapter {
  /** @returns {string} stable provider id, e.g. "mock", "openai" */
  get name() {
    throw new Error('Adapter subclass must implement get name()');
  }

  /**
   * @param {CompletionRequest} _request
   * @returns {Promise<CompletionResponse>}
   */
  async complete(_request) {
    throw new Error('Adapter subclass must implement complete()');
  }

  /** @returns {Promise<{ ok: boolean, detail: string }>} */
  async health() {
    throw new Error('Adapter subclass must implement health()');
  }
}

/**
 * Base for HTTP-backed providers that require an API key.
 * Fails closed when the key env var is unset.
 */
export class KeyedAdapter extends Adapter {
  #configured;

  /**
   * @param {string} envVar - name of the env var holding the credential
   */
  constructor(envVar) {
    super();
    this.envVar = envVar;
    // Store only whether a key exists — never the key itself.
    this.#configured = typeof process.env[envVar] === 'string' && process.env[envVar].length > 0;
  }

  get configured() {
    return this.#configured;
  }

  async health() {
    return this.#configured
      ? { ok: true, detail: `${this.name}: credential present (${this.envVar})` }
      : { ok: false, detail: `${this.name}: set ${this.envVar} to enable this adapter` };
  }

  async complete() {
    if (!this.#configured) {
      throw new Error(`${this.name} adapter is not configured: set ${this.envVar}`);
    }
    throw new Error(
      `${this.name} adapter HTTP client lands in MT-006 follow-up; use OPENAGENT_ADAPTER=mock for now`,
    );
  }
}
