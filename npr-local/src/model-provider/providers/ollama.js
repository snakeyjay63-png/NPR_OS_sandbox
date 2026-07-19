// src/model-provider/providers/ollama.js
// Ollama API provider (local-first, no external deps)

'use strict';

const { URL } = require('url');

class OllamaProvider {
  constructor(config = {}) {
    this.url = new URL(config.url || 'http://localhost:11434');
    this.model = config.model || '';
    this.defaults = {
      options: {
        temperature: 0.7,
        top_p: 0.9,
        ...config.options,
      },
    };
    this.requestTimeout = config.requestTimeoutMs || 120_000;
  }

  name() {
    return 'ollama';
  }

  // ── chat ────────────────────────────────────────────────────────

  async chat(messages, options = {}) {
    const mergedOptions = {
      ...this.defaults.options,
      ...options,
    };

    const body = {
      model: this.model,
      messages,
      stream: false,
      options: mergedOptions,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const resp = await fetch(`${this.url.origin}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        const text = await resp.text().catch(() => '(no body)');
        throw new Error(`Ollama ${resp.status}: ${text}`);
      }

      const data = await resp.json();
      return {
        content: data.message?.content || '',
        usage: data.total_duration
          ? {
              prompt_eval_duration: data.prompt_eval_duration,
              eval_duration: data.load_duration || 0,
              total_duration: data.total_duration,
              prompt_eval_count: data.prompt_eval_count,
              eval_count: data.eval_count,
            }
          : null,
        model: data.model || this.model,
      };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${this.requestTimeout}ms`);
      }
      throw err;
    }
  }

  // ── chatStream ──────────────────────────────────────────────────

  async *chatStream(messages, options = {}) {
    const mergedOptions = {
      ...this.defaults.options,
      ...options,
    };

    const body = {
      model: this.model,
      messages,
      stream: true,
      options: mergedOptions,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const resp = await fetch(`${this.url.origin}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        const text = await resp.text().catch(() => '(no body)');
        throw new Error(`Ollama ${resp.status}: ${text}`);
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

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const chunk = JSON.parse(trimmed);
            const content = chunk.message?.content || '';
            if (content) {
              yield { token: content, usage: null, model: chunk.model || this.model };
            }
            // Last chunk carries timing info
            if (chunk.total_duration) {
              yield {
                token: '',
                usage: {
                  prompt_eval_duration: chunk.prompt_eval_duration,
                  eval_duration: chunk.eval_duration || 0,
                  total_duration: chunk.total_duration,
                  prompt_eval_count: chunk.prompt_eval_count,
                  eval_count: chunk.eval_count,
                },
                model: chunk.model || this.model,
              };
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`Ollama stream timed out after ${this.requestTimeout}ms`);
      }
      throw err;
    }
  }

  // ── health ──────────────────────────────────────────────────────

  async health() {
    const start = Date.now();
    try {
      const resp = await fetch(`${this.url.origin}/api/tags`, {
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
      const models = data.models?.map((m) => m.name) || [];
      const hasModel = models.includes(this.model);

      return {
        status: hasModel ? 'ok' : 'degraded',
        latency,
        model: this.model,
        availableModels: models,
        details: { hasModel, modelCount: models.length },
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

module.exports = { OllamaProvider };
