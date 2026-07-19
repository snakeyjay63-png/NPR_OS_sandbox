// src/model-provider/router.js
// ModelRouter — registers providers, routes requests, health-checks

'use strict';

const { LlamaCppProvider } = require('./providers/llamacpp.js');
const { OllamaProvider } = require('./providers/ollama.js');
const { HttpProvider } = require('./providers/http.js');

const TYPE_MAP = {
  llamacpp: LlamaCppProvider,
  ollama: OllamaProvider,
  http: HttpProvider,
};

class ModelRouter {
  constructor() {
    /** @type {Map<string, import('./providers/llamacpp').LlamaCppProvider | import('./providers/ollama').OllamaProvider | import('./providers/http').HttpProvider>} */
    this.providers = new Map();
    this.defaultId = null;
  }

  // ── registration ────────────────────────────────────────────────

  /**
   * Register a provider instance.
   * @param {string} id    — Provider key (e.g. 'llama-local')
   * @param {object} provider — Provider instance
   */
  registerProvider(id, provider) {
    if (!id || typeof id !== 'string') {
      throw new Error('Provider id must be a non-empty string');
    }
    if (!provider || typeof provider.chat !== 'function') {
      throw new Error('Provider must implement chat(messages, options)');
    }
    this.providers.set(id, provider);

    // Auto-set as default if this is the first
    if (!this.defaultId) {
      this.defaultId = id;
    }
  }

  /**
   * Register a provider from config (type-based instantiation).
   * @param {string} id
   * @param {object} config — { type, url, model, options }
   */
  registerProviderConfig(id, config) {
    const ProviderClass = TYPE_MAP[config.type];
    if (!ProviderClass) {
      const available = Object.keys(TYPE_MAP).join(', ');
      throw new Error(`Unknown provider type "${config.type}". Available: ${available}`);
    }
    const provider = new ProviderClass(config);
    this.registerProvider(id, provider);
    return provider;
  }

  /**
   * Bulk-register from a providers config object.
   * @param {Object} config — { providers: { [id]: {type, url, ...} }, default?: string }
   */
  registerProviders(config) {
    if (!config?.providers) {
      throw new Error('Config must have a "providers" map');
    }

    for (const [id, providerConfig] of Object.entries(config.providers)) {
      this.registerProviderConfig(id, providerConfig);
    }

    if (config.default) {
      if (!this.providers.has(config.default)) {
        throw new Error(`Default provider "${config.default}" not registered`);
      }
      this.defaultId = config.default;
    }
  }

  // ── accessors ───────────────────────────────────────────────────

  getProvider(id) {
    const provider = this.providers.get(id);
    if (!provider) {
      const available = [...this.providers.keys()].join(', ');
      throw new Error(`Provider "${id}" not found. Available: ${available}`);
    }
    return provider;
  }

  /**
   * @returns {Array<{id, type, model, status}>}
   */
  listProviders() {
    const list = [];
    for (const [id, provider] of this.providers) {
      list.push({
        id,
        type: provider.name(),
        model: provider.model,
        default: id === this.defaultId,
      });
    }
    return list;
  }

  getDefaultProvider() {
    if (!this.defaultId) {
      throw new Error('No default provider set');
    }
    return this.getProvider(this.defaultId);
  }

  setDefaultProvider(id) {
    if (!this.providers.has(id)) {
      const available = [...this.providers.keys()].join(', ');
      throw new Error(`Cannot set default: provider "${id}" not found. Available: ${available}`);
    }
    this.defaultId = id;
  }

  // ── routing ─────────────────────────────────────────────────────

  /**
   * Route a chat request to a provider.
   * @param {Array} messages
   * @param {Object} [options] — { provider?: string, temperature?: number, ... }
   * @returns {Promise<{content, usage, model}>}
   */
  async route(messages, options = {}) {
    const { provider, ...passThrough } = options;
    const target = provider ? this.getProvider(provider) : this.getDefaultProvider();
    return target.chat(messages, passThrough);
  }

  /**
   * Route a streaming chat request to a provider.
   * @param {Array} messages
   * @param {Object} [options] — { provider?: string, temperature?: number, ... }
   * @returns {AsyncIterable<{token, usage, model}>}
   */
  async *routeStream(messages, options = {}) {
    const { provider, ...passThrough } = options;
    const target = provider ? this.getProvider(provider) : this.getDefaultProvider();
    yield* target.chatStream(messages, passThrough);
  }

  // ── health ──────────────────────────────────────────────────────

  /**
   * Health-check all registered providers.
   * @param {number} [timeoutMs] — Per-provider timeout (default 5s)
   * @returns {Promise<Array<{id, status, latency, model, reason?}>>}
   */
  async healthCheck(timeoutMs) {
    const checks = [];
    for (const [id, provider] of this.providers) {
      checks.push(
        (async () => {
          const result = await Promise.race([
            provider.health(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), timeoutMs || 5_000),
            ),
          ]);
          return {
            id,
            default: id === this.defaultId,
            ...(result || { status: 'error', reason: 'timeout' }),
          };
        })(),
      );
    }
    return Promise.all(checks);
  }
}

module.exports = { ModelRouter };
