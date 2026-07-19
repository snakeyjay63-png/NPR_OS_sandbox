// @addr 10.05.0.0 | fd00:npr:0005:000::0 — Tool Loop Guard
// ═══════════════════════════════════════════════════════
// Detect and prevent infinite tool-call loops.
//
// Strategies:
//   1. Hash-based exact repetition (same tool + args)
//   2. Sliding window pattern detection
//   3. Ping-pong detection (A→B→A→B)
//   4. Stagnation detection (no new content)
//
// Escalation:
//   warning → block → reflect → halt
// ═══════════════════════════════════════════════════════

/**
 * ToolLoopGuard — detect and prevent agent tool-call loops.
 *
 * @param {object} opts
 * @param {number} [opts.windowSize=10] — sliding window depth
 * @param {number} [opts.maxRepeat=3] — max times same call before warning
 * @param {number} [opts.maxPingPong=3] — max A→B→A cycles before block
 * @param {number} [opts.maxTotalCalls=30] — absolute tool-call ceiling
 * @param {string} [opts.mode='warn|block|reflect|halt'] — escalation mode
 */
class ToolLoopGuard {
  constructor({
    windowSize = 10,
    maxRepeat = 3,
    maxPingPong = 3,
    maxTotalCalls = 30,
    mode = 'block',
  } = {}) {
    this.windowSize = windowSize;
    this.maxRepeat = maxRepeat;
    this.maxPingPong = maxPingPong;
    this.maxTotalCalls = maxTotalCalls;
    this.mode = mode;

    // Internal state
    this.callHistory = [];  // [{ hash, name, args, ts }]
    this.totalCalls = 0;
    this.warnings = [];
  }

  /**
   * Check a tool call before execution.
   * Returns { allowed, reason, action } — if not allowed, don't execute.
   */
  checkBefore(toolName, toolArgs) {
    this.totalCalls++;

    // Hard ceiling
    if (this.totalCalls > this.maxTotalCalls) {
      return {
        allowed: false,
        reason: `tool_call_limit`,
        action: 'halt',
        message: `Hard limit: ${this.maxTotalCalls} total tool calls reached`,
        detail: { totalCalls: this.totalCalls, limit: this.maxTotalCalls },
      };
    }

    const hash = this._hash(toolName, toolArgs);

    // Exact repetition check
    const repeatCount = this.callHistory.filter(
      c => c.hash === hash
    ).length;

    if (repeatCount >= this.maxRepeat) {
      const warning = {
        type: 'exact_repeat',
        tool: toolName,
        count: repeatCount,
        ts: Date.now(),
      };
      this.warnings.push(warning);

      if (this.mode === 'halt') {
        return {
          allowed: false,
          reason: `exact_repeat_halt`,
          action: 'halt',
          message: `Same tool call repeated ${repeatCount}×: ${toolName}(${toolArgs})`,
          detail: warning,
        };
      }

      if (this.mode === 'block') {
        return {
          allowed: false,
          reason: `exact_repeat_blocked`,
          action: 'block',
          message: `Blocked repeated tool call (${repeatCount}×): ${toolName}(${toolArgs})`,
          detail: warning,
          reflectPrompt: `You called "${toolName}" with the same args ${repeatCount} times. This is not producing new results. Consider a different approach.`,
        };
      }

      if (this.mode === 'reflect') {
        return {
          allowed: true,
          reason: 'exact_repeat_warning',
          action: 'reflect',
          message: `Warning: ${toolName}(${toolArgs}) called ${repeatCount}× — consider alternatives`,
          detail: warning,
          reflectPrompt: `⚠ This tool call has been made ${repeatCount} times. Is this productive?`,
        };
      }

      // warn mode: allow but log
      return {
        allowed: true,
        reason: 'exact_repeat_warned',
        action: 'warn',
        message: `⚠ ${toolName}(${toolArgs}) called ${repeatCount}×`,
        detail: warning,
      };
    }

    // Ping-pong detection (A→B→A→B pattern)
    const pingPong = this._detectPingPong(hash, toolName);
    if (pingPong) {
      const warning = {
        type: 'ping_pong',
        pattern: pingPong.pattern,
        count: pingPong.count,
        ts: Date.now(),
      };
      this.warnings.push(warning);

      if (this.mode === 'halt' || this.mode === 'block') {
        return {
          allowed: false,
          reason: 'ping_pong_detected',
          action: this.mode === 'halt' ? 'halt' : 'block',
          message: `Ping-pong loop detected: ${pingPong.pattern.join(' ↔ ')} (${pingPong.count}×)`,
          detail: warning,
          reflectPrompt: pingPong.reflectPrompt,
        };
      }
    }

    // Stagnation detection — same tool without arg variation
    const recent = this.callHistory.slice(-this.windowSize);
    const sameTool = recent.filter(c => c.name === toolName && c.hash !== hash).length;
    if (sameTool >= this.windowSize * 0.7) {
      return {
        allowed: true,
        reason: 'tool_stagnation',
        action: 'warn',
        message: `⚠ Tool stagnation: ${toolName} dominates recent calls (${sameTool}/${recent.length})`,
        detail: { tool: toolName, sameTool, windowSize: recent.length },
      };
    }

    return { allowed: true, reason: 'ok' };
  }

  /**
   * Record a tool call after execution.
   */
  record(toolName, toolArgs) {
    const hash = this._hash(toolName, toolArgs);
    this.callHistory.push({ hash, name: toolName, args: toolArgs, ts: Date.now() });

    // Keep window bounded
    if (this.callHistory.length > this.windowSize * 2) {
      this.callHistory = this.callHistory.slice(-this.windowSize);
    }
  }

  /**
   * Get current state for debugging / reporting.
   */
  getState() {
    return {
      totalCalls: this.totalCalls,
      windowSize: this.callHistory.length,
      recentCalls: this.callHistory.slice(-5).map(c => `${c.name}(${c.args.slice(0, 30)})`),
      warnings: this.warnings.length,
      lastWarning: this.warnings[this.warnings.length - 1],
    };
  }

  /**
   * Reset guard state (new loop / new session).
   */
  reset() {
    this.callHistory = [];
    this.totalCalls = 0;
    this.warnings = [];
  }

  // ─── Internal ───

  _hash(name, args) {
    const crypto = require('crypto');
    const normalized = `${(name||'').toLowerCase().trim()}:${(args||'').toLowerCase().trim()}`;
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  _detectPingPong(currentHash, currentName) {
    const recent = this.callHistory.slice(-this.windowSize);
    if (recent.length < 4) return null;

    // Build tool name sequence
    const sequence = [...recent.map(c => c.name), currentName];
    const hashes = [...recent.map(c => c.hash), currentHash];

    // Detect A→B→A→B pattern
    const uniqueTools = [...new Set(sequence)];
    if (uniqueTools.length !== 2) return null;

    const [a, b] = uniqueTools;
    let pingPongCount = 0;
    for (let i = 1; i < sequence.length; i++) {
      if ((sequence[i] === a && sequence[i-1] === b) ||
          (sequence[i] === b && sequence[i-1] === a)) {
        pingPongCount++;
      }
    }

    const ratio = pingPongCount / (sequence.length - 1);
    if (ratio >= 0.7 && pingPongCount >= this.maxPingPong) {
      return {
        pattern: [a, b],
        count: pingPongCount,
        reflectPrompt: `You are oscillating between "${a}" and "${b}". This loop is not productive. Step back and reconsider your approach.`,
      };
    }

    return null;
  }
}

module.exports = { ToolLoopGuard };
