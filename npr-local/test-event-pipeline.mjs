#!/usr/bin/env node
// @net 10.00.0.0
// ─────────────────────────────────────────────────
// test-event-pipeline.mjs — Full Pipeline Test
// ─────────────────────────────────────────────────
//
// Tests: input → normalize → route → block → action → audit

import test   from "node:test";
import assert from "node:assert/strict";

// Modules under test
import { normalizeEvent, DeviceRegistry } from "./src/input/index.mjs";
import { EventRegistry, EventDispatcher, validateEvent, signalToAddress, digitalRoot } from "./src/events/index.mjs";
import { BlockRegistry }    from "./src/routes/block-registry.mjs";
import { CapabilityPolicy } from "./src/routes/capability-policy.mjs";
import { ActionRegistry }   from "./src/actions/registry.mjs";
import { EventLog }         from "./src/audit/event-log.mjs";

// ─── Fixtures ──────────────────────────────────

const DEVICE = { id: "npr-control", transport: "evdev", path: "/dev/input/event0" };
const RAW_INPUT = { type: 1, code: 30, value: 1 };

// ─── Tests ─────────────────────────────────────

test("digitalRoot basics", () => {
  assert.equal(digitalRoot(0),  0);
  assert.equal(digitalRoot(1),  1);
  assert.equal(digitalRoot(9),  9);
  assert.equal(digitalRoot(10), 1);
  assert.equal(digitalRoot(28), 1);
  assert.equal(digitalRoot(30), 3);
});

test("signalToAddress maps EV_KEY:30:1", () => {
  const addr = signalToAddress(1, 30, 1);
  assert.ok(addr.startsWith("10."));
  const parts = addr.split(".");
  assert.equal(parts.length, 4);
});

test("normalizeEvent produces valid event", () => {
  const event = normalizeEvent(DEVICE, RAW_INPUT);
  const errors = validateEvent(event);
  assert.equal(errors.length, 0, `Schema errors: ${errors.join(", ")}`);
  assert.equal(event.state, "received");
  assert.equal(event.source.deviceId, "npr-control");
  assert.equal(event.signal.type, 1);
  assert.equal(event.signal.code, 30);
  assert.equal(event.signal.value, 1);
});

test("EventRegistry resolves known route", () => {
  const registry = new EventRegistry();
  const event = normalizeEvent(DEVICE, RAW_INPUT);
  const route = registry.resolve(event);
  assert.ok(route, "Route should exist for npr-control:1:30:1");
  assert.equal(route.address, "10.07.2.1");
  assert.equal(route.action, "workspace.open");
});

test("EventRegistry returns null for unknown event", () => {
  const registry = new EventRegistry();
  const unknown = normalizeEvent({ id: "unknown-dev", transport: "hid", path: "?" }, { type: 99, code: 99, value: 0 });
  const route = registry.resolve(unknown);
  assert.equal(route, null);
});

test("BlockRegistry has defaults", () => {
  const br = new BlockRegistry().loadDefaults();
  assert.ok(br.has("10.00.0.0"), "Null block should exist");
  assert.ok(br.has("10.07.2.1"), "Workspace block should exist");
  const block = br.get("10.07.2.1");
  assert.equal(block.capabilities.includes("workspace.read"), true);
});

test("CapabilityPolicy authorizes valid block+route", () => {
  const policy = new CapabilityPolicy();
  const block = { address: "10.07.2.1", capabilities: ["workspace.read"] };
  const route = { capability: "workspace.read" };
  assert.equal(policy.authorize(block, route), true);
});

test("CapabilityPolicy denies mismatched capability", () => {
  const policy = new CapabilityPolicy();
  const block = { address: "10.07.2.1", capabilities: ["workspace.read"] };
  const route = { capability: "process.exec" };
  assert.equal(policy.authorize(block, route), false);
});

test("ActionRegistry has builtins", () => {
  const ar = new ActionRegistry().loadBuiltins();
  assert.ok(ar.has("workspace.open"));
  assert.ok(ar.has("npr.null"));
  assert.ok(ar.has("status.query"));
});

test("EventLog records and queries", () => {
  const log = new EventLog();
  log.write({ eventId: "test-1", device: "npr-control", block: "10.07.2.1", action: "workspace.open", result: "executed", durationUs: 41.728 });
  log.write({ eventId: "test-2", device: "npr-control", block: "10.00.0.0", action: "npr.null", result: "executed", durationUs: 5.0 });

  assert.equal(log.records.length, 2);
  assert.equal(log.findByDevice("npr-control").length, 2);
  assert.equal(log.findByBlock("10.07.2.1").length, 1);

  const stats = log.stats();
  assert.equal(stats.total, 2);
  assert.equal(stats.executed, 2);
  assert.ok(Number.isFinite(stats.avgUs));
});

test("EventDispatcher: direct route succeeds", async () => {
  const auditLog = new EventLog();
  const dispatcher = new EventDispatcher({
    auditLog,
  });

  const event = normalizeEvent(DEVICE, RAW_INPUT);
  const result = await dispatcher.dispatch(event);

  assert.equal(result.state, "executed");
  assert.equal(result.block, "10.07.2.1");
  assert.equal(result.action, "workspace.open");

  // Audit log should have one record
  const records = auditLog.recent();
  assert.ok(records.length >= 1);
  assert.equal(records[records.length - 1].result, "executed");
});

test("EventDispatcher: unknown event → unrouted", async () => {
  const dispatcher = new EventDispatcher();
  const unknown = normalizeEvent({ id: "unknown-dev", transport: "hid", path: "?" }, { type: 99, code: 99, value: 0 });
  const result = await dispatcher.dispatch(unknown);

  assert.equal(result.state, "error");
  assert.equal(result.error, "no_route");
});

// ─── Summary ───────────────────────────────────

console.log("\n✓ Pipeline tests complete");
