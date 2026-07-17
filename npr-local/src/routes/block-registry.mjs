// @net 10.03.0.0/24
// ─────────────────────────────────────────────────
// routes/block-registry.js — Block Address Registry
// ──────────────────────────────────────────────────
//
// Maps block addresses (10.x.y.z) to local modules.
// Bridges event layer ↔ workspace blocks.

export class BlockRegistry {
  constructor() {
    this.blocks = new Map();
  }

  // ─── Lookup ─────────────────────────────────

  get(address) {
    return this.blocks.get(address) ?? null;
  }

  has(address) {
    return this.blocks.has(address);
  }

  // ─── Mutation ───────────────────────────────

  register(block) {
    this.blocks.set(block.address, block);
    return this;
  }

  unregister(address) {
    return this.blocks.delete(address);
  }

  // ─── Query ──────────────────────────────────

  list() {
    return Object.fromEntries(this.blocks);
  }

  findByRoute(route) {
    for (const [, block] of this.blocks) {
      if (block.route === route) return block;
    }
    return null;
  }

  findByCapability(capability) {
    const result = [];
    for (const [addr, block] of this.blocks) {
      if (block.capabilities?.includes(capability)) {
        result.push({ address: addr, ...block });
      }
    }
    return result;
  }

  // ─── Default blocks ─────────────────────────

  loadDefaults() {
    const defaults = [
      {
        address:      "10.00.0.0",
        route:        "npr://0000/0000/0000",
        description:  "Null block — origin/return",
        capabilities: ["route.activate"],
        status:       "validated",
      },
      {
        address:      "10.07.2.1",
        route:        "npr://0007/0002/0001",
        module:       "./blocks/10.07.2.1/index.js",
        description:  "Workspace open",
        capabilities: ["workspace.read"],
        status:       "validated",
      },
      {
        address:      "10.07.2.2",
        route:        "npr://0007/0002/0002",
        module:       "./blocks/10.07.2.2/index.js",
        description:  "Audit toggle",
        capabilities: ["ui.navigate"],
        status:       "validated",
      },
    ];
    for (const block of defaults) {
      this.register(block);
    }
    return this;
  }
}
