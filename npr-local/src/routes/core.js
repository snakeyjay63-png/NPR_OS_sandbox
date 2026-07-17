// @net 10.05.0.0/24
// ═══════════════════════════════════════════════════
// @net 10.05.0.0/24
// routes/core.js — NPR Route Engine
// ═══════════════════════════════════════════════════
// Minimal routing: path → slot → handler
// No string cascade. Hash lookup. O(1).
// ═══════════════════════════════════════════════════

const crypto = require('crypto');

// ─── Hex Constants ───

const SLOT_COUNT = 0x40;
const PHASE_SIZE = 0x10;

// @addr 10.05.0.0 — hex formatter
function toHex(n) {
  n = parseInt(n) || 0;
  return "0x" + n.toString(16).toUpperCase();
}

// @addr 10.05.0.0 — slot parser (accepts 0xNN, NN, or bare number; validates 0x00–0x3F)
function parseSlot(raw) {
  let n;
  if (typeof raw === 'number') {
    n = raw;
  } else {
    const s = String(raw).trim();
    if (/^0x[0-9a-fA-F]+$/.test(s)) {
      n = parseInt(s, 16);
    } else {
      n = parseInt(s, 10);
    }
  }
  if (isNaN(n) || n < 0x00 || n > 0x3F) {
    throw new Error(`slot ${raw} buiten 0x00–0x3F`);
  }
  return n;
}

const PHASES = [
  { id: 0x00, name: '6N',  label: 'Noise',   range: [0x00, 0x0F] },
  { id: 0x01, name: '12P', label: 'Pattern', range: [0x10, 0x1F] },
  { id: 0x02, name: '18R', label: 'Return',  range: [0x20, 0x2F] },
  { id: 0x03, name: '24H', label: 'Hexa',    range: [0x30, 0x3F] },
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
    slot = hash.readUInt32BE(0) % SLOT_COUNT;
  }

  if (slot < 0 || slot > 0x3F) throw new Error(`slot ${toHex(slot)} buiten 0x00–0x3F`);

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
  const slot = hash.readUInt32BE(0) % SLOT_COUNT;
  PATH_TO_SLOT.set(prefix + '*', slot);
  if (!SLOT_HANDLERS.has(slot)) SLOT_HANDLERS.set(slot, new Map());
  SLOT_HANDLERS.get(slot).set(prefix + '*', handler);
}

// ─── Dispatch ───

// @addr 10.05.2.3 | fd00:npr:0005:002::3 — request dispatch
// opts.app merges into ctx so handlers can access routeController, contextMeter, etc.
function dispatch(req, res, opts = {}) {
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

  const ctxBase = { url, pathname, app: opts.app || null };

  // 1. Exact match (priority)
  if (PATH_EXACT.has(pathname)) {
    return safeHandler(PATH_EXACT.get(pathname), ctxBase);
  }

  // 2. Parameterized match
  for (const [pattern, { path, handler }] of PATH_PARAM) {
    const match = pathname.match(pattern);
    if (match) {
      const params = {};
      const paramNames = path.match(/:(\w+)/g) || [];
      paramNames.forEach((name, i) => { params[name.slice(1)] = match[i + 1]; });
      return safeHandler(handler, { ...ctxBase, params });
    }
  }

  // 3. Prefix match
  for (const [key] of PATH_EXACT) {
    if (key.endsWith('*') && pathname.startsWith(key.slice(0, -1))) {
      return safeHandler(PATH_EXACT.get(key), ctxBase);
    }
  }

  // 4. Hash fallback
  const hash = crypto.createHash('md5').update(pathname).digest();
  const slot = hash.readUInt32BE(0) % SLOT_COUNT;
  const handlers = SLOT_HANDLERS.get(slot);
  if (handlers && handlers.has('__default__')) {
    return safeHandler(handlers.get('__default__'), { ...ctxBase, slot });
  }

  // 5. Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found', path: pathname, slot_hex: toHex(slot), slot }));
}

// ─── Phase info ───

// @addr 10.05.0.1 | fd00:npr:0005:000::1 — phase info (hex-canonical)
function phaseInfo(slot) {
  const phase = PHASES[Math.floor(slot / PHASE_SIZE)] || null;
  return {
    slot,
    slot_hex: toHex(slot),
    binary: slot.toString(2).padStart(6, '0'),
    phase: phase?.name || null,
    label: phase?.label || null,
    slot_in_phase_hex: toHex(slot % PHASE_SIZE),
    slotInPhase: slot % PHASE_SIZE,
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
    result[toHex(slot)] = { ...info, paths };
  }
  return result;
}

// @addr 10.05.3.0 — NPR route stop handler
function handleNprRouteStop(req, res, ctx) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'method not allowed', method: 'POST' }));
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { session_id, sessionId } = body ? JSON.parse(body) : {};
      const sid = session_id || sessionId;
      if (!sid) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'missing session_id' }));
      }

      // Resolve route controller from app context
      const routeController = ctx.app?.routeController;
      if (!routeController) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'route_controller not available' }));
      }

      const stopped = routeController.stop(sid);
      if (!stopped) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'no active route for session', session_id: sid }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'stopped', session_id: sid }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'bad request', message: err.message }));
    }
  });
}

// @addr 10.05.3.1 — NPR route status handler
function handleNprRouteStatus(req, res, ctx) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'method not allowed', method: 'GET' }));
  }

  const routeController = ctx.app?.routeController;
  if (!routeController) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'route_controller not available' }));
  }

  const url = ctx.url;
  const sessionId = url.searchParams.get('session_id') || url.searchParams.get('sessionId');

  if (sessionId) {
    const status = routeController.getStatus(sessionId);
    if (!status) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'no route for session', session_id: sessionId }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(status));
  }

  // No session_id — return all active routes
  const activeRoutes = routeController.getActiveRoutes();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ active_routes: activeRoutes, count: activeRoutes.length }));
}

module.exports = { register, registerPrefix, dispatch, phaseInfo, manifest, PATH_TO_SLOT, toHex, parseSlot, SLOT_COUNT, PHASE_SIZE, handleNprRouteStop, handleNprRouteStatus };

