// @net 10.01.6.0/24
// ────────────────────────────────────────────────
// input/epoll-adapter.mjs — epoll-based Input Adapter
// ────────────────────────────────────────────────
//
// Bridges Linux evdev devices → NPR event bus via epoll.
// Non-blocking, single-thread, main-process.
//
// Flow:
//   /dev/input/eventX
//   → fs.open (non-blocking)
//   → epoll.add(fd, EPOLLIN)
//   → epoll callback (events ready)
//   → fs.readSync (24-byte evdev records)
//   → decodeInputEvent → normalizeEvent
//   → event bus dispatcher
//   → audit log
//
// Requires: read access to /dev/input/eventX
//   → udev rule or chmod 666
//
// @depends epoll (native addon)
// @depends node:fs (open, readSync, close)

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { normalizeEvent } from './normalize.mjs';
import { decodeInputEvent } from './reader.mjs';
import { EventLog } from '../audit/event-log.mjs';

const require = createRequire(import.meta.url);
const epoll = require('epoll');

const RECORD_SIZE = 24; // linux input_event: 8+8+2+2+4

export class EpollInputAdapter {
  /**
   * @param {Object} opts
   * @param {Array<{id: string, name: string, path: string, transport?: string}>} [opts.devices]
   * @param {Object} [opts.dispatcher] — EventDispatcher instance
   * @param {Object} [opts.auditLog] — EventLog instance (auto-created if omitted)
   * @param {boolean} [opts.debug=false]
   */
  constructor(opts = {}) {
    this._devices = opts.devices ?? [];
    this._dispatcher = opts.dispatcher ?? null;
    this._audit = opts.auditLog ?? new EventLog();
    this._debug = !!opts.debug;

    this._epoll = null;
    this._fds = new Map();     // fd → device config
    this._running = false;
    this._stats = {
      events: 0,
      errors: 0,
      dropped: 0,
      startedAt: null,
    };
  }

  // ─── Lifecycle ──────────────────────────────

  start() {
    if (this._running) return this;
    this._running = true;
    this._stats.startedAt = Date.now();

    // Create epoll instance
    this._epoll = new epoll.Epoll(this._onEpollEvents.bind(this));

    // Open and register each device
    for (const dev of this._devices) {
      this._registerDevice(dev);
    }

    return this;
  }

  stop() {
    if (!this._running) return this;
    this._running = false;

    // Close all file descriptors
    for (const [fd] of this._fds) {
      try { fs.closeSync(fd); } catch(_) {}
    }
    this._fds.clear();

    // Close epoll
    if (this._epoll) {
      this._epoll.close();
      this._epoll = null;
    }

    return this;
  }

  // ─── Device Management ─────────────────────

  addDevice(dev) {
    if (!this._running) {
      this._devices.push(dev);
      return this;
    }
    this._registerDevice(dev);
    return this;
  }

  removeDevice(deviceId) {
    // Find and close the fd for this device
    for (const [fd, cfg] of this._fds) {
      if (cfg.id === deviceId) {
        if (this._epoll) {
          try { this._epoll.remove(fd); } catch(_) {}
        }
        try { fs.closeSync(fd); } catch(_) {}
        this._fds.delete(fd);
        break;
      }
    }
    this._devices = this._devices.filter((d) => d.id !== deviceId);
    return this;
  }

  // ─── Status ────────────────────────────────

  status() {
    const devices = [];
    const activeIds = new Set();

    // Active (registered) devices
    for (const [fd, cfg] of this._fds) {
      devices.push({ id: cfg.id, name: cfg.name, path: cfg.path, fd, active: true });
      activeIds.add(cfg.id);
    }

    // Queued (pre-start) devices
    for (const cfg of this._devices) {
      if (!activeIds.has(cfg.id)) {
        devices.push({ id: cfg.id, name: cfg.name, path: cfg.path, fd: null, active: false });
      }
    }

    return {
      running: this._running,
      devices,
      stats: { ...this._stats },
    };
  }

  // ─── Internal ──────────────────────────────

  _registerDevice(dev) {
    try {
      const fd = fs.openSync(dev.path, 'r');
      this._epoll.add(fd, epoll.Epoll.EPOLLIN);
      this._fds.set(fd, dev);
      if (this._debug) {
        console.log(`[epoll] registered ${dev.id} (${dev.path}) → fd=${fd}`);
      }
    } catch (err) {
      console.warn(`[epoll] failed to open ${dev.path}: ${err.message}`);
      this._audit.write({
        eventId: `epoll-fail-${Date.now()}`,
        device: dev.id,
        signal: null,
        result: 'error',
        error: err.message,
        path: dev.path,
      });
    }
  }

  _onEpollEvents(events) {
    if (!this._running) return;

    const EPOLLIN = epoll.Epoll.EPOLLIN;

    for (const evt of events) {
      // Skip error/hangup events
      if (evt.events & epoll.Epoll.EPOLLERR || evt.events & epoll.Epoll.EPOLLHUP) {
        const dev = this._fds.get(evt.fd);
        if (dev) {
          console.warn(`[epoll] error on ${dev.id} (fd=${evt.fd}), events=0x${evt.events.toString(16)}`);
        }
        this._stats.errors++;
        continue;
      }

      // Read events from this fd
      if (evt.events & EPOLLIN) {
        const dev = this._fds.get(evt.fd);
        if (!dev) continue;

        this._readFd(evt.fd, dev);
      }
    }
  }

  _readFd(fd, dev) {
    try {
      const buf = Buffer.alloc(RECORD_SIZE);
      const bytesRead = fs.readSync(fd, buf, 0, RECORD_SIZE, null);

      if (bytesRead !== RECORD_SIZE) {
        this._stats.dropped++;
        return;
      }

      this._stats.events++;

      // Decode raw evdev event
      const raw = decodeInputEvent(buf);
      if (!raw) return;

      // Normalize → canonical event
      const event = normalizeEvent(dev, {
        type: raw.type,
        code: raw.code,
        value: raw.value,
        timestampNs: process.hrtime.bigint().toString(),
      });

      // Dispatch through event bus
      if (this._dispatcher) {
        try {
          this._dispatcher.dispatch(event);
        } catch (err) {
          this._stats.errors++;
          this._audit.write({
            eventId: `dispatch-err-${Date.now()}`,
            device: dev.id,
            signal: raw,
            result: 'error',
            error: err.message,
          });
        }
      }

      // Audit trail
      this._audit.write({
        eventId: event.id,
        device: dev.id,
        signal: raw,
        result: 'dispatched',
      });

    } catch (err) {
      this._stats.errors++;
      if (this._debug) {
        console.error(`[epoll] read error on fd=${fd}: ${err.message}`);
      }
    }
  }
}

/**
 * Factory: create adapter from device list and optional dispatcher.
 * @param {Array} devices
 * @param {Object} [opts]
 * @returns {EpollInputAdapter}
 */
export function createEpollAdapter(devices, opts = {}) {
  return new EpollInputAdapter({
    devices,
    dispatcher: opts.dispatcher ?? null,
    auditLog: opts.auditLog ?? null,
    debug: opts.debug ?? false,
  });
}
