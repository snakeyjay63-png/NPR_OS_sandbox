// @net 10.08.0.0/24
// routes/config-route.js — Config read/write
// Equivalent: openclaw config get/set

const os = require('os');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(
  process.env.OPENCLAW_CONFIG_PATH ||
  process.env.HOME ||
  os.homedir(),
  '.openclaw',
  'config.json',
);

// In-memory config (merged from file + runtime)
let runtimeConfig = loadConfig();

/**
 * Load config from disk (graceful fallback to defaults)
 */
function loadConfig() {
  const defaults = {
    model: {
      name: process.env.NPR_MODEL || 'llama_cpp/Qwen3.6-27B-Q4_K_M.gguf',
      endpoint: process.env.NPR_MODEL_ENDPOINT || 'http://127.0.0.1:8765',
    },
    server: {
      port: parseInt(process.env.NPR_PORT) || 17000,
      host: '::',
    },
    memory: {
      geowonPort: parseInt(process.env.NPR_GEOWON_PORT) || 5001,
      workspace: process.env.NPR_WORKSPACE || path.join(os.homedir(), '.openclaw', 'workspace'),
    },
    agent: {
      maxTokens: parseInt(process.env.NPR_MAX_TOKENS) || 4096,
      maxHistory: 50,
      windowTokens: 65536,
    },
  };

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      const file = JSON.parse(raw);
      return deepMerge(defaults, file);
    }
  } catch (e) {
    console.error(`[config] Failed to load ${CONFIG_PATH}: ${e.message}`);
  }

  return defaults;
}

/**
 * Deep merge (shallow 2 levels)
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const [key, val] of Object.entries(source)) {
    if (val && typeof val === 'object' && !Array.isArray(val) && result[key] && typeof result[key] === 'object') {
      result[key] = { ...result[key], ...val };
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Get config value by dot path: "model.name" → "llama_cpp/..."
 */
function getAtPath(obj, dotPath) {
  return dotPath.split('.').reduce((cur, key) => cur?.[key], obj);
}

/**
 * Set config value by dot path
 */
function setAtPath(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

/**
 * GET /config — full config or /config?path=model.name
 * POST /config — {"path": "model.endpoint", "value": "..."}
 */
function handler(req, res, ctx = {}) {
  const url = ctx.url || new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const params = new URLSearchParams(url.search);

  if (req.method === 'GET') {
    // GET /config → full config
    // GET /config?path=model.name → single value
    const dotPath = params.get('path');

    if (dotPath) {
      const val = getAtPath(runtimeConfig, dotPath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: dotPath, value: val }, null, 2));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(runtimeConfig, null, 2));
    }

  } else if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { path: dotPath, value } = JSON.parse(body);
        if (!dotPath || value === undefined) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'path and value required' }));
          return;
        }

        const prev = getAtPath(runtimeConfig, dotPath);
        setAtPath(runtimeConfig, dotPath, value);

        // Persist to disk
        try {
          fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(runtimeConfig, null, 2));
        } catch (e) {
          console.error(`[config] Failed to persist: ${e.message}`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          path: dotPath,
          previous: prev,
          current: value,
          persisted: true,
        }, null, 2));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'method not allowed', methods: ['GET', 'POST'] }));
  }
}

module.exports = { handler, runtimeConfig, loadConfig, getAtPath, setAtPath };
