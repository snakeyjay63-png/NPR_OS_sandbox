// @net 10.02.2.0/24
// ─────────────────────────────────────────────────
// events/dispatcher.js — Event Dispatcher
// ─────────────────────────────────────────────────
//
// Receives normalized events and routes them through:
//   registry → block lookup → capability check → action
//
// Two modes:
//   direct  → immediate local action
//   agent   → forward to LLM for semantic interpretation

import { EventRegistry } from "./registry.mjs";
import { BlockRegistry } from "../routes/block-registry.mjs";
import { CapabilityPolicy } from "../routes/capability-policy.mjs";
import { ActionRegistry } from "../actions/registry.mjs";
import { executeAction } from "../actions/execute.mjs";

// ─── Dispatcher ─────────────────────────────────

export class EventDispatcher {
  constructor(options = {}) {
    this.eventRegistry   = options.eventRegistry   ?? new EventRegistry();
    this.blockRegistry   = options.blockRegistry   ?? new BlockRegistry().loadDefaults();
    this.capabilityPolicy= options.capabilityPolicy?? new CapabilityPolicy();
    this.actionRegistry  = options.actionRegistry  ?? new ActionRegistry().loadBuiltins();
    this.auditLog        = options.auditLog        ?? null;
    this.listeners       = [];
  }

  // ─── Dispatch pipeline ──────────────────────

  async dispatch(event) {
    const startedAt = process.hrtime.bigint();

    // 1. Resolve route
    const route = this.eventRegistry.resolve(event);
    if (!route) {
      event.state = "error";
      event.error = "no_route";
      this._audit(event, startedAt, null, null, "no_route");
      this._emit("unrouted", event);
      return event;
    }

    // 2. Block lookup
    const block = this.blockRegistry.get(route.address);
    if (!block) {
      event.state = "error";
      event.error = "unknown_block";
      this._audit(event, startedAt, route.address, null, "unknown_block");
      this._emit("unrouted", event);
      return event;
    }

    // 3. Capability check
    if (!this.capabilityPolicy.authorize(block, route)) {
      event.state = "error";
      event.error = "capability_denied";
      this._audit(event, startedAt, route.address, route.action, "denied");
      this._emit("denied", event);
      return event;
    }

    // 4. Execute based on mode
    event.state = "routed";
    event.block = route.address;
    event.action = route.action;

    try {
      if (route.mode === "agent") {
        await this._agentRoute(event, route, block);
      } else {
        await this._directRoute(event, route, block);
      }
      event.state = "executed";
    } catch (err) {
      event.state = "error";
      event.error = err.message;
    }

    this._audit(event, startedAt, route.address, route.action, event.state);
    this._emit("dispatched", event);
    return event;
  }

  // ─── Direct route ───────────────────────────

  async _directRoute(event, route, block) {
    const action = this.actionRegistry.get(route.action);
    if (!action) {
      throw new Error(`action_not_found: ${route.action}`);
    }
    return executeAction(action, route.arguments ?? {}, { event, block });
  }

  // ─── Agent route ────────────────────────────

  async _agentRoute(event, route, block) {
    // Build context from workspace
    const context = await this._buildAgentContext(event, block);

    // Forward to llama-server
    const response = await fetch("http://127.0.0.1:8765/completion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: route.prompt ?? "Analyseer het actieve blok",
        context: context,
        n_predict: 256,
      }),
    });

    const data = await response.json();
    event.agentResponse = data?.content ?? data?.completion ?? null;
    return event;
  }

  // ─── Context builder ────────────────────────

  async _buildAgentContext(event, block) {
    const addresses = event.contextAddresses ?? [event.block];
    const parts = [];
    for (const addr of addresses) {
      const b = this.blockRegistry.get(addr);
      if (b) parts.push(`[${addr}] ${b.description ?? addr}`);
    }
    return parts.join("\n") || "(no context)";
  }

  // ─── Audit ──────────────────────────────────

  _audit(event, startedAt, block, action, result) {
    if (!this.auditLog) return;
    const durationUs = Number(process.hrtime.bigint() - startedAt) / 1000;
    this.auditLog.write({
      eventId:   event.id,
      device:    event.source.deviceId,
      signal:    event.signal,
      block,
      action,
      result,
      durationUs,
    });
  }

  // ─── Events ─────────────────────────────────

  on(name, fn) {
    this.listeners.push({ name, fn });
  }

  _emit(name, event) {
    for (const { name: n, fn } of this.listeners) {
      if (n === name) fn(event);
    }
  }
}
