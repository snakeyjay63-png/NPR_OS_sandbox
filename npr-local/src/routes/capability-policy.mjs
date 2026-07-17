// @net 10.03.1.0/24
// ─────────────────────────────────────────────────
// routes/capability-policy.js — Capability Authorization
// ───────────────────────────────────────────────────────
//
// Enforces the boundary between event layer and tool routing.
// Every route declares what capability it needs.

// ─── Capability definitions ───────────────────

const CAPABILITIES = {
  "workspace.read":     { description: "Read workspace files/blocks",      risk: "low" },
  "workspace.write":    { description: "Write workspace files/blocks",     risk: "medium" },
  "memory.append":      { description: "Append to memory files",           risk: "medium" },
  "route.activate":     { description: "Activate/deactivate routes",       risk: "low" },
  "ui.navigate":        { description: "Navigate UI/pages",                risk: "low" },
  "agent.invoke":       { description: "Invoke agent/LLM",                 risk: "medium" },
  "process.status":     { description: "Query process/system status",      risk: "low" },
  "process.exec":       { description: "Execute shell commands",           risk: "high" },
  "network.bind":       { description: "Bind network sockets",             risk: "high" },
  "system.config":      { description: "Modify system configuration",      risk: "high" },
};

// ─── Policy ───────────────────────────────────

export class CapabilityPolicy {
  constructor(options = {}) {
    this.allowed  = options.allowed  ?? new Set(Object.keys(CAPABILITIES));
    this.denied   = options.denied   ?? new Set();
    this.log      = options.log      ?? null;
  }

  // ─── Authorize ──────────────────────────────

  authorize(block, route) {
    const cap = route.capability;
    if (!cap) return false;
    if (this.denied.has(cap)) return false;
    if (!this.allowed.has(cap)) return false;

    // Block must declare the capability
    if (!block.capabilities?.includes(cap)) {
      this._log?.("deny", { block: block.address, capability: cap, reason: "not_declared" });
      return false;
    }

    return true;
  }

  // ─── Mutation ───────────────────────────────

  allow(capability) {
    if (!CAPABILITIES[capability]) {
      throw new Error(`Unknown capability: ${capability}`);
    }
    this.allowed.add(capability);
    this.denied.delete(capability);
    return this;
  }

  deny(capability) {
    this.denied.add(capability);
    this.allowed.delete(capability);
    return this;
  }

  // ─── Query ──────────────────────────────────

  list() {
    return {
      definitions: CAPABILITIES,
      allowed: [...this.allowed],
      denied:  [...this.denied],
    };
  }
}
