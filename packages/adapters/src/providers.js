/**
 * Provider adapter stubs (MT-006).
 *
 * Each declares its credential env var and fails closed when unconfigured.
 * Real HTTP clients land in the MT-006 follow-up; the contract and selection
 * logic are final so the planner is already provider-agnostic.
 */
import { KeyedAdapter } from './adapter.js';

export class OpenAIAdapter extends KeyedAdapter {
  constructor() { super('OPENAI_API_KEY'); }
  get name() { return 'openai'; }
}

export class AnthropicAdapter extends KeyedAdapter {
  constructor() { super('ANTHROPIC_API_KEY'); }
  get name() { return 'anthropic'; }
}

export class QwenAdapter extends KeyedAdapter {
  constructor() { super('DASHSCOPE_API_KEY'); }
  get name() { return 'qwen'; }
}

/**
 * Local runtime adapter (Ollama / llama.cpp server). Needs a base URL, not a key.
 */
export class LocalAdapter extends KeyedAdapter {
  constructor() { super('OPENAGENT_LOCAL_URL'); }
  get name() { return 'local'; }
}
