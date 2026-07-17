// @addr 10.03.0.0 | fd00:npr:0003:000::0
// ═══════════════════════════════════════════════════
// agent/noise-gatherer.js — Runtime Evidence Collector
// ═══════════════════════════════════════════════════
// Gathers "noise" (raw runtime evidence) for NPR cycle.
// Sources: OpenClaw state, VM state, workspace, ports, tools.
// Each source is optional — missing = null, never throws.
// ═══════════════════════════════════════════════════

const openclawClient = require('../sources/openclaw-client');

// ─── Gather Noise ────────────────────────────────────────────────

// @addr 10.03.1.0
/**
 * Gather all available runtime evidence.
 *
 * @param {object} opts - Base context (input, route, session_id).
 * @returns {Promise<object>} Noise object with all gathered evidence.
 */
async function gatherNoise(opts = {}) {
  const [openclaw, vm, ports] = await Promise.all([
    _fetchOpenClaw(),
    _fetchVMState(),
    _fetchPorts(),
  ]);

  return {
    // Base context
    input: opts.input ?? null,
    route: opts.route ?? null,
    session_id: opts.session_id ?? null,
    iteration: opts.iteration ?? 0,
    previousAttempt: opts.previousAttempt ?? null,

    // Gathered evidence
    openclaw,
    vm,
    workspace: opts.workspace ?? null,
    ports,
    tools: opts.tools ?? null,
    timestamp: new Date().toISOString(),
  };
}

// ─── Individual Sources ──────────────────────────────────────────

// @addr 10.03.2.0 — OpenClaw state
async function _fetchOpenClaw() {
  try {
    const result = await openclawClient.getOpenClawState();
    if (!result.available) {
      return { available: false, reason: result.error };
    }
    return { available: true, data: result.data };
  } catch {
    return { available: false, reason: 'fetch-error' };
  }
}

// @addr 10.03.2.1 — VM state
async function _fetchVMState() {
  try {
    const { VM64K } = require('../field/npr-hex-vm.cjs');
    const vm = new VM64K();
    return {
      available: true,
      slots: vm.getSlots(),
      trace: vm.getTrace ? vm.getTrace() : null,
    };
  } catch {
    return { available: false, reason: 'vm-not-loaded' };
  }
}

// @addr 10.03.2.2 — Port status (quick check of known ports)
async function _fetchPorts() {
  const net = require('net');
  const ports = [
    { port: 8765, name: 'llama' },
    { port: 5017, name: 'gateway' },
    { port: 17000, name: 'npr-local' },
    { port: 18789, name: 'openclaw' },
  ];

  const results = {};
  await Promise.all(ports.map(async ({ port, name }) => {
    results[name] = await _checkPort(port);
  }));

  return results;
}

// @addr 10.03.2.3 — Single port probe
function _checkPort(port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(0x03E8); // 1000ms

    sock.on('connect', () => { sock.destroy(); resolve('open'); });
    sock.on('timeout', () => { sock.destroy(); resolve('timeout'); });
    sock.on('error', () => { resolve('closed'); });

    sock.connect(port, '127.0.0.1');
  });
}

// ─── Exports ────────────────────────────────────────────────────

module.exports = { gatherNoise };
