// src/model-provider/providers/llamacpp.js
// Llama.cpp HTTP API provider (local-first, no external deps)

'use strict';

const { URL } = require('url');

class LlamaCppProvider {
  constructor(config = {}) {
    this.url = new URL(config.url || 'http://localhost:8765');
    this.model = config.model || '';
    this.defaults = {
      temperature: 0.7,
      top_p: 0.9,
      ...config.options,
    };
    this.requestTimeout = config.requestTimeoutMs || 120_000;
  }

  name() {
    return 'llamacpp';
  }

  // ── chat ────────────────────────────────────────────────────────

  async chat(messages, options = {}) {
    const merged = { ...this.defaults, ...options };
    const body = {
      ...merged,
      messages,
      stream: false,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const resp = await fetch(`${this.url.origin}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        const text = await resp.text().catch(() => '(no body)');
        throw new Error(`llama.cpp ${resp.status}: ${text}`);
      }

      const data = await resp.json();
      return {
        content: data.content || data.content?.[0]?.text || data.content?.[0]?.text || '',
        usage: data.usage || null,
        model: this.model,
      };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`llama.cpp request timed out after ${this.requestTimeout}ms`);
      }
      throw err;
    }
  }

  // ── chatStream ──────────────────────────────────────────────────

  async *chatStream(messages, options = {}) {
    const merged = { ...this.defaults, ...options };
    const body = {
      ...merged,
      messages,
      stream: true,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeout);

    let usage = null;

    try {
      const resp = await fetch(`${this.url.origin}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!resp.ok) {
        const text = await resp.text().catch(() => '(no body)');
        throw new Error(`llama.cpp ${resp.status}: ${text}`);
      }

      // Handle SSE or JSON-lines from llama.cpp
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          // SSE format: "data: ..."
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;
            try {
              const chunk = JSON.parse(jsonStr);
              if (chunk.content) {
                yield { token: chunk.content, usage: null, model: this.model };
              }
              if (chunk.usage) usage = chunk.usage;
            } catch {
              // malformed SSE line, skip
            }
          } else if (line.startsWith('{')) {
            // Some llama.cpp builds emit raw JSON lines
            try {
              const chunk = JSON.parse(line);
              if (chunk.content) {
                yield { token: chunk.content, usage: null, model: this.model };
              }
              if (chunk.usage) usage = chunk.usage;
            } catch {
              // skip
            }
          }
        }
      }

      // Final usage if available
      if (usage) {
        yield { token: '', usage, model: this.model };
      }
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`llama.cpp stream timed out after ${this.requestTimeout}ms`);
      }
      throw err;
    }
  }

  // ── health ──────────────────────────────────────────────────────

  async health() {
    const start = Date.now();
    try {
      // /health endpoint (llama.cpp 3.x+) or / as fallback
      const resp = await fetch(`${this.url.origin}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      const latency = Date.now() - start;
      const data = resp.ok ? await resp.json() : {};
      return {
        status: resp.ok ? 'ok' : 'degraded',
        latency,
        model: data.model_name || this.model,
        details: data,
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

module.exports = { LlamaCppProvider };
