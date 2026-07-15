/**
 * Adapter registry and factory.
 */
import { Adapter, KeyedAdapter } from './adapter.js';
import { MockAdapter } from './mock.js';
import { OpenAIAdapter, AnthropicAdapter, QwenAdapter, LocalAdapter } from './providers.js';

export { Adapter, KeyedAdapter, MockAdapter, OpenAIAdapter, AnthropicAdapter, QwenAdapter, LocalAdapter };

const REGISTRY = {
  mock: MockAdapter,
  openai: OpenAIAdapter,
  anthropic: AnthropicAdapter,
  qwen: QwenAdapter,
  local: LocalAdapter,
};

export const ADAPTER_NAMES = Object.freeze(Object.keys(REGISTRY));

/**
 * Create an adapter by name. Defaults to OPENAGENT_ADAPTER env var, then "mock".
 * @param {string} [name]
 * @returns {Adapter}
 */
export function createAdapter(name = process.env.OPENAGENT_ADAPTER ?? 'mock') {
  const Ctor = REGISTRY[name];
  if (!Ctor) {
    throw new Error(`unknown adapter "${name}" (available: ${ADAPTER_NAMES.join(', ')})`);
  }
  return new Ctor();
}
