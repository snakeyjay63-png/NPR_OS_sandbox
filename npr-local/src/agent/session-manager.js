'use strict';

/**
 * Session Manager — State Machine
 *
 * States: init → connecting → running → paused → reconnecting → stopped
 * Events: start, connect, pause, resume, stop, error, reconnect
 */

const EventEmitter = require('events');

const STATES = Object.freeze([
  'init',
  'connecting',
  'running',
  'paused',
  'reconnecting',
  'stopped',
]);

const TRANSITIONS = Object.freeze({
  init:         { start: 'connecting' },
  connecting:   { connect: 'running', error: 'init', timeout: 'init' },
  running:      { pause: 'paused', stop: 'stopped', error: 'reconnecting' },
  paused:       { resume: 'running', stop: 'stopped' },
  reconnecting: { connect: 'running', error: 'init', timeout: 'init' },
  stopped:      { start: 'connecting' },
});

class SessionState extends EventEmitter {
  constructor() {
    super();
    this._state = 'init';
    this._history = [{ state: 'init', time: Date.now() }];
    this._meta = {};
  }

  get state() {
    return this._state;
  }

  get history() {
    return this._history;
  }

  get meta() {
    return this._meta;
  }

  /** Get allowed events from current state */
  allowedEvents() {
    return Object.keys(TRANSITIONS[this._state] || {});
  }

  /** Transition to a new state via event */
  transition(event, data = {}) {
    const allowed = TRANSITIONS[this._state];
    const next = allowed ? allowed[event] : null;

    if (!next) {
      const err = new Error(
        `Invalid transition: ${this._state} + ${event} (allowed: ${this.allowedEvents().join(', ')})`,
      );
      err.from = this._state;
      err.event = event;
      err.allowed = this.allowedEvents();
      this.emit('transition-error', err);
      throw err;
    }

    const prev = this._state;
    this._state = next;
    const record = {
      from: prev,
      to: next,
      event,
      time: Date.now(),
      data,
    };
    this._history.push(record);

    // Auto-track metadata
    if (event === 'start') {
      this._meta.startedAt = record.time;
      this._meta.startCount = (this._meta.startCount || 0) + 1;
    }
    if (event === 'stop') {
      this._meta.stoppedAt = record.time;
      this._meta.totalPauseMs = (this._meta.totalPauseMs || 0) + (record.time - (this._meta.startedAt || record.time));
    }
    if (event === 'error') {
      this._meta.errorCount = (this._meta.errorCount || 0) + 1;
      this._meta.lastError = data.message || String(data);
    }

    this.emit('transition', record);
    this.emit(next, record);
    return record;
  }

  /** Snapshot current state for serialization */
  snapshot() {
    return {
      state: this._state,
      history: this._history,
      meta: { ...this._meta },
    };
  }

  /** Restore state from snapshot */
  restore(snapshot) {
    this._state = snapshot.state;
    this._history = snapshot.history || [];
    this._meta = snapshot.meta || {};
    this.emit('restored', this._state);
  }
}

/**
 * Full Session Manager with lifecycle hooks
 */
class SessionManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.state = new SessionState();
    this.config = {
      reconnectDelay: config.reconnectDelay || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
      heartbeatInterval: config.heartbeatInterval || 30000,
      ...config,
    };
    this._reconnectAttempts = 0;
    this._heartbeatTimer = null;
    this._reconnectTimer = null;

    // Wire up auto-reconnect
    this.state.on('transition', (record) => {
      if (record.to === 'reconnecting') {
        this._attemptReconnect();
      }
      if (record.to === 'running') {
        this._reconnectAttempts = 0;
        this._startHeartbeat();
      }
      if (record.to === 'stopped' || record.to === 'init') {
        this._stopHeartbeat();
        this._clearReconnect();
      }
    });
  }

  /** Start the session */
  async start() {
    this.state.transition('start');
    this.emit('starting');
    // Hook for subclasses / integration
    await this._onStarting();
    return this;
  }

  /** Mark connection established */
  async connect(info = {}) {
    this.state.transition('connect', info);
    this.emit('connected', info);
    await this._onConnected(info);
    return this;
  }

  /** Pause the session */
  pause(reason) {
    this.state.transition('pause', { reason });
    this.emit('paused', reason);
    return this;
  }

  /** Resume from pause */
  async resume() {
    this.state.transition('resume');
    this.emit('resumed');
    await this._onResumed();
    return this;
  }

  /** Stop the session */
  async stop() {
    this.state.transition('stop');
    this.emit('stopping');
    await this._onStopping();
    this.emit('stopped');
    return this;
  }

  /** Signal an error (triggers reconnect if running) */
  error(err) {
    const data = {
      message: err.message || String(err),
      code: err.code,
      stack: err.stack,
    };
    try {
      this.state.transition('error', data);
    } catch (_) {
      // Already handled in state machine
    }
    this.emit('error', err);
    return this;
  }

  /** Force reconnect attempt */
  async reconnect() {
    if (this.state.state === 'running') {
      this.state.transition('error', { message: 'manual reconnect' });
    }
    return this;
  }

  /** Get allowed events */
  allowedEvents() {
    return this.state.allowedEvents();
  }

  /** Full status snapshot */
  status() {
    return {
      sessionState: this.state.snapshot(),
      reconnectAttempts: this._reconnectAttempts,
      config: this.config,
    };
  }

  // ---- Internal ----

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      this.emit('heartbeat', { time: Date.now() });
    }, this.config.heartbeatInterval);
    if (this._heartbeatTimer.unref) {
      this._heartbeatTimer.unref();
    }
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  _attemptReconnect() {
    this._clearReconnect();
    if (this._reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.emit('reconnect-exhausted', this._reconnectAttempts);
      return;
    }
    this._reconnectAttempts++;
    this._reconnectTimer = setTimeout(async () => {
      this.emit('reconnecting', this._reconnectAttempts);
      try {
        await this._onReconnecting();
        this.state.transition('connect', { reconnected: true, attempt: this._reconnectAttempts });
      } catch (err) {
        this.error(err);
      }
    }, this.config.reconnectDelay * this._reconnectAttempts);
    if (this._reconnectTimer.unref) {
      this._reconnectTimer.unref();
    }
  }

  _clearReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  // ---- Lifecycle hooks (override in subclass) ----

  async _onStarting() {}
  async _onConnected() {}
  async _onResumed() {}
  async _onStopping() {}
  async _onReconnecting() {}
}

module.exports = { SessionManager, SessionState, STATES, TRANSITIONS };
