// @addr 10.0.0.1 | fd00:npr:0000:000::1
// ═══════════════════════════════════════════
// NPR-Local Gateway — Blijvende Grondlaag
// ═══════════════════════════════════════════
//
// Gateway lifetime > session lifetime > turn lifetime > tool-call lifetime
//
// Noise:  processen starten, stoppen, falen
// Pattern: gateway organiseert toestand en afhankelijkheden
// Return: iedere gebeurtenis vastgelegd, gevalideerd, opnieuw beschikbaar

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const { GatewaySupervisor, GATEWAY_STATES } = require('./supervisor.cjs');
const { EventBus, EventRegistry } = require('./eventbus.cjs');
const { RuntimeMonitor } = require('../runtime/monitor.cjs');
const { LlamaSupervisor } = require('../runtime/llama-supervisor.cjs');
const llamaConfig = require('../../config/llama-runtime.js');

// ─── Gateway ───

class NPRGateway {
  constructor(opts = {}) {
    this._supervisor = new GatewaySupervisor(opts);
    this._eventBus = new EventBus(opts);
    this._eventRegistry = new EventRegistry(opts);
    this._runtimeMonitor = new RuntimeMonitor();
    this._llamaSupervisor = new LlamaSupervisor(llamaConfig);
    this._server = null;
    this._port = opts.port ?? 5017;
    this._hostname = opts.hostname ?? '0.0.0.0';
    this._dataDir = opts.dataDir ?? path.join(__dirname, '..', '..', 'data');
    this._started = false;

    // Wire event bus to supervisor
    this._supervisor.setEventBus(this._eventBus);

    // Bridge events to registry + runtime monitor
    this._eventBus.on('*', (event) => {
      this._eventRegistry.store(event);
      // Mirror to runtime monitor for SSE
      this._runtimeMonitor.emit(event.type, event.payload);
    });
  }

  // ─── Component Registration ───

  register(name, component, opts = {}) {
    this._supervisor.register(name, component, opts);
    return this;
  }

  // ─── Lifecycle ───

  async start() {
    if (this._started) throw new Error('Gateway already started');

    console.log(`[Gateway] Starting on ${this._hostname}:${this._port}`);

    // Ensure data directory
    if (!fs.existsSync(this._dataDir)) {
      fs.mkdirSync(this._dataDir, { recursive: true });
    }

    // Register default components if not already registered
    this._registerDefaults();

    // Start supervisor
    const state = await this._supervisor.start();
    if (state === 'recovering') {
      console.warn('[Gateway] Started in recovering state');
    } else if (state === 'degraded') {
      console.warn('[Gateway] Started in degraded state');
    }

    // Start HTTP server
    await this._startHTTP();

    this._started = true;
    this._eventBus.emit('gateway_started', { port: this._port, state });
    console.log(`[Gateway] ${state} — listening on ${this._port}`);
    return this;
  }

  async stop() {
    if (!this._started) return;

    this._eventBus.emit('gateway_stopping');

    // Close HTTP server
    if (this._server) {
      await new Promise(resolve => this._server.close(resolve));
      this._server = null;
    }

    // Stop supervisor
    await this._supervisor.stop(true);

    this._started = false;
    this._eventBus.emit('gateway_stopped');
    console.log('[Gateway] Stopped');
  }

  _registerDefaults() {
    // Event bus is always ready (it's us)
    // Runtime monitor is always ready
    // These are core and don't need explicit registration

    // Register LlamaSupervisor as managed component
    this._supervisor.register('llama', this._llamaSupervisor, {
      tier: 1,          // Start early — inference is a dependency
      healthcheck: async () => {
        const s = await this._llamaSupervisor.inspect();
        return { healthy: s.health.ready, state: s.health };
      },
      start: async () => {
        const policy = llamaConfig.startPolicy;
        if (policy === 'on-gateway-start') {
          await this._llamaSupervisor.ensureRunning();
        }
        // 'manual' and 'on-first-request' are lazy — start on demand
      },
      stop: async () => {
        if (llamaConfig.startPolicy !== 'manual') {
          await this._llamaSupervisor.stop();
        }
      },
      snapshot: () => this._llamaSupervisor.snapshot,
    });

    // Check for optional components that should be registered
    if (!this._supervisor._components.has('tool00')) {
      // Tool-00 is critical but may be loaded later
      // Register placeholder
    }
  }

  async _startHTTP() {
    const self = this;
    this._server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const pathname = url.pathname;

      // CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // ─── Gateway Routes ───

      if (pathname === '/api/gateway/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          state: self._supervisor.state,
          port: self._port,
          started: self._started,
          timestamp: Date.now(),
        }, null, 2));
        return;
      }

      if (pathname === '/api/gateway/snapshot') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(self._supervisor.snapshot(), null, 2));
        return;
      }

      if (pathname === '/api/gateway/restart' && req.method === 'POST') {
        const body = JSON.parse(Buffer.from(req.body).toString());
        if (!body.component) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'component required' }));
          return;
        }
        try {
          await self._supervisor.restart(body.component);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, state: self._supervisor.state }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
        return;
      }

      // ─── Runtime Routes ───

      if (pathname === '/api/runtime/stream') {
        self._eventBus.createSSEStream(res);
        return;
      }

      if (pathname === '/api/runtime/snapshot') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(self._runtimeMonitor.snapshot(), null, 2));
        return;
      }

      if (pathname === '/api/runtime/sessions') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(self._runtimeMonitor.listSessions(), null, 2));
        return;
      }

      if (pathname === '/api/runtime/slots') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(self._runtimeMonitor.listSlots(), null, 2));
        return;
      }

      if (pathname === '/api/runtime/events') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(self._runtimeMonitor.getRecentEvents(50), null, 2));
        return;
      }

      // ─── Health ───

      if (pathname === '/health' || pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          state: self._supervisor.state,
          ready: self._supervisor.canAcceptTurns(),
          components: self._supervisor.snapshot().components.length,
          llama: {
            state: self._llamaSupervisor._state,
            pid: self._llamaSupervisor._child?.pid ?? null,
          },
          timestamp: Date.now(),
        }));
        return;
      }

      // ─── Static Dashboard ───

      if (pathname === '/dashboard' || pathname === '/dashboard.html') {
        const dashboardPath = path.join(__dirname, '..', '..', 'dashboard', 'index.html');
        if (fs.existsSync(dashboardPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          fs.createReadStream(dashboardPath).pipe(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Dashboard not found' }));
        }
        return;
      }

      // ─── Llama Control Routes ───

      if (pathname.startsWith('/api/llama/')) {
        self._handleLlamaRoute(req, res, pathname, url);
        return;
      }

      // ─── Fallback ───

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Not found',
        path: pathname,
        gateway: self._supervisor.state,
        available: [
          '/health',
          '/api/gateway/status',
          '/api/gateway/snapshot',
          '/api/runtime/stream',
          '/api/runtime/snapshot',
          '/api/runtime/sessions',
          '/api/runtime/slots',
          '/api/runtime/events',
          '/api/llama/status',
          '/api/llama/config',
          '/api/llama/stream',
          '/dashboard',
        ],
      }));
    });

    await new Promise((resolve, reject) => {
      this._server.once('error', reject);
      this._server.listen(this._port, this._hostname, resolve);
    });
  }

  // ─── Llama Route Handler ───

  async _handleLlamaRoute(req, res, pathname, url) {
    const self = this;
    const sup = this._llamaSupervisor;

    try {
      // GET /api/llama/status
      if (pathname === '/api/llama/status' && req.method === 'GET') {
        const status = await sup.inspect();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
        return;
      }

      // POST /api/llama/start
      if (pathname === '/api/llama/start' && req.method === 'POST') {
        this._requireAdmin(req);
        const status = await sup.start();
        this._eventBus.emit('llama_started', { pid: sup._child?.pid });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
        return;
      }

      // POST /api/llama/stop
      if (pathname === '/api/llama/stop' && req.method === 'POST') {
        this._requireAdmin(req);
        const status = await sup.stop();
        this._eventBus.emit('llama_stopped', {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
        return;
      }

      // POST /api/llama/restart
      if (pathname === '/api/llama/restart' && req.method === 'POST') {
        this._requireAdmin(req);
        const status = await sup.restart();
        this._eventBus.emit('llama_restarted', { pid: sup._child?.pid });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(status, null, 2));
        return;
      }

      // GET /api/llama/logs
      if (pathname === '/api/llama/logs' && req.method === 'GET') {
        const lines = parseInt(url.searchParams.get('lines'), 10) || 100;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ logs: sup.getLogs(lines) }));
        return;
      }

      // GET /api/llama/config
      if (pathname === '/api/llama/config' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          host: llamaConfig.host,
          port: llamaConfig.port,
          model: llamaConfig.model,
          contextSize: llamaConfig.contextSize,
          parallelSlots: llamaConfig.parallelSlots,
          startPolicy: llamaConfig.startPolicy,
          recovery: llamaConfig.recovery,
          extraArgs: llamaConfig.extraArgs,
        }));
        return;
      }

      // GET /api/llama/stream — SSE
      if (pathname === '/api/llama/stream' && req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write('event: connected\ndata: {"ok":true}\n\n');

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
        return;
      }

      // Unknown llama route
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unknown llama route', available: [
        'GET /api/llama/status',
        'POST /api/llama/start',
        'POST /api/llama/stop',
        'POST /api/llama/restart',
        'GET /api/llama/logs',
        'GET /api/llama/config',
        'GET /api/llama/stream',
      ]}));
    } catch (err) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }

  _requireAdmin(req) {
    const token = req.headers['x-gateway-admin'];
    const adminToken = process.env.GATEWAY_ADMIN_TOKEN;
    if (!adminToken && req.ip !== '::1' && req.ip !== '127.0.0.1') {
      throw new Error('Admin access denied — bind to localhost or set GATEWAY_ADMIN_TOKEN');
    }
    if (adminToken && token !== adminToken) {
      throw new Error('Invalid admin token');
    }
  }

  // ─── Accessors ───

  get state() { return this._supervisor.state; }
  get eventBus() { return this._eventBus; }
  get runtimeMonitor() { return this._runtimeMonitor; }
  get supervisor() { return this._supervisor; }
  get llamaSupervisor() { return this._llamaSupervisor; }

  isReady() {
    return this._started && this._supervisor.state === 'ready';
  }

  canAcceptTurns() {
    return this._started && this._supervisor.canAcceptTurns();
  }
}

// ─── Factory ───

function createGateway(opts = {}) {
  return new NPRGateway(opts);
}

// ─── CLI Entry ───

if (require.main === module) {
  const gateway = createGateway({
    port: parseInt(process.env.GATEWAY_PORT || '5017', 10),
    hostname: process.env.GATEWAY_HOST || '0.0.0.0',
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[Gateway] SIGTERM received, draining...');
    await gateway.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[Gateway] SIGINT received, stopping...');
    await gateway.stop();
    process.exit(0);
  });

  gateway.start().catch(err => {
    console.error('[Gateway] Fatal:', err);
    process.exit(1);
  });
}

module.exports = { NPRGateway, createGateway, GATEWAY_STATES };
