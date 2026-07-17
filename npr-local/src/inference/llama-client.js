// @addr 10.06.0.0 | fd00:npr:0006:000::0
// ═══════════════════════════════════════════════════
// inference/llama-client.js — llama.cpp Model Client
// ═══════════════════════════════════════════════════
// Extracted from agent/loop.js (callModel + callModelStream)
// OpenAI-compatible API (llama-server :8765)
// ═══════════════════════════════════════════════════

// ─── Defaults (env-overridable) ────────────────────────────────

// @addr 10.06.0.1 | fd00:npr:0006:000::1 — default config
const DEFAULT_LLAMA_URL = 'http://127.0.0.1:8765/v1/chat/completions';

function defaultModelName() {
  return process.env.MODEL_NAME || 'Qwen3.6-27B-Q4_K_M.gguf';
}

function defaultMaxTokens() {
  return parseInt(process.env.MAX_TOKENS, 10) || 2048;
}

function defaultModelApi() {
  return process.env.MODEL_API || DEFAULT_LLAMA_URL;
}

// ─── Client Factory ────────────────────────────────────────────

// @addr 10.06.1.0 | fd00:npr:0006:001::0 — createLlamaClient
function createLlamaClient(options = {}) {
  const apiUrl = options.apiUrl ?? defaultModelApi();
  const model = options.model ?? defaultModelName();
  const maxTokens = options.maxTokens ?? defaultMaxTokens();
  const temperature = options.temperature ?? 0.3;
  const defaultTimeout = options.timeout ?? 120000;
  const defaultRetry = options.retry ?? 1;
  const enableThinking = options.enableThinking ?? false;

  // ─── Non-streaming call ──────────────────────────────────────

  // @addr 10.06.1.1 | fd00:npr:0006:001::1 — complete
  async function complete(messages, opts = {}) {
    const timeout = opts.timeout ?? defaultTimeout;
    const retry = opts.retry ?? defaultRetry;
    const maxTok = opts.maxTokens ?? maxTokens;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTok,
            enable_thinking: enableThinking,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
        }

        const data = await res.json();
        const msg = data.choices?.[0]?.message;
        // Qwen3.6 and similar may return reasoning_content instead of content
        const content = msg?.content || msg?.reasoning_content || '';

        if (!content || typeof content !== 'string') {
          throw new Error(
            `Invalid model response format: ${JSON.stringify(data).slice(0, 200)}`
          );
        }

        return content;
      } catch (e) {
        if (attempt < retry) {
          console.warn(
            `[llama] Attempt ${attempt + 1} failed, retrying...: ${e.message}`
          );
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        } else {
          clearTimeout(timer);
          if (e.name === 'AbortError') {
            throw new Error(`Model timeout after ${timeout / 1000}s`);
          }
          throw e;
        }
      }
    }
  }

  // ─── Streaming call (SSE async generator) ────────────────────

  // @addr 10.06.1.2 | fd00:npr:0006:001::2 — stream
  async function* stream(messages, opts = {}) {
    const timeout = opts.timeout ?? defaultTimeout;
    const maxTok = opts.maxTokens ?? maxTokens;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTok,
          stream: true,
          enable_thinking: enableThinking,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (!trimmed.startsWith('data: ')) continue;

            try {
              const json = JSON.parse(trimmed.slice(6));
              const token = json.choices?.[0]?.delta?.content;
              if (token) yield token;
            } catch {
              // skip unparseable SSE lines
            }
          }
        }
      } finally {
        clearTimeout(timer);
        reader.releaseLock();
      }
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') {
        throw new Error(`Stream timeout after ${timeout / 1000}s`);
      }
      throw e;
    }
  }

  return { complete, stream };
}

// ─── Module Exports ────────────────────────────────────────────

module.exports = {
  DEFAULT_LLAMA_URL,
  createLlamaClient,
  defaultModelName,
  defaultMaxTokens,
  defaultModelApi,
};
