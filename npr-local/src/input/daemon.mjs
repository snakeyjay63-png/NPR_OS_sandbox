// @net 10.01.5.0/24
// ────────────────────────────────────────────────
// input/daemon.mjs — Input Daemon (Lifecycle)
// ────────────────────────────────────────────────
//
// Orchestrates the full input pipeline:
//   evdev device → worker → decode → normalize → dispatcher → audit
//
// Manages:
//   - Multiple device readers
//   - Start/stop/restart lifecycle
//   - Health monitoring
//   - Graceful shutdown

import { EvdevReader } from "./evdev-reader.mjs";
import { normalizeEvent } from "./normalize.mjs";
import { EventLog } from "../audit/event-log.mjs";

export class InputDaemon {
  /**
   * @param {Object} opts
   * @param {Array} opts.devices — [{ id, path, transport? }]
   * @param {Object} opts.dispatcher — EventDispatcher instance
   * @param {Object} [opts.auditLog] — EventLog instance (created if omitted)
   */
  constructor(opts) {
    this.devices = opts.devices ?? [];
    this.dispatcher = opts.dispatcher;
    this.auditLog = opts.auditLog ?? new EventLog();
    this.readers = new Map();
    this.running = false;
    this.stats = { events: 0, errors: 0, startedAt: null };
  }

  // ─── Start ──────────────────────────────────

  async start() {
    if (this.running) return this;
    this.running = true;
    this.stats.startedAt = process.hrtime.bigint().toString();

    for (const dev of this.devices) {
      const reader = this._createReader(dev);
      this.readers.set(dev.id, reader);
      reader.start();
    }

    // Health monitor
    this._healthInterval = setInterval(() => this._healthCheck(), 30_000);

    return this;
  }

  // ─── Stop ───────────────────────────────────

  async stop() {
    if (!this.running) return this;
    this.running = false;

    if (this._healthInterval) {
      clearInterval(this._healthInterval);
    }

    const stops = [];
    for (const reader of this.readers.values()) {
      stops.push(reader.stop());
    }
    await Promise.allSettled(stops);
    this.readers.clear();

    return this;
  }

  // ─── Restart single device ──────────────────

  async restart(deviceId) {
    const old = this.readers.get(deviceId);
    if (old) await old.stop();

    const dev = this.devices.find((d) => d.id === deviceId);
    if (!dev) throw new Error(`Device not found: ${deviceId}`);

    const reader = this._createReader(dev);
    this.readers.set(deviceId, reader);
    reader.start();

    return this;
  }

  // ─── Status ─────────────────────────────────

  status() {
    const readers = {};
    for (const [id, reader] of this.readers) {
      readers[id] = {
        device: id,
        running: reader.isRunning,
      };
    }
    return {
      running: this.running,
      devices: readers,
      stats: this.stats,
      audit: this.auditLog.stats(),
    };
  }

  // ─── Internal ───────────────────────────────

  _createReader(dev) {
    const deviceInfo = {
      id: dev.id,
      path: dev.path,
      transport: dev.transport ?? "evdev",
    };

    const reader = new EvdevReader({
      device: dev.path,
      onEvent: (raw, timing) => {
        this.stats.events++;
        try {
          const event = normalizeEvent(deviceInfo, raw);
          event._timing = timing;
          this.dispatcher.dispatch(event);
        } catch (err) {
          this.stats.errors++;
          this.auditLog.write({
            eventId: `error-${Date.now()}`,
            device: dev.id,
            signal: raw,
            result: "error",
            error: err.message,
          });
        }
      },
      onError: (err) => {
        this.stats.errors++;
        this.auditLog.write({
          eventId: `error-${Date.now()}`,
          device: dev.id,
          signal: null,
          result: "error",
          error: err.message,
        });
      },
      onReady: () => {
        this.auditLog.write({
          eventId: `ready-${Date.now()}`,
          device: dev.id,
          signal: null,
          result: "ready",
        });
      },
    });

    return reader;
  }

  _healthCheck() {
    for (const [id, reader] of this.readers) {
      if (!reader.isRunning) {
        this.auditLog.write({
          eventId: `health-${Date.now()}`,
          device: id,
          signal: null,
          result: "worker_dead",
        });
      }
    }
  }
}
