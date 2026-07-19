// src/model-provider/providers/http.js
// Generic OpenAI-compatible HTTP provider (local-first, no external deps)

'use strict';

const { URL } = require('url');

class HttpProvider {
  /**
   * @param {Object} config
   * @param {string} config.url      — Base URL (e.g. http://localhost:8080)
   * @param {string} config.model    — Model identifier
   * @param {string} [config.apiKey] — Bearer token (optional, for remote APIs)
   * @param {string} [config.path]   — API path override (default: /v1/chat/completions)
   * @param {Object} [config.options] — Default inference params
   */
  constructor(config = {}) {
    this.url = new URL(config.url || 'http://localhost:8080');
    this.model = config.model || '';
    this.apiKey = config.apiKey || '';
    this.apiPath = config.path || '/v1/chat/completions';
    this.defaults = {
      temperature: 0.7,
      top_p: 0.9,
      ...config.options,
    };
    this.requestTimeout = config.requestTimeoutMs || 120_000;
  }

  name() {
    return 'http';
  }

  _headers() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  // ── chat ────────────────────────────────────────────────────────

  async chat(messages, options = {}) {
    const merged = { ...this.defaults, ...options };
    const body = {
      model: this.model,
      messages,
      stream: false,
      ...merged,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const endpoint = new URL(this.apiPath, this.url.origin);
      const resp = await fetch(endpoint.href, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        const text = await resp.text().catch(() => '(no body)');
        throw new Error(`HTTP provider ${resp.status}: ${text}`);
      }

      const data = await resp.json();
      const choice = data.choices?.[0];
      return {
        content: choice?.message?.content || choice?.text || '',
        usage: data.usage || null,
        model: data.model || this.model,
      };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`HTTP provider request timed out after ${this.requestTimeout}ms`);
      }
      throw err;
    }
  }

  // ── chatStream ──────────────────────────────────────────────────

  async *chatStream(messages, options = {}) {
    const merged = { ...this.defaults, ...options };
    const body = {
      model: this.model,
      messages,
      stream: true,
      ...merged,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const endpoint = new URL(this.apiPath, this.url.origin);
      const resp = await fetch(endpoint.href, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        const text = await resp.text().catch(() => '(no body)');
        throw new Error(`HTTP provider ${resp.status}: ${text}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line === 'data: [DONE]') continue;

          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const chunk = JSON.parse(jsonStr);
              const delta = chunk.choices?.[0]?.delta;
              const content = delta?.content || '';
              if (content) {
                yield { token: content, usage: chunk.usage || null, model: chunk.model || this.model };
              }
            } catch {
              // skip malformed
            }
          }
        }
      }
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`HTTP provider stream timed out after ${this.requestTimeout}ms`);
      }
      throw err;
    }
  }

  // ── health ──────────────────────────────────────────────────────

  async health() {
    const start = Date.now();
    try {
      // Try /v1/models (OpenAI-compatible listing)
      const modelsUrl = new URL('/v1/models', this.url.origin);
      const resp = await fetch(modelsUrl.href, {
        headers: this._headers(),
        signal: AbortSignal.timeout(5_000),
      });
      const latency = Date.now() - start;

      if (!resp.ok) {
        return {
          status: 'degraded',
          latency,
          model: this.model,
          reason: `api-error-${resp.status}`,
        };
      }

      const data = await resp.json();
      const modelIds = data.data?.map((m) => m.id || m) || [];

      return {
        status: modelIds.length > 0 ? 'ok' : 'degraded',
        latency,
        model: this.model,
        availableModels: modelIds,
        details: { modelCount: modelIds.length },
      };
    } catch {
      const latency = Date.now() - start;
      return {
        status: 'unavailable',
        latency,
        model: this.model,
        reason: 'connection-failed',
      };
    }
  }
}

module.exports = { HttpProvider };
