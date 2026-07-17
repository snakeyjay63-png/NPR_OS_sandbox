// @net 10.01.4.0/24
// ────────────────────────────────────────────────
// input/evdev-reader.mjs — Main-thread Evdev Adapter
// ────────────────────────────────────────────────
//
// Spawns a blocking evdev-stream-worker and bridges
// its postMessage events into the main-thread eventbus.
//
// Flow:
//   /dev/input/eventX
//   → worker (blocking readSync)
//   → postMessage
//   → this reader decodes
//   → onEvent callback → dispatcher

import { Worker } from "node:worker_threads";
import { URL } from "node:url";
import { decodeInputEvent } from "./reader.mjs";

export class EvdevReader {
  /**
   * @param {Object} opts
   * @param {string} opts.device — evdev path, e.g. "/dev/input/event0"
   * @param {Function} opts.onEvent — (rawEvent, timing) => void
   * @param {Function} [opts.onError] — (err) => void
   * @param {Function} [opts.onReady] — (device) => void
   */
  constructor(opts) {
    this.device = opts.device;
    this.onEvent = opts.onEvent ?? (() => {});
    this.onError = opts.onError ?? (() => {});
    this.onReady = opts.onReady ?? (() => {});

    this.worker = null;
    this.running = false;
  }

  // ─── Lifecycle ──────────────────────────────

  start() {
    if (this.running) return this;
    this.running = true;

    this.worker = new Worker(
      new URL("./evdev-stream-worker.mjs", import.meta.url),
      { workerData: { device: this.device } },
    );

    this.worker.on("message", (msg) => {
      switch (msg.type) {
        case "ready":
          this.onReady(msg.device);
          break;

        case "evdev": {
          const raw = decodeInputEvent(msg.data);
          const timing = { receivedAtNs: msg.receivedAtNs };
          this.onEvent(raw, timing);
          break;
        }

        case "partial":
          this.onError(new Error(`Partial read on ${this.device}: ${msg.bytesRead} bytes`));
          break;

        case "error":
          this.onError(new Error(msg.message));
          break;
      }
    });

    this.worker.on("error", (err) => {
      this.onError(err);
    });

    this.worker.on("exit", (code) => {
      if (this.running && code !== 0) {
        this.onError(new Error(`Worker exited with code ${code}`));
      }
      this.running = false;
      this.worker = null;
    });

    return this;
  }

  async stop() {
    if (!this.worker) return;
    this.running = false;
    this.worker.postMessage({ cmd: "stop" });

    // Graceful shutdown with timeout
    await Promise.race([
      new Promise((resolve) => {
        if (this.worker) {
          this.worker.once("exit", resolve);
        } else {
          resolve();
        }
      }),
      new Promise((resolve) => setTimeout(resolve, 3000)).then(resolve),
    ]);

    if (this.worker && !this.worker.exited) {
      await this.worker.terminate();
    }
    this.worker = null;
  }

  get isRunning() {
    return this.running && this.worker?.exited === false;
  }
}
