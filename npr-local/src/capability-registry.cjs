// @net 10.03.0.0/24
// ═══════════════════════════════════════════════════
// capability-registry.cjs — Dynamic tool + capability management
// ═══════════════════════════════════════════════════
//
// Tools declare required capabilities. Capabilities have risk levels.
// Policy engine enforces allow/deny lists.
// Dynamic loading from tools/ directory + runtime registration.
// ═══════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// ─── Capability definitions ──────────────────────

const CAPABILITIES = Object.freeze({
  'workspace.read':     { description: 'Read workspace files',           risk: 'low' },
  'workspace.write':    { description: 'Write workspace files',          risk: 'medium' },
  'memory.append':      { description: 'Append to memory files',         risk: 'medium' },
  'route.activate':     { description: 'Activate/deactivate routes',     risk: 'low' },
  'ui.navigate':        { description: 'Navigate UI/pages',              risk: 'low' },
  'agent.invoke':       { description: 'Invoke agent/LLM',               risk: 'medium' },
  'process.status':     { description: 'Query process/system status',    risk: 'low' },
  'process.exec':       { description: 'Execute shell commands',         risk: 'high' },
  'network.bind':       { description: 'Bind network sockets',           risk: 'high' },
  'system.config':      { description: 'Modify system configuration',    risk: 'high' },
  'network.fetch':      { description: 'Fetch external URLs',            risk: 'medium' },
  'tool.capabilities':  { description: 'Query tool/capability registry', risk: 'low' },
  'hex.encode':         { description: 'Hex encode/decode',              risk: 'low' },
  'plc.parse':          { description: 'Parse PLC/ST/Ladder code',       risk: 'low' },
  'queue.enqueue':      { description: 'Enqueue async jobs',             risk: 'low' },
});

// ─── Tool Registry ──────────────────────────────────────

class ToolRegistry {
  constructor() {
    this._tools = new Map();
    this._policy = {
      allowed: new Set(Object.keys(CAPABILITIES)),
      denied: new Set(),
    };
    this._loadBuiltins();
    this._loadDynamic();
  }

  // ─── Built-in tools (hardcoded in loop.js) ───────────

  _loadBuiltins() {
    const builtins = [
      { name: 'scan', capabilities: ['process.status'] },
      { name: '00', capabilities: ['ui.navigate'] },
      { name: 'select', capabilities: ['route.activate'] },
      { name: 'capabilities', capabilities: ['tool.capabilities'] },
      { name: 'workspace', capabilities: ['workspace.read'] },
      { name: 'read', capabilities: ['workspace.read'] },
      { name: 'write', capabilities: ['workspace.write'] },
      { name: 'edit', capabilities: ['workspace.write'] },
      { name: 'web-fetch', capabilities: ['network.fetch'] },
      { name: 'echo', capabilities: ['ui.navigate'] },
      { name: 'memory', capabilities: ['memory.append'] },
      { name: 'exec', capabilities: ['process.exec'] },
      { name: 'hex_encode', capabilities: ['hex.encode'] },
      { name: 'npr_trace', capabilities: ['route.activate'] },
    ];

    for (const tool of builtins) {
      this._tools.set(tool.name, {
        name: tool.name,
        source: 'builtin',
        capabilities: tool.capabilities,
        description: `Built-in tool: ${tool.name}`,
        handler: null, // resolved at runtime by loop.js
        enabled: true,
      });
    }
  }

  // ─── Dynamic loading from tools/ directory ────────────

  _loadDynamic() {
    const toolsDir = path.join(__dirname, '..', 'tools');
    if (!fs.existsSync(toolsDir)) return;

    for (const file of fs.readdirSync(toolsDir)) {
      if (!file.endsWith('.cjs') && !file.endsWith('.js')) continue;
      const filePath = path.join(toolsDir, file);
      try {
        const mod = require(filePath);
        if (mod.name && mod.capabilities) {
          this._tools.set(mod.name, {
            name: mod.name,
            source: 'dynamic',
            file: filePath,
            capabilities: mod.capabilities || [],
            description: mod.description || `Dynamic tool: ${mod.name}`,
            handler: mod.handler || mod.execute || mod,
            enabled: true,
            metadata: mod.metadata || {},
          });
        }
      } catch (e) {
        console.warn(`[tools] Failed to load ${file}: ${e.message}`);
      }
    }
  }

  // ─── Public API ──────────────────────────────────────

  register(tool) {
    if (!tool.name || !tool.capabilities) {
      throw new Error('Tool must have name and capabilities[]');
    }
    this._tools.set(tool.name, {
      ...tool,
      source: tool.source || 'runtime',
      enabled: true,
    });
    return this;
  }

  unregister(name) {
    return this._tools.delete(name);
  }

  get(name) {
    return this._tools.get(name);
  }

  list(filter) {
    const result = [];
    for (const tool of this._tools.values()) {
      // Check capability authorization
      if (!this._isAuthorized(tool.capabilities)) continue;
      // Apply filters
      if (filter?.risk && !this._hasRisk(tool.capabilities, filter.risk)) continue;
      if (filter?.source && tool.source !== filter.source) continue;
      if (filter?.enabled !== undefined && tool.enabled !== filter.enabled) continue;
      result.push(this._summary(tool));
    }
    return result;
  }

  available() {
    return this.list().map(t => t.name);
  }

  // ─── Policy ──────────────────────────────────────────

  allow(capability) {
    if (!CAPABILITIES[capability]) return false;
    this._policy.allowed.add(capability);
    this._policy.denied.delete(capability);
    return true;
  }

  deny(capability) {
    this._policy.denied.add(capability);
    this._policy.allowed.delete(capability);
    return true;
  }

  policy() {
    return {
      definitions: CAPABILITIES,
      allowed: [...this._policy.allowed],
      denied: [...this._policy.denied],
    };
  }

  // ─── Authorization check ─────────────────────────────

  canUseTool(name) {
    const tool = this._tools.get(name);
    if (!tool) return false;
    if (!tool.enabled) return false;
    return this._isAuthorized(tool.capabilities);
  }

  _isAuthorized(capabilities) {
    for (const cap of capabilities) {
      if (this._policy.denied.has(cap)) return false;
      if (!this._policy.allowed.has(cap)) return false;
    }
    return true;
  }

  // ─── Helpers ─────────────────────────────────────────

  _hasRisk(capabilities, level) {
    const riskOrder = { low: 1, medium: 2, high: 3 };
    const threshold = riskOrder[level] ?? 3;
    for (const cap of capabilities) {
      const def = CAPABILITIES[cap];
      if (def && (riskOrder[def.risk] ?? 0) <= threshold) return true;
    }
    return false;
  }

  _summary(tool) {
    return {
      name: tool.name,
      source: tool.source,
      capabilities: tool.capabilities,
      maxRisk: this._maxRisk(tool.capabilities),
      description: tool.description,
      enabled: tool.enabled,
    };
  }

  _maxRisk(capabilities) {
    const riskOrder = { low: 1, medium: 2, high: 3 };
    let max = 0;
    for (const cap of capabilities) {
      const def = CAPABILITIES[cap];
      if (def) max = Math.max(max, riskOrder[def.risk] ?? 0);
    }
    return { low: 'low', medium: 'medium', high: 'high' }[max] || 'unknown';
  }
}

module.exports = { CAPABILITIES, ToolRegistry };
