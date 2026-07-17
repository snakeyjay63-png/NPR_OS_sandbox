// @addr 10.0.0.0 | fd00:npr:0000:000::0
// ═══════════════════════════════════════════
// Gateway Supervisor — Component Lifecycle
// ═══════════════════════════════════════════
//
// Gateway lifetime > session lifetime > turn lifetime > tool-call lifetime
// De gateway blijft draaien. Onderdelen falen, herstellen, draaien door.

const GATEWAY_STATES = Object.freeze({
  starting: 'starting',
  ready: 'ready',
  degraded: 'degraded',
  draining: 'draining',
  recovering: 'recovering',
  stopped: 'stopped',
});

const CRITICAL_COMPONENTS = new Set(['eventbus', 'sessionManager', 'contextHypervisor', 'tool00']);
const OPTIONAL_COMPONENTS = new Set(['llamaEngine', 'chatUI', 'inputDevices']);

// ─── Component Record ───

class ComponentRecord {
  constructor(name, component, opts = {}) {
    this.name = name;
    this.component = component;
    this.status = 'registered';
    this.restarts = 0;
    this.lastError = null;
    this.maxRestarts = opts.maxRestarts ?? 5;
    this.restartDelayMs = opts.restartDelayMs ?? 2000;
    this.critical = CRITICAL_COMPONENTS.has(name);
    this._watchTimer = null;
  }
}

// ─── Supervisor ───

class GatewaySupervisor {
  constructor(opts = {}) {
    this._state = 'starting';
    this._components = new Map();
    this._eventBus = null;
    this._healthCheckInterval = null;
    this._healthCheckMs = opts.healthCheckMs ?? 10000;
    this._drainMode = false;
    this._stopped = false;
  }

  get state() { return this._state; }

  // ─── Lifecycle ───

  register(name, component, opts = {}) {
    const record = new ComponentRecord(name, component, opts);
    this._components.set(name, record);
    this._emit('component_registered', { name });
    return this;
  }

  async start() {
    this._state = 'starting';
    this._emit('gateway_starting');

    for (const record of this._components.values()) {
      await this._startComponent(record);
    }

    this._recalculateState();

    if (this._state === 'ready' || this._state === 'degraded') {
      this._startHealthChecks();
    }

    this._emit('gateway_started', { state: this._state });
    return this._state;
  }

  async stop(graceful = true) {
    this._state = 'draining';
    this._drainMode = true;
    this._emit('gateway_draining');

    // Stop health checks first
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = null;
    }

    // Stop components in reverse order
    const records = [...this._components.values()].reverse();
    for (const record of records) {
      try {
        await record.component.stop?.();
        record.status = 'stopped';
      } catch (err) {
        record.lastError = String(err);
      }
    }

    this._state = graceful ? 'stopped' : 'recovering';
    this._stopped = true;
    this._emit('gateway_stopped', { state: this._state });
  }

  async restart(name) {
    const record = this._components.get(name);
    if (!record) throw new Error(`Unknown component: ${name}`);

    record.status = 'restarting';
    record.restarts += 1;
    this._emit('component_restarting', { name, restarts: record.restarts });

    try {
      await record.component.stop?.();
      await this._startComponent(record);
    } catch (err) {
      record.status = 'failed';
      record.lastError = err instanceof Error ? err.message : String(err);
    }

    this._recalculateState();
  }

  // ─── Internal ───

  async _startComponent(record) {
    try {
      await record.component.start?.();
      record.status = 'ready';
      record.lastError = null;
      this._emit('component_started', { name: record.name });
    } catch (error) {
      record.status = 'failed';
      record.lastError = error instanceof Error ? error.message : String(error);
      this._emit('component_failed', { name: record.name, error: record.lastError });

      // Auto-restart if under limit
      if (record.restarts < record.maxRestarts) {
        this._scheduleRestart(record);
      }
    }
  }

  _scheduleRestart(record) {
    if (this._stopped) return;
    record._watchTimer = setTimeout(async () => {
      if (record.status === 'failed' && !this._stopped) {
        await this.restart(record.name);
      }
    }, record.restartDelayMs);
  }

  _recalculateState() {
    if (this._stopped) return;

    const records = [...this._components.values()];
    if (!records.length) {
      this._state = 'ready';
      return;
    }

    const failed = records.filter(r => r.status === 'failed');
    const criticalFailed = failed.filter(r => r.critical);

    if (criticalFailed.length > 0 && failed.length === records.length) {
      this._state = 'recovering';
    } else if (failed.length > 0) {
      this._state = 'degraded';
    } else {
      this._state = 'ready';
    }

    this._emit('gateway_state_changed', {
      from: this._state,
      to: this._state,
      components: this._components.size,
      failed: failed.length,
    });
  }

  _startHealthChecks() {
    if (this._healthCheckInterval) return;
    this._healthCheckInterval = setInterval(() => {
      this._checkComponents();
    }, this._healthCheckMs);
  }

  _checkComponents() {
    for (const record of this._components.values()) {
      if (record.status !== 'ready') continue;

      // Call health check if available
      if (typeof record.component.healthCheck === 'function') {
        const healthy = record.component.healthCheck();
        if (!healthy) {
          record.status = 'degraded';
          record.lastError = 'Health check failed';
          this._scheduleRestart(record);
        }
      }
    }
  }

  // ─── Queries ───

  getComponent(name) {
    const record = this._components.get(name);
    return record ? record.component : null;
  }

  snapshot() {
    return {
      state: this._state,
      drainMode: this._drainMode,
      components: [...this._components.values()].map(r => ({
        name: r.name,
        status: r.status,
        critical: r.critical,
        restarts: r.restarts,
        maxRestarts: r.maxRestarts,
        lastError: r.lastError,
      })),
      timestamp: Date.now(),
    };
  }

  isComponentReady(name) {
    const record = this._components.get(name);
    return record?.status === 'ready';
  }

  canAcceptTurns() {
    // Must have sessionManager + contextHypervisor + at least one of llamaEngine or tool00
    const hasSessions = this.isComponentReady('sessionManager');
    const hasContext = this.isComponentReady('contextHypervisor');
    const hasInference = this.isComponentReady('llamaEngine');
    const hasValidation = this.isComponentReady('tool00');

    return hasSessions && hasContext && (hasInference || hasValidation);
  }

  // ─── Events ───

  setEventBus(eventBus) {
    this._eventBus = eventBus;
  }

  _emit(type, payload = {}) {
    if (this._eventBus) {
      this._eventBus.emit(type, { ...payload, supervisor: this._state });
    }
  }
}

// ─── Default Gateway Component Adapters ───

function createSessionManagerAdapter(sessionManager) {
  return {
    start: async () => {
      if (typeof sessionManager.initialize === 'function') {
        await sessionManager.initialize();
      }
    },
    stop: async () => {
      if (typeof sessionManager.shutdown === 'function') {
        await sessionManager.shutdown();
      }
    },
    healthCheck: () => true, // session manager always "alive"
    get manager() { return sessionManager; },
  };
}

function createContextHypervisorAdapter(hypervisor) {
  return {
    start: async () => {
      if (typeof hypervisor.initialize === 'function') {
        await hypervisor.initialize();
      }
    },
    stop: async () => {
      if (typeof hypervisor.snapshot === 'function') {
        // Persist snapshot on stop
        hypervisor.snapshot();
      }
    },
    healthCheck: () => true,
    get hypervisor() { return hypervisor; },
  };
}

function createLlamaEngineAdapter(engine) {
  return {
    start: async () => {
      if (typeof engine.initialize === 'function') {
        return engine.initialize();
      }
    },
    stop: async () => {
      if (typeof engine.release === 'function') {
        return engine.release();
      }
    },
    healthCheck: () => {
      if (typeof engine.isReady === 'function') return engine.isReady();
      return true;
    },
    get engine() { return engine; },
  };
}

function createTool00Adapter(tool00) {
  return {
    start: async () => {}, // Tool-00 is always available
    stop: async () => {},
    healthCheck: () => true,
    get tool00() { return tool00; },
  };
}

module.exports = {
  GATEWAY_STATES,
  CRITICAL_COMPONENTS,
  OPTIONAL_COMPONENTS,
  GatewaySupervisor,
  createSessionManagerAdapter,
  createContextHypervisorAdapter,
  createLlamaEngineAdapter,
  createTool00Adapter,
};
