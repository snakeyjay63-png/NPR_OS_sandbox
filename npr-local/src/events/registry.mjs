// @net 10.02.1.0/24
// ─────────────────────────────────────────────────
// events/registry.js — Event → Block Route Map
// ─────────────────────────────────────────────────
//
// Maps normalized events to block addresses and actions.
// Key format: "deviceId:type:code:value"
//
// This is the /sec specification in code form.

// ─── Default registry ───────────────────────────

const DEFAULT_REGISTRY = {
  "npr-control:1:30:1": {
    address:    "10.07.2.1",
    route:      "npr://0007/0002/0001",
    action:     "workspace.open",
    capability: "workspace.read",
    mode:       "direct",
  },
  "npr-control:1:28:1": {
    address:    "10.07.2.2",
    route:      "npr://0007/0002/0002",
    action:     "audit.toggle",
    capability: "ui.navigate",
    mode:       "direct",
  },
  "npr-control:1:16:1": {
    address:    "10.00.0.0",
    route:      "npr://0000/0000/0000",
    action:     "npr.null",
    capability: "route.activate",
    mode:       "direct",
  },
};

// ─── Registry class ─────────────────────────────

export class EventRegistry {
  constructor(initial = {}) {
    this.routes = new Map([...Object.entries(DEFAULT_REGISTRY), ...Object.entries(initial)]);
  }

  // ─── Resolve ────────────────────────────────

  resolve(event) {
    const key = [
      event.source.deviceId,
      event.signal.type,
      event.signal.code,
      event.signal.value,
    ].join(":");

    return this.routes.get(key) ?? null;
  }

  // ─── Mutation ───────────────────────────────

  add(key, route) {
    this.routes.set(key, route);
    return this;
  }

  remove(key) {
    return this.routes.delete(key);
  }

  list() {
    return Object.fromEntries(this.routes);
  }

  // ─── Key helpers ────────────────────────────

  static key(deviceId, type, code, value) {
    return [deviceId, type, code, value].join(":");
  }
}

export function resolveEventRoute(event, registry) {
  return registry.resolve(event);
}
