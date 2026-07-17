// @net 10.05.0.0/24
// ═══════════════════════════════════════════════════
// @net 10.05.0.0/24
// routes/core.js — NPR Route Engine
// ═══════════════════════════════════════════════════
// Minimal routing: path → slot → handler
// No string cascade. Hash lookup. O(1).
// ═══════════════════════════════════════════════════

const crypto = require('crypto');

const PHASES = [
  { id: 0, name: '6N',  label: 'Noise',   range: [0, 15] },
  { id: 1, name: '12P', label: 'Pattern', range: [16, 31] },
  { id: 2, name: '18R', label: 'Return',  range: [32, 47] },
  { id: 3, name: '24H', label: 'Hexa',    range: [48, 63] },
];

const PATH_TO_SLOT = new Map();
const SLOT_HANDLERS = new Map();
const PATH_EXACT = new Map(); // exact path → handler (priority)
const PATH_PARAM = new Map(); // parameterized path → { pattern, handler }

// ─── Register ───

// @addr 10.05.2.1 | fd00:npr:0005:002::1 — route register
function register(slot, path, handler) {
  if (typeof slot === 'function') {
    // register(path, handler) — auto-slot
    handler = path;
    path = slot;
    const hash = crypto.createHash('md5').update(path).digest();
    slot = hash.readUInt32BE(0) % 64;
  }

  if (slot < 0 || slot > 63) throw new Error(`slot ${slot} buiten 0-63`);

  PATH_TO_SLOT.set(path, slot);

  // Check if path has parameters (:name)
  if (path.includes(':')) {
    const pattern = new RegExp('^' + path.replace(/:\w+/g, '(\w+)') + '$');
    PATH_PARAM.set(pattern, { path, handler });
  } else {
    PATH_EXACT.set(path, handler);
  }

  if (!SLOT_HANDLERS.has(slot)) SLOT_HANDLERS.set(slot, new Map());
  SLOT_HANDLERS.get(slot).set(path, handler);
}

// @addr 10.05.2.2 | fd00:npr:0005:002::2 — prefix register
function registerPrefix(prefix, handler) {
  const hash = crypto.createHash('md5').update(prefix).digest();
  const slot = hash.readUInt32BE(0) % 64;
  PATH_TO_SLOT.set(prefix + '*', slot);
  if (!SLOT_HANDLERS.has(slot)) SLOT_HANDLERS.set(slot, new Map());
  SLOT_HANDLERS.get(slot).set(prefix + '*', handler);
}

// ─── Dispatch ───

// @addr 10.05.2.3 | fd00:npr:0005:002::3 — request dispatch
function dispatch(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Lazy load log to avoid circular dependency
  let log = null;
  try { log = require('../log'); } catch {}

  // Error boundary wrapper — catches sync + async handler errors
  const safeHandler = (handler, ctx) => {
    try {
      const result = handler(req, res, ctx);
      // If handler returns a Promise, catch async errors
      if (result && typeof result.catch === 'function') {
        result.catch(err => {
          if (log) log.error('Handler error', { path: ctx.pathname, error: err.message });
          if (!res.writableEnded) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'internal', message: err.message }));
          }
        });
      }
    } catch (err) {
      if (log) log.error('Handler error', { path: pathname, error: err.message });
      if (!res.writableEnded) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal', message: err.message }));
      }
    }
  };

  // DEBUG
  if (pathname.startsWith('/llama') || pathname.startsWith('/hex-vm')) {
    console.log('DISPATCH DEBUG:', pathname, 'PATH_EXACT.has=', PATH_EXACT.has(pathname), 'PATH_EXACT.keys=', [...PATH_EXACT.keys()].filter(k => k.startsWith('/llama') || k.startsWith('/hex')));
  }

  // 1. Exact match (priority)
  if (PATH_EXACT.has(pathname)) {
    return safeHandler(PATH_EXACT.get(pathname), { url, pathname });
  }

  // 2. Parameterized match
  for (const [pattern, { path, handler }] of PATH_PARAM) {
    const match = pathname.match(pattern);
    if (match) {
      const params = {};
      const paramNames = path.match(/:(\w+)/g) || [];
      paramNames.forEach((name, i) => { params[name.slice(1)] = match[i + 1]; });
      return safeHandler(handler, { url, pathname, params });
    }
  }

  // 3. Prefix match
  for (const [key] of PATH_EXACT) {
    if (key.endsWith('*') && pathname.startsWith(key.slice(0, -1))) {
      return safeHandler(PATH_EXACT.get(key), { url, pathname });
    }
  }

  // 4. Hash fallback
  const hash = crypto.createHash('md5').update(pathname).digest();
  const slot = hash.readUInt32BE(0) % 64;
  const handlers = SLOT_HANDLERS.get(slot);
  if (handlers && handlers.has('__default__')) {
    return safeHandler(handlers.get('__default__'), { url, pathname, slot });
  }

  // 5. Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found', path: pathname, slot }));
}

// ─── Phase info ───

// @addr 10.05.0.1 | fd00:npr:0005:000::1 — phase info
function phaseInfo(slot) {
  const phase = PHASES[Math.floor(slot / 16)] || null;
  return {
    slot,
    binary: slot.toString(2).padStart(6, '0'),
    phase: phase?.name || null,
    label: phase?.label || null,
    slotInPhase: slot % 16,
    subnet: `fe80::${slot.toString(16).padStart(4, '0')}/64`,
  };
}

// ─── Manifest ───

// @addr 10.05.0.2 | fd00:npr:0005:000::2 — manifest
function manifest() {
  const result = {};
  for (const [slot, handlers] of SLOT_HANDLERS) {
    const info = phaseInfo(parseInt(slot));
    const paths = [];
    for (const [p] of handlers) paths.push(p);
    result[slot] = { ...info, paths };
  }
  return result;
}

module.exports = { register, registerPrefix, dispatch, phaseInfo, manifest, PATH_TO_SLOT };
