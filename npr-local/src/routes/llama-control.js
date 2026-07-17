// src/routes/llama-control.js
// Llama.cpp process management routes
// Admin-only — never public without auth

'use strict';

const { Router } = require('express');
const { probePort, probeLlamaHttp } = require('../runtime/llama-supervisor.cjs');
const llamaConfig = require('../config/llama-runtime.js');

const router = Router();

// Lazy-init supervisor (singleton per gateway instance)
let _supervisor = null;
function getSupervisor() {
  if (!_supervisor) {
    const { LlamaSupervisor } = require('../runtime/llama-supervisor.cjs');
    _supervisor = new LlamaSupervisor(llamaConfig);
  }
  return _supervisor;
}

function setSupervisor(sup) { _supervisor = sup; }

// ─── Routes ──────────────────────────────────────────────────────

// GET /api/llama/status — inspect current state
router.get('/status', async (req, res) => {
  try {
    const sup = getSupervisor();
    const status = await sup.inspect();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/llama/start — start llama-server
router.post('/start', async (req, res) => {
  try {
    requireAdmin(req);
    const sup = getSupervisor();
    const status = await sup.start();
    res.json(status);
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// POST /api/llama/stop — stop gateway-managed llama-server
router.post('/stop', async (req, res) => {
  try {
    requireAdmin(req);
    const sup = getSupervisor();
    const status = await sup.stop();
    res.json(status);
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// POST /api/llama/restart — stop then start
router.post('/restart', async (req, res) => {
  try {
    requireAdmin(req);
    const sup = getSupervisor();
    const status = await sup.restart();
    res.json(status);
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

// GET /api/llama/logs — last N log lines
router.get('/logs', async (req, res) => {
  try {
    const sup = getSupervisor();
    const lines = parseInt(req.query.lines, 10) || 100;
    res.json({ logs: sup.getLogs(lines) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/llama/config — read-only config projection
router.get('/config', (req, res) => {
  res.json({
    host: llamaConfig.host,
    port: llamaConfig.port,
    model: llamaConfig.model,
    contextSize: llamaConfig.contextSize,
    parallelSlots: llamaConfig.parallelSlots,
    startPolicy: llamaConfig.startPolicy,
    recovery: llamaConfig.recovery,
    extraArgs: llamaConfig.extraArgs,
  });
});

// ─── SSE stream for logs ─────────────────────────────────────────

// GET /api/llama/stream — SSE for live log + status events
router.get('/stream', (req, res) => {
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
});

// ─── Guards ──────────────────────────────────────────────────────

function requireAdmin(req) {
  // For local dev: allow if X-Gateway-Admin header matches
  // For prod: bind gateway to 127.0.0.1 or use token auth
  const token = req.headers['x-gateway-admin'];
  const adminToken = process.env.GATEWAY_ADMIN_TOKEN;

  // If no admin token configured, allow local connections only
  if (!adminToken && req.ip !== '::1' && req.ip !== '127.0.0.1') {
    throw new Error('Admin access denied — bind to localhost or set GATEWAY_ADMIN_TOKEN');
  }

  // If token configured, validate
  if (adminToken && token !== adminToken) {
    throw new Error('Invalid admin token');
  }
}

module.exports = { router, setSupervisor };
