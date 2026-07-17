// @addr 10.05.7.0 | fd00:npr:0005:007::0 — Context Meter
// ═══════════════════════════════════════════════════
// Tracks token consumption per session and per slot.
// Reports percentage (decimal — human metric, not routing).
// ═══════════════════════════════════════════════════

const SLOT_COUNT = 0x40;
const PHASE_SIZE = 0x10;

function toHex(n) {
  if (typeof n !== 'number') return '0x0000';
  return '0x' + Math.abs(Math.floor(n)).toString(16).toUpperCase();
}

// @addr 10.05.7.1 — ContextState
const CONTEXT_STATES = Object.freeze({
  SAFE: 'safe',        // < 60%
  WARNING: 'warning',  // 60-80%
  CRITICAL: 'critical', // 80-95%
  EXHAUSTED: 'exhausted', // > 95%
});

// @addr 10.05.7.2 — ContextMeter
class ContextMeter {
  /**
   * @param {{defaultCapacityTokens?: number}} opts
   */
  constructor({ defaultCapacityTokens = 0x1000 } = {}) { // 4096
    this.defaultCapacityTokens = defaultCapacityTokens;
    this.sessions = new Map(); // sessionId → { used, capacity }
    this.slots = new Map();    // slotId → { used, capacity }
  }

  // Track tokens for a session
  track(sessionId, tokenCount, capacity) {
    const entry = this.sessions.get(sessionId) ?? {
      used: 0,
      capacity: capacity ?? this.defaultCapacityTokens,
    };
    entry.used += tokenCount;
    this.sessions.set(sessionId, entry);
    return this.getSessionStatus(sessionId);
  }

  // Track tokens for a slot
  trackSlot(slotId, tokenCount, capacity) {
    const entry = this.slots.get(slotId) ?? {
      used: 0,
      capacity: capacity ?? this.defaultCapacityTokens,
    };
    entry.used += tokenCount;
    this.slots.set(slotId, entry);
    return this.getSlotStatus(slotId);
  }

  // Reset a session's counter
  resetSession(sessionId) {
    this.sessions.set(sessionId, { used: 0, capacity: this.defaultCapacityTokens });
  }

  // Reset a slot's counter
  resetSlot(slotId) {
    this.slots.set(slotId, { used: 0, capacity: this.defaultCapacityTokens });
  }

  // Get session context status
  getSessionStatus(sessionId) {
    const entry = this.sessions.get(sessionId);
    if (!entry) return null;
    return this._compute(entry);
  }

  // Get slot context status
  getSlotStatus(slotId) {
    const entry = this.slots.get(slotId);
    if (!entry) return null;
    return this._compute(entry);
  }

  // Compute percentage and state
  _compute({ used, capacity }) {
    const percent = Math.round((used / capacity) * 100);
    let state;
    if (percent < 60) state = CONTEXT_STATES.SAFE;
    else if (percent < 80) state = CONTEXT_STATES.WARNING;
    else if (percent < 95) state = CONTEXT_STATES.CRITICAL;
    else state = CONTEXT_STATES.EXHAUSTED;

    return {
      used_tokens: used,
      used_tokens_hex: toHex(used),
      capacity_tokens: capacity,
      capacity_tokens_hex: toHex(capacity),
      context_percent: percent,
      context_state: state,
    };
  }

  // Global overview
  getOverview() {
    return {
      active_sessions: this.sessions.size,
      active_slots: this.slots.size,
      sessions: Array.from(this.sessions.entries()).map(([id, e]) => ({
        session_id: id,
        ...this._compute(e),
      })),
      slots: Array.from(this.slots.entries()).map(([id, e]) => ({
        slot_id: id,
        ...this._compute(e),
      })),
    };
  }
}

module.exports = { CONTEXT_STATES, ContextMeter };
