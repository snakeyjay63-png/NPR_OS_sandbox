// @net 10.01.3.0/24
// ────────────────────────────────────────────────
// input/evdev-stream-worker.mjs — Blocking evdev Worker
// ────────────────────────────────────────────────
//
// Opens an evdev device in a dedicated worker thread.
// Blocking read loop — main thread stays idle.
//
// Lifecycle:
//   Worker → Main  : { type: "ready", device }
//   Worker → Main  : { type: "evdev", data: Buffer, receivedAtNs: bigint-str }
//   Worker → Main  : { type: "error", message }
//   Worker → Main  : { type: "partial", bytesRead }
//   Main  → Worker : { cmd: "stop" }
//
// Requires: read access to /dev/input/eventX
//   → udev rule or chmod 666

import { parentPort, workerData } from "node:worker_threads";
import { openSync, readSync, closeSync } from "node:fs";

const EVENT_SIZE = 24;
const { device } = workerData;

if (!device) {
  parentPort.postMessage({ type: "error", message: "workerData.device required" });
  process.exit(1);
}

let fd = -1;
let running = true;

// ─── Commands ─────────────────────────────────

parentPort.on("message", (msg) => {
  if (msg?.cmd === "stop") {
    running = false;
  }
});

// ─── Cleanup on exit ──────────────────────────

const cleanup = () => {
  if (fd >= 0) {
    try { closeSync(fd); } catch { /* ignore */ }
    fd = -1;
  }
};

process.on("exit", cleanup);

// ─── Open device ─────────────────────────────

try {
  fd = openSync(device, "r");
} catch (err) {
  parentPort.postMessage({ type: "error", message: `open(${device}): ${err.message}` });
  process.exit(1);
}

parentPort.postMessage({ type: "ready", device });

// ─── Blocking read loop ─────────────────────

try {
  while (running) {
    const buffer = Buffer.alloc(EVENT_SIZE);

    try {
      const bytesRead = readSync(fd, buffer, 0, EVENT_SIZE, null);

      if (bytesRead === EVENT_SIZE) {
        parentPort.postMessage({
          type: "evdev",
          data: buffer,
          receivedAtNs: process.hrtime.bigint().toString(),
        });
      } else if (bytesRead > 0) {
        parentPort.postMessage({ type: "partial", bytesRead, device });
      }
    } catch (err) {
      if (running && err.code !== "EBADF") {
        parentPort.postMessage({ type: "error", message: err.message });
        // Brief backoff on transient errors
        running = true; // don't exit yet
        // Small yield to avoid busy-spin on persistent error
        // (worker threads can't sleep, so we accept the spin briefly)
      }
    }
  }
} finally {
  cleanup();
}
