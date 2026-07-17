// @addr 10.05.6.0 | fd00:npr:0005:006::0 — Route Controller
// ═══════════════════════════════════════════════════
// Per-session route lifecycle: Start → Stop.
// AbortController per route, busy-status state machine.
// ═══════════════════════════════════════════════════

const SLOT_COUNT = 0x40;
const PHASE_SIZE = 0x10;

function toHex(n) {
  if (typeof n !== 'number') return '0x00';
  return '0x' + Math.abs(Math.floor(n)).toString(16).toUpperCase().padStart(2, '0');
}

const STATUSES = Object.freeze([
  'idle',
  'queued',
  'waiting_for_slot',
  'generating',
  'validating',
  'returning',
  'cancelled',
]);

// @addr 10.05.6.1 — RouteEntry
class RouteEntry {
  constructor(sessionId, routeHex) {
    this.sessionId = sessionId;
    this.routeHex = routeHex;
    this.status = 'idle';
    this.controller = new AbortController();
    this.createdAt = Date.now();
    this.updatedAt = Date.now();
  }

  setStatus(status) {
    if (!STATUSES.includes(status)) throw new Error(`Invalid status: ${status}`);
    this.status = status;
    this.updatedAt = Date.now();
  }

  cancel() {
    this.controller.abort();
    this.setStatus('cancelled');
    return true;
  }
}

// @addr 10.05.6.2 — RouteController
class RouteController {
  constructor({ scheduler, slotMonitor }) {
    this.scheduler = scheduler;
    this.slotMonitor = slotMonitor;
    this.routes = new Map(); // sessionId → RouteEntry
  }

  // START — enqueue new request
  async start(sessionId, messages, routeHex) {
    // Cancel existing route if active
    const existing = this.routes.get(sessionId);
    if (existing && existing.status !== 'idle' && existing.status !== 'cancelled') {
      existing.cancel();
    }

    const entry = new RouteEntry(sessionId, routeHex);
    entry.setStatus('queued');
    this.routes.set(sessionId, entry);

    try {
      const result = await this.scheduler.enqueue({
        sessionId,
        messages,
        signal: entry.controller.signal,
        routeHex,
      });

      if (entry.status === 'cancelled') {
        return { status: 'cancelled', route_hex: routeHex };
      }

      entry.setStatus('generating');
      return result;
    } catch (err) {
      if (err.name === 'AbortError') {
        entry.setStatus('cancelled');
        return { status: 'cancelled', route_hex: routeHex };
      }
      entry.setStatus('idle');
      throw err;
    }
  }

  // STOP — abort current route
  stop(sessionId) {
    const entry = this.routes.get(sessionId);
    if (!entry) return false;
    return entry.cancel();
  }

  // Get route status
  getStatus(sessionId) {
    const entry = this.routes.get(sessionId);
    if (!entry) return null;

    return {
      session_id: entry.sessionId,
      route_hex: entry.routeHex,
      status: entry.status,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
      queue_position: this.scheduler.queue?.position(sessionId) ?? null,
    };
  }

  // Get all active routes
  getActiveRoutes() {
    const result = [];
    for (const [id, entry] of this.routes) {
      if (entry.status !== 'idle' && entry.status !== 'cancelled') {
        result.push(this.getStatus(id));
      }
    }
    return result;
  }
}

module.exports = { STATUSES, RouteEntry, RouteController };
