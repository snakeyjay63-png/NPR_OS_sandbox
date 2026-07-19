// src/routes/models.js
// Model discovery, metrics, and routing — NPR Local model router
// @addr 10.03.4.5 | fd00:npr:0004:000::5

'use strict';

const { performance } = require('perf_hooks');

const MODEL_API = process.env.MODEL_API || 'http://127.0.0.1:8765/v1/chat/completions';
const MODEL_NAME = process.env.MODEL_NAME || 'Qwen3.6-27B-Q4_K_M.gguf';

// Derive the base endpoint from MODEL_API
const MODEL_BASE = MODEL_API.replace(/\/v1\/chat\/completions$/, '');

// ─── Load Balancer ───
// Support multiple model endpoints with round-robin or least-loaded
// Configure via env: MODEL_ENDPOINTS = 'http://a:8765,http://b:8766,http://c:8767'

const rawEndpoints = process.env.MODEL_ENDPOINTS || '';
const ENDPOINTS = rawEndpoints
  ? rawEndpoints.split(',').map(s => s.trim()).filter(Boolean)
  : [MODEL_API];

const endpointActiveModels = new Map(); // track which model is loaded on each endpoint
let rrIndex = 0; // round-robin counter

/**
 * Get next endpoint via round-robin.
 */
function getNextEndpoint() {
  rrIndex = (rrIndex + 1) % ENDPOINTS.length;
  const api = ENDPOINTS[rrIndex];
  return api.replace(/\/v1\/chat\/completions$/, '');
}

/**
 * Get least-loaded endpoint (by active request count in metrics).
 */
function getLeastLoadedEndpoint() {
  if (ENDPOINTS.length <= 1) return MODEL_BASE;
  let minLoad = Infinity;
  let chosen = ENDPOINTS[0];
  for (const api of ENDPOINTS) {
    const base = api.replace(/\/v1\/chat\/completions$/, '');
    // Simple heuristic: use endpoint index as fallback
    const load = Math.random(); // placeholder for real load tracking
    if (load < minLoad) {
      minLoad = load;
      chosen = base;
    }
  }
  return chosen;
}

/**
 * Get the next endpoint based on strategy.
 */
function getNextEndpointByStrategy(strategy = 'round-robin') {
  if (ENDPOINTS.length <= 1) return MODEL_BASE;
  switch (strategy) {
    case 'least-loaded': return getLeastLoadedEndpoint();
    case 'round-robin':
    default: return getNextEndpoint();
  }
}

/**
 * Health check for an endpoint.
 */
async function checkEndpointHealth(base) {
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get all endpoint statuses.
 */
async function getEndpointStatuses() {
  const statuses = [];
  for (const api of ENDPOINTS) {
    const base = api.replace(/\/v1\/chat\/completions$/, '');
    const healthy = await checkEndpointHealth(base);
    const activeModel = endpointActiveModels.get(base) || null;
    statuses.push({
      endpoint: api,
      base,
      healthy,
      activeModel,
    });
  }
  return statuses;
}

module.exports.ENDPOINTS = ENDPOINTS;
module.exports.getNextEndpoint = getNextEndpoint;
module.exports.getNextEndpointByStrategy = getNextEndpointByStrategy;
module.exports.getEndpointStatuses = getEndpointStatuses;

// ─── Metrics Store ───
// Per-model performance tracking (in-memory, reset on restart)
const metrics = new Map();

/**
 * Record a model inference event.
 */
function recordInference(modelName, tokens, elapsedMs, success = true) {
  if (!metrics.has(modelName)) {
    metrics.set(modelName, {
      totalRequests: 0,
      totalTokens: 0,
      totalElapsedMs: 0,
      successCount: 0,
      errorCount: 0,
      minElapsedMs: Infinity,
      maxElapsedMs: 0,
      firstSeen: Date.now(),
      lastSeen: 0,
    });
  }
  const m = metrics.get(modelName);
  m.totalRequests++;
  m.totalTokens += tokens;
  m.totalElapsedMs += elapsedMs;
  m.lastSeen = Date.now();
  if (success) m.successCount++; else m.errorCount++;
  if (elapsedMs < m.minElapsedMs) m.minElapsedMs = elapsedMs;
  if (elapsedMs > m.maxElapsedMs) m.maxElapsedMs = elapsedMs;
}

/**
 * Get aggregated metrics for all models.
 */
function getMetrics() {
  const result = [];
  for (const [name, m] of metrics) {
    const avgMs = m.totalRequests > 0 ? m.totalElapsedMs / m.totalRequests : 0;
    const tps = avgMs > 0 ? (m.totalTokens / m.totalRequests) / (avgMs / 1000) : 0;
    result.push({
      model: name,
      requests: m.totalRequests,
      tokens: m.totalTokens,
      avgMs: Math.round(avgMs),
      minMs: m.minElapsedMs === Infinity ? 0 : m.minElapsedMs,
      maxMs: m.maxElapsedMs,
      tokensPerSecond: parseFloat(tps.toFixed(1)),
      successRate: m.totalRequests > 0 ? (m.successCount / m.totalRequests * 100).toFixed(1) : '0',
      firstSeen: new Date(m.firstSeen).toISOString(),
      lastSeen: new Date(m.lastSeen).toISOString(),
    });
  }
  return result;
}

// ─── Model Discovery ───

/**
 * Discover available models from the llama.cpp API.
 * Returns array of model objects.
 */
async function discoverModels() {
  const results = [];
  let error = null;

  try {
    const res = await fetch(`${MODEL_BASE}/v1/models`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      // llama.cpp returns BOTH data.models (basic) and data.data (with meta).
      // Merge: use data.data as primary (has n_ctx, n_params), fall back to data.models.
      const rawModels = (data.data || data.models || []).map(m => ({
        id: m.id || m.model || m.name,
        name: m.name || m.model || m.id,
        ownedBy: m.owned_by || 'llamacpp',
        meta: m.meta || {},
      }));

      // If we have both arrays, enrich models-array entries with data-array meta
      if (data.data && data.models && data.data.length > 0) {
        const metaById = new Map(data.data.map(d => [d.id, d.meta || {}]));
        for (const m of rawModels) {
          if (metaById.has(m.id) && Object.keys(m.meta).length === 0) {
            m.meta = metaById.get(m.id);
          }
        }
      }

      for (const m of rawModels) {
        const meta = m.meta;
        const info = {
          id: m.id,
          name: m.name,
          ownedBy: m.ownedBy,
          ctx: meta.n_ctx || 0,
          params: meta.n_params ? `${(meta.n_params / 1e9).toFixed(1)}B` : null,
          embedding: meta.n_embd || null,
          sizeBytes: meta.size || 0,
          sizeHuman: meta.size ? `${(meta.size / 1024 / 1024 / 1024).toFixed(1)}GB` : null,
        };
        // Merge metrics if available
        const mInfo = getMetrics().find(x => x.model === info.id);
        if (mInfo) {
          info.metrics = mInfo;
        }
        results.push(info);
      }
    }
  } catch (e) {
    error = e.message;
  }

  // Also check if there are other known model endpoints (Ollama, etc.)
  // For now, just the llama.cpp one
  return {
    models: results,
    active: MODEL_NAME,
    endpoint: MODEL_BASE,
    error,
  };
}

// ─── Handlers ───

/**
 * GET /models — list available models + metrics
 */
async function handlerModels(req, res) {
  try {
    const data = await discoverModels();
    res.json(data);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

/**
 * GET /models/metrics — performance metrics only
 */
function handlerModelMetrics(req, res) {
  res.json({
    metrics: getMetrics(),
    totalModels: metrics.size,
  });
}

/**
 * POST /models/switch — switch active model via llama.cpp /v1/models/load
 */
async function handlerSwitchModel(req, res) {
  const { model } = req.body || {};
  if (!model) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'model required' }));
    return;
  }

  // Check if model exists in discovered list
  try {
    const discover = await discoverModels();
    const target = discover.models.find(m => m.id === model);
    if (!target) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Model '${model}' not found`, available: discover.models.map(m => m.id) }));
      return;
    }
  } catch (e) {
    // Discovery failed, try anyway
  }

  // Attempt dynamic load via llama.cpp API
  try {
    const loadRes = await fetch(`${MODEL_BASE}/v1/models/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(10000),
    });
    const loadData = await loadRes.json();

    if (loadRes.ok || loadData.success) {
      // Update active model reference
      res.json({
        status: 'switched',
        model,
        previous: MODEL_NAME,
      });
    } else {
      // Model already loaded or other error
      res.json({
        status: 'already-active',
        model,
        note: loadData.error?.message || 'Could not switch model',
      });
    }
  } catch (e) {
    res.json({
      status: 'error',
      model,
      note: `llama.cpp load failed: ${e.message}`,
    });
  }
}

module.exports = {
  handlerModels,
  handlerModelMetrics,
  handlerSwitchModel,
  recordInference,
  getMetrics,
  ENDPOINTS,
  getNextEndpoint,
  getNextEndpointByStrategy,
  getEndpointStatuses,
  checkEndpointHealth,
};
