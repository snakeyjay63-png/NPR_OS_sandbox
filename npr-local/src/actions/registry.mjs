// @net 10.04.0.0/24
// ─────────────────────────────────────────────────
// actions/registry.js — Action Registry
// ─────────────────────────────────────────────────
//
// Maps action names to executable handlers.
// Direct actions bypass the agent/LLM.

export class ActionRegistry {
  constructor() {
    this.actions = new Map();
  }

  // ─── Lookup ─────────────────────────────────

  get(name) {
    return this.actions.get(name) ?? null;
  }

  has(name) {
    return this.actions.has(name);
  }

  // ─── Mutation ───────────────────────────────

  register(name, handler) {
    this.actions.set(name, handler);
    return this;
  }

  unregister(name) {
    return this.actions.delete(name);
  }

  // ─── Query ──────────────────────────────────

  list() {
    const result = [];
    for (const [name, { description }] of this.actions) {
      result.push({ name, description });
    }
    return result;
  }

  // ─── Built-in actions ───────────────────────

  loadBuiltins() {
    this.register("workspace.open", {
      description: "Open a workspace block or file by address",
      handler: async (args) => {
        return { ok: true, address: args.address, file: `workspace/blocks/${args.address}/index.js` };
      },
    });

    this.register("audit.toggle", {
      description: "Toggle audit visibility",
      handler: async (args) => {
        return { ok: true, action: "audit.toggle" };
      },
    });

    this.register("npr.null", {
      description: "Return to null state",
      handler: async () => {
        return { ok: true, address: "10.00.0.0" };
      },
    });

    this.register("status.query", {
      description: "Query system/process status",
      handler: async (args) => {
        return { ok: true, pid: process.pid, uptime: process.uptime() };
      },
    });

    return this;
  }
}
