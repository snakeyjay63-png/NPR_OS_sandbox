// @net 10.01.6.0/24
// ────────────────────────────────────────────────
// tests/epoll-adapter.test.mjs
// ────────────────────────────────────────────────

import * as Input from "../src/input/index.mjs";
import { test } from "node:test";
import { strict as a } from "node:assert";

// ─── Factory + Constructor ───

test("createEpollAdapter — returns EpollInputAdapter instance", () => {
  const adapter = Input.createEpollAdapter([]);
  a.equal(adapter instanceof Input.EpollInputAdapter, true);
});

test("constructor — default values", () => {
  const adapter = new Input.EpollInputAdapter();
  a.equal(adapter.status().running, false);
  a.equal(Array.isArray(adapter.status().devices), true);
  a.equal(typeof adapter.status().stats.events, "number");
});

// ─── Lifecycle (no real devices — dry run) ───

test("start/stop — no-op when no devices", () => {
  const adapter = Input.createEpollAdapter([]);
  // Will fail silently (no epoll module loaded in test env)
  // Just verify start/stop don't crash the skeleton
  adapter.start();
  adapter.stop();
  a.equal(adapter.status().running, false);
});

// ─── Device Management (pre-start) ───

test("addDevice (pre-start) — queues device", () => {
  const adapter = new Input.EpollInputAdapter();
  adapter.addDevice({ id: "test-kb", name: "Test", path: "/dev/null" });
  a.equal(adapter.status().devices.length, 1);
  adapter.stop();
});

// ─── Status ───

test("status — returns structured object", () => {
  const adapter = Input.createEpollAdapter([]);
  const s = adapter.status();
  a.equal(typeof s.running, "boolean");
  a.equal(Array.isArray(s.devices), true);
  a.equal(typeof s.stats, "object");
  a.equal(typeof s.stats.events, "number");
  a.equal(typeof s.stats.errors, "number");
  a.equal(typeof s.stats.dropped, "number");
  adapter.stop();
});

// ─── Barrel Export ───

test("barrel — EpollInputAdapter exported", () => {
  a.equal(typeof Input.EpollInputAdapter, "function");
  a.equal(typeof Input.createEpollAdapter, "function");
});
