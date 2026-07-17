// @net 10.05.0.0/24
// ────────────────────────────────────────────────
// health-registry.mjs — Runtime Topology & Health
// ────────────────────────────────────────────────
//
// Canonical block manifest → runtime health state.
// Pure status/topology layer. No agent-loop coupling.
//
// Status hierarchy:
//   healthy     = block OK
//   degraded    = dependency failed (block itself may still work)
//   failed      = block execution failed
//   offline     = subnet taken down by critical failure
//   fallback_active = block failed, fallback serving capability (degraded)
//
// Subnet states:
//   healthy     = all blocks healthy or degraded
//   degraded    = one+ blocks failed, no critical failure
//   offline     = critical block failed → entire subnet disabled
//
// System states:
//   healthy     = all subnets healthy
//   degraded    = one+ subnets degraded
//   critical    = root/core subnet offline
//
// @depends nothing (standalone)

const STATUS_FACTOR = {
  healthy: 1.0,
  degraded: 0.5,
  fallback_active: 0.5,
  failed: 0.0,
  offline: 0.0,
  disabled: 0.0,
};

// ─── Validation ────────────────────────────────

function validateBlockManifest(manifest) {
  const required = ["address", "subnet", "weight"];
  for (const field of required) {
    if (manifest[field] === undefined || manifest[field] === null) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  if (typeof manifest.weight !== "number" || manifest.weight <= 0) {
    throw new Error(`Invalid weight for ${manifest.address}: ${manifest.weight}`);
  }
  if (typeof manifest.subnet !== "string") {
    throw new Error(`Invalid subnet for ${manifest.address}: ${manifest.subnet}`);
  }
}

// Check if registering `newAddr` with these deps would create a cycle.
// Walks existing blocks to see if any dep transitively depends on newAddr.
function wouldCreateCycle(newAddr, depAddresses, registry) {
  if (depAddresses.includes(newAddr)) {
    return [newAddr, newAddr];
  }
  const visited = new Set();
  const queue = [...depAddresses];
  const path = [newAddr];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === newAddr) {
      return [...path, current];
    }
    if (visited.has(current)) continue;
    visited.add(current);

    const entry = registry.get(current);
    if (!entry) continue;

    const deps = entry.manifest.dependencies ?? [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        queue.push(dep);
        path.push(dep);
      }
    }
  }
  return null;
}

// ─── Health Registry ───────────────────────────

export class HealthRegistry {
  constructor() {
    this._blocks = new Map();       // address → { manifest, health }
    this._subnets = new Map();      // subnet → Set<address>
    this._events = [];              // audit trail
    this._maxEvents = 1000;
  }

  // ─── Registration ───────────────────────────

  /**
   * Register a block manifest. Rejects circular deps and invalid manifests.
   * @param {Object} manifest
   * @returns {HealthRegistry} this
   */
  registerBlock(manifest) {
    validateBlockManifest(manifest);

    const addr = manifest.address;
    if (this._blocks.has(addr)) {
      throw new Error(`Block ${addr} already registered`);
    }

    // Circular dependency check (handles forward refs)
    const deps = manifest.dependencies ?? [];
    const cycle = wouldCreateCycle(addr, deps, this._blocks);
    if (cycle) {
      throw new Error(`Circular dependency detected: ${cycle.join(" → ")}`);
    }

    const health = {
      status: "healthy",
      lastSuccessAt: null,
      lastFailureAt: null,
      failureCount: 0,
      successCount: 0,
      events: [],
      maxEvents: 100,
    };

    this._blocks.set(addr, {
      manifest: { ...manifest },
      health,
    });

    // Register in subnet
    if (!this._subnets.has(manifest.subnet)) {
      this._subnets.set(manifest.subnet, new Set());
    }
    this._subnets.get(manifest.subnet).add(addr);

    this._appendEvent({
      type: "register",
      address: addr,
      timestamp: Date.now(),
      detail: { subnet: manifest.subnet, weight: manifest.weight },
    });

    return this;
  }

  // ─── Health Reporting ───────────────────────

  /**
   * Record a successful block execution.
   * @param {string} address
   * @param {Object} [metadata]
   */
  success(address, metadata = {}) {
    const entry = this._blocks.get(address);
    if (!entry) {
      throw new Error(`Unknown block: ${address}`);
    }

    const { health, manifest } = entry;
    const prevStatus = health.status;

    // Recovery from failed/degraded → healthy
    health.status = "healthy";
    health.lastSuccessAt = Date.now();
    health.successCount++;
    if (health.failureCount > 0) {
      health.failureCount = 0; // Reset on recovery
    }

    this._appendBlockEvent(health, {
      type: "success",
      timestamp: Date.now(),
      from: prevStatus,
      to: "healthy",
      ...metadata,
    });

    // If we recovered, dependents may upgrade too
    this._cascadeHealth(address, false);

    return this;
  }

  /**
   * Record a block failure.
   * @param {string} address
   * @param {Error|string} [error]
   * @param {Object} [metadata]
   */
  failure(address, error, metadata = {}) {
    const entry = this._blocks.get(address);
    if (!entry) {
      throw new Error(`Unknown block: ${address}`);
    }

    const { health, manifest } = entry;
    const prevStatus = health.status;

    const errorMsg = error instanceof Error ? error.message : String(error ?? "unknown");

    health.lastFailureAt = Date.now();
    health.failureCount++;

    // Check if fallback exists and is healthy
    const fallbackAddr = manifest.fallback;
    const fallbackEntry = fallbackAddr ? this._blocks.get(fallbackAddr) : null;
    const fallbackHealthy = fallbackEntry && fallbackEntry.health.status === "healthy";

    if (fallbackHealthy) {
      health.status = "fallback_active";
    } else {
      health.status = "failed";
    }

    this._appendBlockEvent(health, {
      type: "failure",
      timestamp: Date.now(),
      from: prevStatus,
      to: health.status,
      error: errorMsg,
      fallback: fallbackAddr,
      fallbackActive: fallbackHealthy,
      ...metadata,
    });

    // Critical block → subnet offline
    if (manifest.critical) {
      this._takeOffline(manifest.subnet, address, errorMsg);
      return this;
    }

    // Cascade: dependents become degraded
    this._cascadeHealth(address, true);

    return this;
  }

  // ─── Queries ────────────────────────────────

  /**
   * Get health of a specific block.
   * @param {string} address
   * @returns {Object}
   */
  getBlockHealth(address) {
    const entry = this._blocks.get(address);
    if (!entry) {
      throw new Error(`Unknown block: ${address}`);
    }
    return this._blockHealthSnapshot(entry);
  }

  /**
   * Get health summary of a subnet.
   * @param {string} subnet
   * @returns {Object}
   */
  getSubnetHealth(subnet) {
    const addrs = this._subnets.get(subnet);
    if (!addrs) return null;

    const blocks = [];
    let totalWeight = 0;
    let activeWeight = 0;
    let hasCriticalFailure = false;

    let anyOffline = false;

    for (const addr of addrs) {
      const entry = this._blocks.get(addr);
      if (!entry) continue;

      const snapshot = this._blockHealthSnapshot(entry);
      blocks.push(snapshot);

      const w = entry.manifest.weight;
      totalWeight += w;

      if (entry.health.status === "offline") {
        anyOffline = true;
      } else {
        const factor = STATUS_FACTOR[entry.health.status] ?? 0;
        activeWeight += w * factor;
      }
    }

    // If any block is offline, the whole subnet was taken offline by critical failure
    let state;
    if (anyOffline) {
      state = "offline";
    } else if (blocks.every((b) => b.status === "healthy")) {
      state = "healthy";
    } else {
      state = "degraded";
    }

    return {
      subnet,
      state,
      operationalPercentage: totalWeight === 0 ? 0 : parseFloat(((activeWeight / totalWeight) * 100).toFixed(2)),
      blocks,
    };
  }

  /**
   * Get capability matrix across all blocks.
   * @returns {Object} { available, degraded, unavailable }
   */
  getCapabilityMatrix() {
    const capMap = new Map(); // capability → { bestStatus, providers }

    // Build set of blocks serving as fallbacks (for fallback_active primaries)
    const isFallbackProvider = new Set();
    for (const [addr, entry] of this._blocks) {
      if (entry.health.status === "fallback_active" && entry.manifest.fallback) {
        isFallbackProvider.add(entry.manifest.fallback);
      }
    }

    for (const [addr, entry] of this._blocks) {
      const caps = entry.manifest.capabilities ?? [];
      for (const cap of caps) {
        if (!capMap.has(cap)) {
          capMap.set(cap, { bestStatus: "unavailable", providers: [] });
        }
        const capEntry = capMap.get(cap);
        const rawStatus = entry.health.status;

        // Effective status: fallback_active → degraded; fallback provider → degraded
        let effectiveStatus = rawStatus;
        if (rawStatus === "fallback_active") {
          effectiveStatus = "degraded";
        } else if (isFallbackProvider.has(addr)) {
          effectiveStatus = "degraded";
        }

        capEntry.providers.push({ address: addr, status: rawStatus });

        const currentRank = _statusRank(effectiveStatus);
        const newRank = _statusRank(effectiveStatus);
        if (newRank > _statusRank(capEntry.bestStatus)) {
          capEntry.bestStatus = effectiveStatus;
        }
      }
    }

    const available = [];
    const degraded = [];
    const unavailable = [];

    for (const [cap, info] of capMap) {
      if (info.bestStatus === "healthy") {
        available.push(cap);
      } else if (info.bestStatus === "fallback_active" || info.bestStatus === "degraded") {
        degraded.push(cap);
      } else {
        unavailable.push(cap);
      }
    }

    return { available, degraded, unavailable };
  }

  /**
   * Get full system health report.
   * @returns {Object}
   */
  getSystemReport() {
    const subnetReports = [];
    let globalTotalWeight = 0;
    let globalActiveWeight = 0;
    let hasCriticalFailure = false;

    const failedBlocks = [];
    const degradedBlocks = [];
    const fallbacksActive = [];

    for (const [subnet, addrs] of this._subnets) {
      const report = this.getSubnetHealth(subnet);
      if (!report) continue;
      subnetReports.push(report);

      if (report.state === "offline") {
        hasCriticalFailure = true;
      } else {
        // Calculate weights for non-offline subnets
        for (const block of report.blocks) {
          globalTotalWeight += block.weight;
          const factor = STATUS_FACTOR[block.status] ?? 0;
          globalActiveWeight += block.weight * factor;
        }
      }

      for (const block of report.blocks) {
        if (block.status === "failed") failedBlocks.push(block.address);
        else if (block.status === "degraded") degradedBlocks.push(block.address);
        else if (block.status === "fallback_active") fallbacksActive.push(block.address);
      }
    }

    const capabilities = this.getCapabilityMatrix();
    const operationalPercentage = globalTotalWeight === 0
      ? 0
      : parseFloat(((globalActiveWeight / globalTotalWeight) * 100).toFixed(2));

    const state = hasCriticalFailure ? "critical" : failedBlocks.length > 0 ? "degraded" : "healthy";

    return {
      state,
      operationalPercentage,
      subnets: Object.fromEntries(subnetReports.map((r) => [r.subnet, {
        state: r.state,
        operationalPercentage: r.operationalPercentage,
      }])),
      capabilities,
      failedBlocks,
      degradedBlocks,
      fallbacksActive,
      totalBlocks: this._blocks.size,
      eventCount: this._events.length,
    };
  }

  /**
   * Get recent health events.
   * @param {number} [limit=20]
   * @returns {Array}
   */
  getEvents(limit = 20) {
    return this._events.slice(-limit);
  }

  // ─── Internal ────────────────────────────────

  _cascadeHealth(address, isFailure) {
    // Find all blocks that depend on `address`
    for (const [depAddr, entry] of this._blocks) {
      const deps = entry.manifest.dependencies ?? [];
      if (!deps.includes(address)) continue;

      const health = entry.health;
      const prevStatus = health.status;

      if (isFailure) {
        // Dependency failed → this block degrades (unless already worse)
        if (health.status === "healthy") {
          health.status = "degraded";
          this._appendBlockEvent(health, {
            type: "cascade_degrade",
            timestamp: Date.now(),
            from: prevStatus,
            to: "degraded",
            cause: address,
          });
        }
      } else {
        // Dependency recovered → check if all deps are healthy
        const allDepsHealthy = deps.every((d) => {
          const depEntry = this._blocks.get(d);
          return depEntry && depEntry.health.status === "healthy";
        });
        if (allDepsHealthy && health.status === "degraded") {
          health.status = "healthy";
          this._appendBlockEvent(health, {
            type: "cascade_recover",
            timestamp: Date.now(),
            from: prevStatus,
            to: "healthy",
            cause: address,
          });
        }
      }
    }
  }

  _takeOffline(subnet, failedAddress, reason) {
    const addrs = this._subnets.get(subnet);
    if (!addrs) return;

    for (const addr of addrs) {
      const entry = this._blocks.get(addr);
      if (!entry) continue;
      if (entry.health.status === "offline") continue;

      const prevStatus = entry.health.status;
      entry.health.status = "offline";

      this._appendBlockEvent(entry.health, {
        type: "subnet_offline",
        timestamp: Date.now(),
        from: prevStatus,
        to: "offline",
        subnet: subnet,
        criticalFailure: failedAddress,
        reason,
      });
    }

    this._appendEvent({
      type: "subnet_offline",
      timestamp: Date.now(),
      subnet,
      criticalBlock: failedAddress,
      reason,
    });
  }

  _blockHealthSnapshot(entry) {
    const { manifest, health } = entry;
    return {
      address: manifest.address,
      subnet: manifest.subnet,
      route: manifest.route ?? null,
      weight: manifest.weight,
      critical: manifest.critical ?? false,
      status: health.status,
      dependencies: manifest.dependencies ?? [],
      fallback: manifest.fallback ?? null,
      capabilities: manifest.capabilities ?? [],
      failureCount: health.failureCount,
      successCount: health.successCount,
      lastSuccessAt: health.lastSuccessAt,
      lastFailureAt: health.lastFailureAt,
    };
  }

  _appendBlockEvent(health, event) {
    health.events.push(event);
    if (health.events.length > health.maxEvents) {
      health.events.shift();
    }
  }

  _appendEvent(event) {
    this._events.push(event);
    if (this._events.length > this._maxEvents) {
      this._events.shift();
    }
  }

  // ─── Reset (for testing) ────────────────────

  reset() {
    this._blocks.clear();
    this._subnets.clear();
    this._events = [];
    return this;
  }
}

// ─── Helpers ───────────────────────────────────

function _statusRank(status) {
  // Higher = better. Used for capability best-status comparison.
  const ranks = {
    healthy: 4,
    fallback_active: 3,
    degraded: 2,
    failed: 1,
    offline: 0,
    disabled: 0,
  };
  return ranks[status] ?? -1;
}
