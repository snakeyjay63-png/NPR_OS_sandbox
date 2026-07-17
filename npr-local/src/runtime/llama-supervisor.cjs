#!/usr/bin/env node
// src/runtime/llama-supervisor.cjs
// LlamaSupervisor: probe, start, stop, restart, logs, status
// Single source of truth: config/llama-runtime.js

'use strict';

const net = require('node:net');
const { spawn } = require('node:child_process');
const EventEmitter = require('node:events');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8765;

// ─── Probes ───────────────────────────────────────────────────────

function probePort({ host = DEFAULT_HOST, port = DEFAULT_PORT, timeoutMs = 750 } = {}) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = open => { if (settled) return; settled = true; socket.destroy(); resolve(open); };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

// ─── Multi-endpoint Health Check ──────────────────────────────────
// Four endpoints for authoritative status:
//   /health    → 503 during load, 200 {"status":"ok"} when ready
//   /props     → server properties
//   /v1/models → loaded models list
//   /slots     → slot status (requires --slots)

async function probeEndpoint(baseUrl, name, path, timeoutMs = 1500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: controller.signal });
    return {
      name,
      available: response.ok,
      status: response.status,
      body: await response.json().catch(() => null),
      classified: classifyLlamaEndpoint(name, response.status),
    };
  } catch (error) {
    return {
      name,
      available: false,
      status: null,
      classified: 'unreachable',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally { clearTimeout(timer); }
}

function classifyLlamaEndpoint(name, status) {
  if (status >= 200 && status < 300) return 'available';
  if (status === 404 && ['slots', 'metrics', 'tools', 'corsProxy'].includes(name)) {
    return 'disabled';
  }
  return 'error';
}

async function probeLlamaHealth({ host = DEFAULT_HOST, port = DEFAULT_PORT, timeoutMs = 1500 } = {}) {
  const baseUrl = `http://${host}:${port}`;
  const endpoints = [
    ['health', '/health'],
    ['props', '/props'],
    ['models', '/v1/models'],
    ['slots', '/slots'],
  ];

  const results = await Promise.all(
    endpoints.map(([name, path]) => probeEndpoint(baseUrl, name, path, timeoutMs)),
  );

  const ready =
    results.find(r => r.name === 'health')?.status === 200 &&
    results.find(r => r.name === 'models')?.status === 200;

  const optionalFeatures = results.filter(r => r.classified === 'disabled');
  const errors = results.filter(r => r.classified === 'error' || r.classified === 'unreachable');

  return {
    ready,
    endpoints: results,
    optionalFeatures,
    errors,
    healthy: ready && errors.length === 0,
  };
}

// Legacy compat: simple probe (single /v1/models)
async function probeLlamaHttp({ host = DEFAULT_HOST, port = DEFAULT_PORT, timeoutMs = 1500 } = {}) {
  const health = await probeLlamaHealth({ host, port, timeoutMs });
  if (health.ready) {
    const models = health.endpoints.find(r => r.name === 'models');
    return { healthy: true, models: Array.isArray(models?.body?.data) ? models.body.data : [] };
  }
  return { healthy: false, reason: health.errors[0]?.error ?? 'health-check failed' };
}

// ─── Helpers ──────────────────────────────────────────────────────

function buildLlamaArgs(config) {
  return [
    '--model', config.model,
    '--host', config.host,
    '--port', String(config.port),
    '--ctx-size', String(config.contextSize),
    '--parallel', String(config.parallelSlots),
    ...(config.extraArgs ?? []),
  ];
}

async function waitForHealthy({ probe, timeoutMs = 60000, intervalMs = 500 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await probe();
    if (status.healthy) return status;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('llama-server werd niet tijdig gezond');
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null) return Promise.resolve(true);
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once('exit', () => { clearTimeout(timer); resolve(true); });
  });
}

// ─── Recovery tracker ─────────────────────────────────────────────

class RecoveryTracker {
  constructor({ initialDelayMs = 2000, maximumDelayMs = 60000, maximumRestartsPerHour = 10 } = {}) {
    this.initialDelayMs = initialDelayMs;
    this.maximumDelayMs = maximumDelayMs;
    this.maximumRestartsPerHour = maximumRestartsPerHour;
    this.timestamps = [];
  }
  canRecover() {
    const oneHourAgo = Date.now() - 3600000;
    this.timestamps = this.timestamps.filter(t => t > oneHourAgo);
    return this.timestamps.length < this.maximumRestartsPerHour;
  }
  recordRestart() { this.timestamps.push(Date.now()); }
  getDelayMs() {
    const count = this.timestamps.length;
    return Math.min(this.initialDelayMs * Math.pow(2, count), this.maximumDelayMs);
  }
}

// ─── Supervisor ───────────────────────────────────────────────────

class LlamaSupervisor extends EventEmitter {
  constructor(config) {
    super();
    this._config = config;
    this._child = null;
    this._state = 'unknown';
    this._startedAt = null;
    this._lastExit = null;
    this._logs = [];
    this._op = Promise.resolve();
    this._recovery = config.recovery ? new RecoveryTracker(config.recovery) : null;
  }

  get snapshot() {
    return {
      state: this._state,
      pid: this._child?.pid ?? null,
      startedAt: this._startedAt,
      lastExit: this._lastExit,
      host: this._config.host,
      port: this._config.port,
      model: this._config.model,
      contextSize: this._config.contextSize,
      parallelSlots: this._config.parallelSlots,
      managedByGateway: this._child !== null,
      logs: this._logs.slice(-100),
    };
  }

  async inspect() {
    const portOpen = await probePort(this._config);
    const health = portOpen
      ? await probeLlamaHealth(this._config)
      : { ready: false, healthy: false, endpoints: [], optionalFeatures: [], errors: [], reason: 'port-closed' };

    if (health.ready) {
      this._setState('running');
    } else if (portOpen) {
      this._setState('foreign-or-unhealthy');
    } else if (this._child) {
      this._setState('starting');
    } else {
      this._setState('stopped');
    }
    return { ...this.snapshot, portOpen, health };
  }

  start() { return this._seq(() => this._start()); }
  stop() { return this._seq(() => this._stop()); }
  restart() { return this._seq(async () => { await this._stop(); return this._start(); }); }

  async ensureRunning() {
    return this._seq(async () => {
      const status = await this.inspect();
      if (status.health.healthy) return status;
      if (status.portOpen) {
        throw new Error(`Poort ${this._config.port} is bezet door een onbekende of ongezonde service`);
      }
      await this._start();
      return this.inspect();
    });
  }

  async _start() {
    const current = await this.inspect();
    if (current.health.healthy) return current;
    if (current.portOpen) {
      throw new Error(`Kan llama niet starten: poort ${this._config.port} is bezet`);
    }

    // Recovery check
    if (this._recovery && !this._recovery.canRecover()) {
      throw new Error(`Recovery limit bereikt (${this._recovery.maximumRestartsPerHour}/uur). Handmatige interventie nodig.`);
    }

    this._setState('starting');
    const args = buildLlamaArgs(this._config);

    const child = spawn(this._config.executable, args, {
      cwd: this._config.cwd,
      env: { ...process.env, ...this._config.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    this._child = child;
    this._startedAt = Date.now();

    child.stdout.on('data', d => this._appendLog('stdout', d));
    child.stderr.on('data', d => this._appendLog('stderr', d));
    child.once('error', e => { this._appendLog('error', e.message); this._setState('failed'); });
    child.once('exit', (code, signal) => {
      this._lastExit = { code, signal, timestamp: Date.now() };
      this._child = null;
      this._setState(code === 0 ? 'stopped' : 'failed');
    });

    await waitForHealthy({
      probe: () => probeLlamaHttp(this._config),
      timeoutMs: 60000,
      intervalMs: 500,
    });

    if (this._recovery) this._recovery.recordRestart();
    this._setState('running');
    return this.inspect();
  }

  async _stop() {
    if (!this._child) {
      const status = await this.inspect();
      if (status.health.healthy) {
        throw new Error('Llama draait buiten de gateway; de gateway weigert een onbekend proces te stoppen');
      }
      this._setState('stopped');
      return status;
    }

    this._setState('stopping');
    const child = this._child;
    child.kill('SIGTERM');

    const stopped = await waitForExit(child, 15000);
    if (!stopped && this._child === child) {
      child.kill('SIGKILL');
      await waitForExit(child, 2000);
    }

    return this.inspect();
  }

  getLogs(lines = 100) { return this._logs.slice(-lines); }

  _seq(op) {
    const next = this._op.then(op, op);
    this._op = next.catch(() => {});
    return next;
  }

  _appendLog(stream, value) {
    const lines = String(value).split(/\r?\n/u).filter(Boolean);
    for (const line of lines) {
      this._logs.push({ timestamp: Date.now(), stream, line });
      if (this._logs.length > 1000) this._logs.splice(0, this._logs.length - 1000);
    }
    this.emit('log', this._logs.at(-1));
  }

  _setState(state) {
    if (this._state === state) return;
    this._state = state;
    this.emit('status', this.snapshot);
  }
}

module.exports = { LlamaSupervisor, probePort, probeLlamaHttp, probeLlamaHealth, classifyLlamaEndpoint };
