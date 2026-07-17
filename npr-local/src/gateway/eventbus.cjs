// @addr 10.1.0.0 | fd00:npr:0000:001::0
// ═══════════════════════════════════════════
// Event Bus — Gateway Internal Messaging
// ═══════════════════════════════════════════
//
// Gateway → eventbus → SSE → UI
// Niet: UI open → gateway bestaat

const EventEmitter = require('node:events');

// ─── Event Bus ───

class EventBus extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.setMaxListeners(opts.maxListeners ?? 50);
    this._history = [];
    this._maxHistory = opts.maxHistory ?? 1000;
    this._filters = new Map();
  }

  emit(type, payload = {}) {
    const event = {
      type,
      timestamp: Date.now(),
      payload,
    };

    // Store in history
    this._history.push(event);
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    // Apply filters before emitting
    const filtered = this._applyFilters(event);
    if (!filtered) return true;

    return super.emit(type, event);
  }

  _applyFilters(event) {
    if (!this._filters.has(event.type)) return true;

    for (const filter of this._filters.get(event.type)) {
      if (!filter(event)) return false;
    }
    return true;
  }

  addFilter(type, fn) {
    if (!this._filters.has(type)) {
      this._filters.set(type, []);
    }
    this._filters.get(type).push(fn);
  }

  getHistory(limit = 100) {
    return this._history.slice(-limit);
  }

  // ─── SSE Stream ───

  createSSEStream(res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Send initial history
    for (const event of this.getHistory(50)) {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
    }
    res.write('event: connected\ndata: {}\n\n');

    // Subscribe to new events
    const handler = (event) => {
      try {
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`);
      } catch (e) {
        // Client disconnected
      }
    };

    this.on('*', handler);

    const cleanup = () => {
      this.removeListener('*', handler);
    };

    res.on('close', cleanup);
    return cleanup;
  }

  // ─── WebSocket Bridge ───

  createWebSocketBridge(ws) {
    const handler = (event) => {
      try {
        ws.send(JSON.stringify(event));
      } catch (e) {
        // WS disconnected
      }
    };

    this.on('*', handler);

    const cleanup = () => {
      this.removeListener('*', handler);
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);

    return cleanup;
  }
}

// ─── Event Registry (persistent subset) ───

class EventRegistry {
  constructor(opts = {}) {
    this._storage = opts.storage ?? new Map();
    this._maxEvents = opts.maxEvents ?? 5000;
    this._categories = new Set([
      'gateway',
      'session',
      'context',
      'inference',
      'tool',
      'validation',
      'error',
    ]);
  }

  store(event) {
    const key = `${event.timestamp}-${Math.random().toString(36).slice(2, 8)}`;
    this._storage.set(key, {
      id: key,
      type: event.type,
      timestamp: event.timestamp,
      category: this._categorize(event.type),
      payload: event.payload,
    });

    // Trim if too large
    if (this._storage.size > this._maxEvents) {
      const keys = [...this._storage.keys()];
      keys.slice(0, keys.length - this._maxEvents).forEach(k => this._storage.delete(k));
    }
  }

  _categorize(type) {
    if (type.startsWith('gateway')) return 'gateway';
    if (type.startsWith('session') || type.startsWith('turn')) return 'session';
    if (type.startsWith('context')) return 'context';
    if (type.startsWith('llama')) return 'inference';
    if (type.startsWith('tool')) return 'tool';
    if (type.startsWith('validation')) return 'validation';
    if (type.includes('fail') || type.includes('error')) return 'error';
    return 'gateway';
  }

  query(opts = {}) {
    let events = [...this._storage.values()];

    if (opts.category) {
      events = events.filter(e => e.category === opts.category);
    }
    if (opts.type) {
      events = events.filter(e => e.type === opts.type);
    }
    if (opts.from) {
      events = events.filter(e => e.timestamp >= opts.from);
    }
    if (opts.to) {
      events = events.filter(e => e.timestamp <= opts.to);
    }
    if (opts.limit) {
      events = events.slice(-opts.limit);
    }

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  snapshot() {
    return {
      totalEvents: this._storage.size,
      categories: this._categorizeStats(),
    };
  }

  _categorizeStats() {
    const stats = {};
    for (const e of this._storage.values()) {
      stats[e.category] = (stats[e.category] || 0) + 1;
    }
    return stats;
  }
}

module.exports = { EventBus, EventRegistry };
