// @addr 10.14.0.0 | fd00:npr:000e:000::0
// ═════════════════════════════════════════════
// Runtime Monitor — Sessie + Slot + Event tracking
// ═════════════════════════════════════════════
//
// Live zichtbaarheid van:
// - Sessions (status, context, phase, tool, compaction)
// - Context blokken per domein (summary/recent/retrieval/return)
// - llama.cpp slots (inference workers)
// - Process states (routing → mount → generate → validate → commit)
// - Events (SSE-streambaar)

const { BLOCK_LAYOUT, BLOCK_COUNT, MAX_CONTEXT_TOKENS } = require('../field/context-64k.cjs');

// ─── Process States ───

const PROCESS_STATES = Object.freeze([
  'idle',
  'receiving',
  'routing',
  'mounting-context',
  'compacting',
  'queued',
  'prompt-processing',
  'generating',
  'tool-running',
  'validating',
  'committing',
  'streaming',
  'completed',
  'failed',
  'cancelled',
]);

const STATE_TRANSITIONS = Object.freeze({
  idle:            ['receiving'],
  receiving:       ['routing', 'cancelled'],
  routing:         ['mounting-context', 'compacting', 'cancelled'],
  'mounting-context': ['queued', 'failed'],
  compacting:      ['mounting-context', 'failed'],
  queued:          ['prompt-processing', 'cancelled'],
  'prompt-processing': ['generating', 'failed'],
  generating:      ['tool-running', 'streaming', 'failed'],
  'tool-running':  ['validating', 'failed'],
  validating:      ['committing', 'failed'],
  committing:      ['completed', 'failed'],
  streaming:       ['completed', 'failed'],
  completed:       ['idle'],
  failed:          ['idle', 'cancelled'],
  cancelled:       ['idle'],
});

// ─── Event Types ───

const EVENT_TYPES = Object.freeze([
  'session_created',
  'session_selected',
  'turn_started',
  'context_blocks_selected',
  'context_compaction_started',
  'context_compaction_completed',
  'llama_request_queued',
  'llama_slot_assigned',
  'llama_prompt_started',
  'llama_generation_started',
  'llama_token',
  'tool_started',
  'tool_completed',
  'tool00_validation_started',
  'tool00_validation_completed',
  'turn_committed',
  'turn_failed',
  'session_status_changed',
]);

// ─── Runtime Monitor ───

class RuntimeMonitor {
  constructor() {
    this._sessions = new Map();
    this._slots = new Map();
    this._events = [];
    this._maxEvents = 500;
    this._subscribers = [];
  }

  // ─── Session ───

  createSession(sessionId, opts = {}) {
    const session = {
      sessionId,
      status: 'idle',
      model: opts.model || 'llama-local',
      currentTurnId: null,
      context: null,
      activePhase: null,
      activeTool: null,
      compactionCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastActivity: null,
    };
    this._sessions.set(sessionId, session);
    this._emitInternal('session_created', { sessionId });
    return session;
  }

  updateSession(sessionId, patch) {
    const current = this._sessions.get(sessionId) ?? {
      sessionId,
      status: 'idle',
      context: null,
      currentTurnId: null,
    };

    const prevStatus = current.status;
    const next = {
      ...current,
      ...patch,
      updatedAt: Date.now(),
      lastActivity: Date.now(),
    };

    // Validate state transition
    if (patch.status && prevStatus !== patch.status) {
      const allowed = STATE_TRANSITIONS[prevStatus] || [];
      if (!allowed.includes(patch.status)) {
        console.warn(`[RuntimeMonitor] Invalid state transition: ${prevStatus} → ${patch.status} for ${sessionId}`);
      }
      this._emitInternal('session_status_changed', {
        sessionId,
        from: prevStatus,
        to: patch.status,
      });
    }

    this._sessions.set(sessionId, next);
    return next;
  }

  getSession(sessionId) {
    return this._sessions.get(sessionId) ?? null;
  }

  listSessions() {
    return [...this._sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // ─── Slot ───

  updateSlot(slotId, patch) {
    const current = this._slots.get(slotId) ?? {
      slotId,
      status: 'idle',
      sessionId: null,
      turnId: null,
    };
    const next = {
      ...current,
      ...patch,
      updatedAt: Date.now(),
    };
    this._slots.set(slotId, next);
    return next;
  }

  getSlot(slotId) {
    return this._slots.get(slotId) ?? null;
  }

  listSlots() {
    return [...this._slots.values()].sort((a, b) => a.slotId - b.slotId);
  }

  // ─── Events ───

  emit(type, payload = {}) {
    const event = {
      type,
      timestamp: Date.now(),
      ...payload,
    };
    this._events.push(event);
    if (this._events.length > this._maxEvents) {
      this._events.shift();
    }
    // Notify subscribers
    for (const sub of this._subscribers) {
      try { sub(event); } catch (e) { /* subscriber error */ }
    }
    return event;
  }

  _emitInternal(type, payload) {
    this.emit(type, payload);
  }

  subscribe(callback) {
    this._subscribers.push(callback);
    return () => {
      this._subscribers = this._subscribers.filter(s => s !== callback);
    };
  }

  getRecentEvents(limit = 50) {
    return this._events.slice(-limit);
  }

  // ─── Context ───

  summarizeContextBlocks(blocks) {
    const domains = { summary: 0, recent: 0, retrieval: 0, 'return': 0 };
    let usedTokens = 0;

    for (const block of blocks) {
      if (domains[block.domain] !== undefined) {
        domains[block.domain] += 1;
      }
      usedTokens += block.tokenCount;
    }

    return {
      blockSize: 1024,
      usedBlocks: blocks.length,
      maxBlocks: BLOCK_COUNT,
      usedTokens,
      maxTokens: MAX_CONTEXT_TOKENS,
      domains,
    };
  }

  // ─── Snapshot ───

  snapshot() {
    return {
      sessions: [...this._sessions.values()],
      slots: [...this._slots.values()],
      events: this.getRecentEvents(20),
      timestamp: Date.now(),
    };
  }
}

// ─── Turn Runner (integration helper) ───

async function runTurn(runtimeMonitor, session, input, { routeInput, contextHypervisor, generateWithLlama, tool00, transcript }) {
  const turnId = require('crypto').randomUUID();
  const { sessionId } = session;

  runtimeMonitor.updateSession(sessionId, { status: 'routing', currentTurnId: turnId });
  runtimeMonitor.emit('turn_started', { sessionId, turnId });

  try {
    // Route
    const route = await routeInput(input);
    runtimeMonitor.updateSession(sessionId, { status: 'mounting-context', activePhase: 'context' });

    // Mount blocks
    const blocks = contextHypervisor.select(route.blockAddresses);
    const ctxSummary = runtimeMonitor.summarizeContextBlocks(blocks);
    runtimeMonitor.updateSession(sessionId, { context: ctxSummary });
    runtimeMonitor.emit('context_blocks_selected', { sessionId, turnId, blockCount: blocks.length });

    // Queue + generate
    runtimeMonitor.updateSession(sessionId, { status: 'queued' });
    runtimeMonitor.emit('llama_request_queued', { sessionId, turnId });

    runtimeMonitor.updateSession(sessionId, { status: 'prompt-processing' });
    runtimeMonitor.emit('llama_prompt_started', { sessionId, turnId, contextTokens: ctxSummary.usedTokens });

    runtimeMonitor.updateSession(sessionId, { status: 'generating' });
    runtimeMonitor.emit('llama_generation_started', { sessionId, turnId });

    const candidate = await generateWithLlama({ sessionId, turnId, blocks });

    // Tool execution
    if (candidate.tools && candidate.tools.length > 0) {
      runtimeMonitor.updateSession(sessionId, { status: 'tool-running', activeTool: candidate.tools[0].name });
      runtimeMonitor.emit('tool_started', { sessionId, turnId, tool: candidate.tools[0].name });
    }

    // Validation
    runtimeMonitor.updateSession(sessionId, { status: 'validating', activePhase: 'validation' });
    runtimeMonitor.emit('tool00_validation_started', { sessionId, turnId });

    const validation = await tool00.validate(candidate);

    runtimeMonitor.emit('tool00_validation_completed', { sessionId, turnId, valid: validation.valid });

    if (!validation.valid) {
      throw new Error('Tool-00 validation failed: ' + JSON.stringify(validation.violations));
    }

    // Commit
    runtimeMonitor.updateSession(sessionId, { status: 'committing', activePhase: 'commit' });
    await transcript.commit({ sessionId, turnId, candidate });
    runtimeMonitor.emit('turn_committed', { sessionId, turnId });

    runtimeMonitor.updateSession(sessionId, { status: 'completed', currentTurnId: null, activePhase: null });

    return candidate;

  } catch (error) {
    runtimeMonitor.updateSession(sessionId, { status: 'failed', error: error.message });
    runtimeMonitor.emit('turn_failed', { sessionId, turnId, error: error.message });
    throw error;
  }
}

module.exports = {
  PROCESS_STATES,
  STATE_TRANSITIONS,
  EVENT_TYPES,
  RuntimeMonitor,
  runTurn,
};
