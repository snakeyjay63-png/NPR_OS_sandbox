// @net 10.00.0.0/24
// gateway.js — NPR Gateway Router
//
// De centrale router van het NPR-netwerk
// Routing: incoming → DNS lookup → proxy → service
//
// Ook: /dns endpoint voor name resolution
//      /registry endpoint voor service discovery
//      /net endpoint voor network topology

const http = require('http');
const registry = require('./registry');
const dns = require('./dns');

class NPRGateway {
  constructor(opts = {}) {
    this.port = opts.port || 5000;
    this.server = null;
    this.localHandlers = new Map(); // routes that stay in gateway
    this.proxyTimeout = opts.proxyTimeout || 30000;
  }

  // ─── Lokale handlers (blijven in gateway, geen proxy) ───

  handle(method, path, handler) {
    this.localHandlers.set(`${method}:${path}`, handler);
    return this;
  }

  get(path, handler) { return this.handle('GET', path, handler); }
  post(path, handler) { return this.handle('POST', path, handler); }

  // ─── Proxy helper ───

  async proxyRequest(req, res, targetPort, targetPath) {
    return new Promise((resolve) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const options = {
        hostname: '127.0.0.1',
        port: targetPort,
        path: targetPath || url.pathname + url.search,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${targetPort}` },
        timeout: this.proxyTimeout,
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: false });
        proxyRes.on('end', () => resolve());
      });

      proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'proxy error',
          target: `127.0.0.1:${targetPort}`,
          message: err.message,
        }));
        resolve();
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'gateway timeout', port: targetPort }));
        resolve();
      });

      req.pipe(proxyReq);
    });
  }

  // ─── Route resolution ───

  resolveRoute(method, path) {
    // 1. Check local handlers
    const localKey = `${method}:${path}`;
    const localHandler = this.localHandlers.get(localKey);
    if (localHandler) return { type: 'local', handler: localHandler };

    // 2. Check registry for matching service
    const serviceName = this.pathToServiceName(path);
    if (serviceName) {
      const svc = registry.get(serviceName);
      if (svc) return { type: 'proxy', port: svc.port, name: serviceName, path };
    }

    // 3. DNS fallback — any name resolves to a port
    const name = path.replace(/^\/(tool|service|net)\//, '');
    if (name) {
      const resolved = dns.resolve(name);
      return { type: 'proxy', port: resolved.port, name, path, dns: true };
    }

    return null;
  }

  pathToServiceName(path) {
    // /tool/echo → echo
    // /service/chat → chat
    // /net/dns → dns
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return parts[1]; // second segment = service name
    }
    return null;
  }

  // ─── DNS endpoint ───

  handleDNS(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const name = url.searchParams.get('name') || url.pathname.replace(/^\/dns(\/|$)/, '');

    if (!name || name === '') {
      // Show full DNS table
      const table = [];
      for (const svc of registry.list()) {
        table.push({
          name: svc.name,
          slot: svc.slot,
          ip: svc.ip,
          port: svc.port,
          capabilities: svc.capabilities,
          status: svc.status,
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ dns: table }, null, 2));
      return;
    }

    const resolved = dns.resolve(name);
    const svc = registry.get(name);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name,
      dns: resolved,
      service: svc || null,
    }, null, 2));
  }

  // ─── Registry endpoint ───

  handleRegistry(req, res) {
    registry.checkHealth();
    const services = registry.list().map(s => ({
      name: s.name,
      slot: s.slot,
      ip: s.ip,
      port: s.port,
      capabilities: s.capabilities,
      description: s.description,
      status: s.status,
      heartbeat: s.heartbeat,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ services }, null, 2));
  }

  // ─── Network topology ───

  handleNet(req, res) {
    const topology = {
      gateway: { port: this.port, handlers: Array.from(this.localHandlers.keys()) },
      services: registry.list().map(s => ({
        name: s.name,
        slot: s.slot,
        ip: s.ip,
        port: s.port,
        capabilities: s.capabilities,
      })),
      dns: dns.list(),
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(topology, null, 2));
  }

  // ─── Create HTTP server ───

  createServer() {
    return http.createServer(async (req, res) => {
      const method = req.method;
      const path = req.url.split('?')[0];

      try {
        // DNS endpoint
        if (path.startsWith('/dns')) {
          return this.handleDNS(req, res);
        }

        // Registry endpoint
        if (path.startsWith('/registry')) {
          return this.handleRegistry(req, res);
        }

        // Network topology
        if (path.startsWith('/net')) {
          return this.handleNet(req, res);
        }

        // Resolve route
        const route = this.resolveRoute(method, path);

        if (route) {
          if (route.type === 'local') {
            return route.handler(req, res);
          } else if (route.type === 'proxy') {
            return this.proxyRequest(req, res, route.port, route.path);
          }
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'not found',
          path,
          hint: 'try /dns, /registry, or /net for discovery',
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'gateway error', message: err.message }));
      }
    });
  }

  // ─── Start ───

  async start() {
    this.server = this.createServer();
    await new Promise((resolve, reject) => {
      this.server.listen(this.port, '0.0.0.0', resolve);
      this.server.on('error', reject);
    });
    return this;
  }

  stop() {
    if (this.server) this.server.close();
  }
}

module.exports = { NPRGateway };
