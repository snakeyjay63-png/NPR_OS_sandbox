// @net 10.07.0.0/24
// ═══════════════════════════════════════════════════
// runtime-monitor.cjs — Live runtime event bus
// ═══════════════════════════════════════════════════
// Pub/sub for agent chat, tool calls, memory, model switch, queue, plc…
// SSE stream + REST snapshot via routes/runtime-events.js
// ═══════════════════════════════════════════════════

const EventEmitter = require('events');

class RuntimeMonitor extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
    this._sessions = new Map();
    this._history = [];
    this._maxEvents = 200;
    this._startTime = Date.now();
  }

  // ─── Core: publish event and broadcast to subscribers ───
  publish(event, data) {
    const entry = {
      ts: new Date().toISOString(),
      event,
      ...data,
    };
    // Keep circular refs out of snapshot
    try {
      JSON.stringify(entry);
    } catch {
      // Strip non-serializable
      entry._ = '[non-serializable data removed]';
      if (data && typeof data === 'object') {
        for (const [k, v] of Object.entries(data)) {
          if (typeof v === 'function' || typeof v === 'symbol') {
            delete entry[k];
          }
        }
      }
    }
    this._history.unshift(entry);
    if (this._history.length > this._maxEvents) {
      this._history.length = this._maxEvents;
    }
    // Use EventEmitter.prototype.emit directly to avoid subclass recursion
    EventEmitter.prototype.emit.call(this, 'event', entry);
    return true;
  }

  // ─── Session tracking ───
  trackSession(id, info) {
    this._sessions.set(id, { ...info, ts: new Date().toISOString() });
    this.emit('session:track', { id, info });
  }

  untrackSession(id) {
    this._sessions.delete(id);
    this.emit('session:untrack', { id });
  }

  // ─── Snapshot ───
  snapshot() {
    return {
      uptime: Date.now() - this._startTime,
      uptimePretty: this.uptimeString(),
      sessions: this.sessionCount(),
      events: this._history.length,
      ts: new Date().toISOString(),
    };
  }

  // ─── REST helpers ───
  listSessions() {
    const arr = [];
    for (const [id, info] of this._sessions) {
      arr.push({ id, ...info });
    }
    return arr;
  }

  listSlots() {
    // Import manifest on-demand to avoid circular
    try {
      const { manifest } = require('./routes/core');
      return manifest();
    } catch {
      return [];
    }
  }

  getRecentEvents(n = 50) {
    return this._history.slice(0, n);
  }

  sessionCount() {
    return this._sessions.size;
  }

  uptimeString() {
    const ms = Date.now() - this._startTime;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  }

  // ─── Subscribe (SSE-compatible) ───
  subscribe(fn) {
    EventEmitter.prototype.on.call(this, 'event', fn);
    return () => {
      EventEmitter.prototype.off.call(this, 'event', fn);
    };
  }
}

module.exports = RuntimeMonitor;
