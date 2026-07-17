// src/routes/llama-control.js
// Llama.cpp process management — NPR routing handlers
// Admin-only — localhost or GATEWAY_ADMIN_TOKEN

'use strict';

const llamaConfig = require('../config/llama-runtime.js');
const { LlamaSupervisor, probePort, probeLlamaHttp } = require('../runtime/llama-supervisor.cjs');

// Lazy singleton supervisor
let _supervisor = null;

function getSupervisor() {
  if (!_supervisor) {
    _supervisor = new LlamaSupervisor(llamaConfig);
  }
  return _supervisor;
}

function setSupervisor(sup) { _supervisor = sup; }

// ─── Guards ──────────────────────────────────────────────────────

function requireAdmin(req, res) {
  const adminToken = process.env.GATEWAY_ADMIN_TOKEN;
  const token = req.headers['x-gateway-admin'];

  // Check IP
  const ip = req.socket?.remoteAddress || '';
  const isLocal = ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';

  if (!adminToken && !isLocal) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Admin access denied — bind to localhost or set GATEWAY_ADMIN_TOKEN' }));
    return false;
  }

  if (adminToken && token !== adminToken) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid admin token' }));
    return false;
  }

  return true;
}

// ─── Handlers ────────────────────────────────────────────────────

// GET /llama/status — inspect current state
async function handlerStatus(req, res) {
  try {
    const sup = getSupervisor();
    const status = await sup.inspect();
    res.json(status);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// POST /llama/start — start llama-server
async function handlerStart(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const sup = getSupervisor();
    const status = await sup.start();
    res.json(status);
  } catch (err) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// POST /llama/stop — stop gateway-managed llama-server
async function handlerStop(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const sup = getSupervisor();
    const status = await sup.stop();
    res.json(status);
  } catch (err) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// POST /llama/restart — stop then start
async function handlerRestart(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    const sup = getSupervisor();
    const status = await sup.restart();
    res.json(status);
  } catch (err) {
    res.writeHead(409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// GET /llama/logs — last N log lines
function handlerLogs(req, res) {
  try {
    const sup = getSupervisor();
    const lines = parseInt(req.url.split('lines=')[1]?.split('&')[0] || '100', 10);
    res.json({ logs: sup.getLogs(lines) });
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// GET /llama/config — read-only config projection
function handlerConfig(req, res) {
  res.json({
    executable: llamaConfig.executable,
    host: llamaConfig.host,
    port: llamaConfig.port,
    model: llamaConfig.model,
    contextSize: llamaConfig.contextSize,
    parallelSlots: llamaConfig.parallelSlots,
    nglHex: llamaConfig.nglHex,
    ngl: llamaConfig.ngl,
    startPolicy: llamaConfig.startPolicy,
    recovery: llamaConfig.recovery,
    extraArgs: llamaConfig.extraArgs,
  });
}

// GET /llama/stream — SSE for live log + status events
function handlerStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('event: connected\ndata: {"ok":true}\n\n');

  const sup = getSupervisor();

  const onLog = entry => {
    res.write(`event: log\ndata: ${JSON.stringify(entry)}\n\n`);
  };
  const onStatus = snapshot => {
    res.write(`event: status\ndata: ${JSON.stringify(snapshot)}\n\n`);
  };

  sup.on('log', onLog);
  sup.on('status', onStatus);

  req.on('close', () => {
    sup.off('log', onLog);
    sup.off('status', onStatus);
  });
}

// GET /llama/probe — quick port check (no admin required)
async function handlerProbe(req, res) {
  try {
    const open = await probePort(llamaConfig);
    const health = open ? await probeLlamaHttp(llamaConfig) : { healthy: false, reason: 'port-closed' };
    res.json({ portOpen: open, health });
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

module.exports = {
  handlerStatus,
  handlerStart,
  handlerStop,
  handlerRestart,
  handlerLogs,
  handlerConfig,
  handlerStream,
  handlerProbe,
  getSupervisor,
  setSupervisor,
};
