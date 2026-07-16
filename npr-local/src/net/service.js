// @net 10.00.3.0/24
// service.js — NPR Service Base
//
// Elke service = een HTTP server op eigen port
// Registreert zichzelf bij registry
// Exposeert /_status endpoint

const http = require('http');
const dns = require('./dns');
const registry = require('./registry');

class NPRService {
  constructor(name, opts = {}) {
    this.name = name;
    this.resolved = dns.register(name);
    this.slot = this.resolved.slot;
    this.port = this.resolved.port;
    this.capabilities = opts.capabilities || [];
    this.description = opts.description || '';
    this.handlers = new Map();
    this.server = null;
    this.heartbeatInterval = null;
  }

  // ─── Route registration ───

  on(method, path, handler) {
    const key = `${method.toUpperCase()}:${path}`;
    this.handlers.set(key, handler);
    // Also register exact matches
    return this;
  }

  get(path, handler) { return this.on('GET', path, handler); }
  post(path, handler) { return this.on('POST', path, handler); }
  put(path, handler) { return this.on('PUT', path, handler); }
  del(path, handler) { return this.on('DELETE', path, handler); }

  // ─── HTTP server ───

  createServer() {
    return http.createServer((req, res) => {
      const method = req.method;
      const path = req.url.split('?')[0];

      // Built-in status
      if (path === '/_status') {
        return this.handleStatus(req, res);
      }

      // Try exact match
      const exactKey = `${method}:${path}`;
      const handler = this.handlers.get(exactKey);

      if (handler) {
        return handler.call(this, req, res);
      }

      // Try prefix match
      for (const [key, h] of this.handlers) {
        const [hMethod, hPath] = key.split(':');
        if (hMethod === method && path.startsWith(hPath)) {
          return h.call(this, req, res);
        }
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'not found',
        method,
        path,
        available: Array.from(this.handlers.keys()),
      }));
    });
  }

  // ─── Start ───

  async start() {
    this.server = this.createServer();
    await new Promise((resolve, reject) => {
      this.server.listen(this.port, '127.0.0.1', resolve);
      this.server.on('error', reject);
    });

    // Register with registry
    registry.registerService(this.name, {
      capabilities: this.capabilities,
      description: this.description,
      meta: { slot: this.slot, port: this.port },
    });

    // Heartbeat every 10s
    this.heartbeatInterval = setInterval(() => {
      registry.heartbeat(this.name);
    }, 10000);

    return this.resolved;
  }

  // ─── Stop ───

  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.server) {
      this.server.close();
    }
  }

  // ─── Built-in /_status ───

  handleStatus(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: this.name,
      slot: this.slot,
      ip: this.resolved.ip,
      port: this.port,
      capabilities: this.capabilities,
      status: 'alive',
      uptime: Date.now() - (registry.get(this.name)?.registered || Date.now()),
      handlers: Array.from(this.handlers.keys()),
    }, null, 2));
  }

  // ─── Helpers ───

  json(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  text(res, text, status = 200) {
    res.writeHead(status, { 'Content-Type': 'text/plain' });
    res.end(text);
  }

  html(res, html, status = 200) {
    res.writeHead(status, { 'Content-Type': 'text/html' });
    res.end(html);
  }
}

module.exports = { NPRService };
