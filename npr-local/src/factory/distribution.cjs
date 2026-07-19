/**
 * NPR Factory Distribution Layer
 * 
 * Routes validated output to the correct destination:
 * - Direct → return to caller
 * - Queue → push to message queue for async processing
 * - Slot → route to hexa slot for NPR cycle processing
 * - Chain → feed back into next factory step
 * 
 * Uses evaluation verdict to decide routing.
 */

class DistributionLayer {
  constructor(config = {}) {
    this.defaultRoute = config.defaultRoute || 'direct';
    this.slotMap = config.slotMap || {}; // Output type → hexa slot
    this.queueEmitter = null; // Optional: message queue reference
  }

  /**
   * Route output based on evaluation and config.
   * @param {string} output - Validated model output.
   * @param {Object} record - Full audit record.
   * @returns {Object} Distribution result.
   */
  distribute(output, record) {
    const verdict = record?.evaluation?.finalVerdict || 'pass';
    const route = this.selectRoute(output, record, verdict);
    
    let result = {
      route,
      rankingRule: this.getRankingRule(route),
      selectedOutput: output,
      filteredOutputs: [],
      metadata: {},
    };

    // Apply route-specific logic
    switch (route) {
      case 'direct':
        result.metadata.deliveredAt = new Date().toISOString();
        break;

      case 'queue':
        result = this.enqueue(output, record, result);
        break;

      case 'slot':
        result = this.routeToSlot(output, record, result);
        break;

      case 'chain':
        result.metadata.chainTarget = this.resolveChainTarget(output, record);
        break;

      case 'reject':
        result.selectedOutput = this.rejectMessage(verdict, record);
        result.metadata.rejected = true;
        break;
    }

    return result;
  }

  selectRoute(output, record, verdict) {
    // Failed evaluation → reject
    if (verdict === 'fail') return 'reject';

    // Check if output signals a specific route
    const outputType = this.detectOutputType(output);
    if (outputType in this.slotMap) return 'slot';

    // Check if output contains queue directives
    if (this.hasQueueDirective(output)) return 'queue';

    // Default route
    return this.defaultRoute;
  }

  detectOutputType(output) {
    // Simple heuristic-based type detection
    if (/```(?:json|js|cjs|mjs)/.test(output)) return 'code';
    if (/<tool_call>.*<\/\?>/.test(output)) return 'tool-call';
    if (/^```(?:\w+)?\n[\s\S]*```$/.test(output)) return 'fenced';
    return 'text';
  }

  hasQueueDirective(output) {
    return /@queue|async:|defer:/.test(output);
  }

  enqueue(output, record, result) {
    if (this.queueEmitter) {
      this.queueEmitter.push({
        type: 'factory_output',
        output,
        runId: record.runId,
        timestamp: new Date().toISOString(),
      });
    }
    result.metadata.queuedAt = new Date().toISOString();
    result.metadata.queueType = 'async';
    return result;
  }

  routeToSlot(output, record, result) {
    const slot = this.assignSlot(output);
    result.route = `slot:${slot}`;
    result.metadata.hexaSlot = slot;
    result.metadata.routedAt = new Date().toISOString();
    return result;
  }

  assignSlot(output) {
    const type = this.detectOutputType(output);
    // Map to NPR hexa slots
    const defaults = {
      'text': '0x10',   // Chat slot
      'code': '0x20',   // Code slot
      'tool-call': '0x00', // Control slot
      'fenced': '0x18',  // Memory slot
    };
    return this.slotMap[type] || defaults[type] || '0x10';
  }

  resolveChainTarget(output, record) {
    // Determine next step in processing chain
    const type = this.detectOutputType(output);
    if (type === 'tool-call') return 'tool-execution';
    if (type === 'code') return 'code-validation';
    return 'default';
  }

  rejectMessage(verdict, record) {
    const failures = record?.evaluation?.failures || [];
    return `[REJECTED] Evaluation failed: ${failures.join(', ')} (verdict: ${verdict})`;
  }

  getRankingRule(route) {
    const rules = {
      'direct': 'immediate-delivery',
      'queue': 'async-queue',
      'slot': 'hexa-routing',
      'chain': 'pipeline-continuation',
      'reject': 'evaluation-fail',
    };
    return rules[route] || 'default';
  }

  /**
   * Register a message queue for async routing.
   */
  setQueue(emitter) {
    this.queueEmitter = emitter;
  }

  /**
   * Register custom slot mappings.
   */
  setSlotMap(map) {
    this.slotMap = { ...this.slotMap, ...map };
  }
}

module.exports = DistributionLayer;
