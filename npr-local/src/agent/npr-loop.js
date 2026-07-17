// @addr 10.06.0.0 | fd00:npr:0006:000::0 — NPR Loop
// ═══════════════════════════════════════════════════
// Noise → Pattern → Return
// Full cycle with scheduler, pattern validation, and correction.
// ═══════════════════════════════════════════════════

const EventEmitter = require('events');

// @addr 10.06.0.1 | fd00:npr:0006:000::1 — default toHex
function toHex(n) {
  if (typeof n !== 'number') return '0x0000';
  return '0x' + Math.abs(Math.floor(n)).toString(16).toUpperCase();
}

// @addr 10.06.1.0 | fd00:npr:0006:001::0 — NPRLoop
class NPRLoop extends EventEmitter {
  /**
   * @param {{
   *   scheduler: object,
   *   patternValidator: object,
   *   returnBuilder: object,
   *   noiseCollectors?: object[],
   *   maxIterationsHex?: number,
   * }} opts
   */
  constructor({
    scheduler,
    patternValidator,
    returnBuilder,
    noiseCollectors = [],
    maxIterationsHex = 0x05,
  } = {}) {
    super();
    this.scheduler = scheduler;
    this.patternValidator = patternValidator;
    this.returnBuilder = returnBuilder;
    this.noiseCollectors = noiseCollectors;
    this.maxIterationsHex = maxIterationsHex;
  }

  // @addr 10.06.1.1 | fd00:npr:0006:001::1 — collect noise evidence
  async collectNoise(input, sessionId) {
    const noise = {
      session_id: sessionId,
      input,
      context_blocks: [],
      timestamp: Date.now(),
    };

    // parallel, non-blocking collector calls
    const results = await Promise.allSettled(
      this.noiseCollectors.map(c => c.collect(noise)),
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        Object.assign(noise, r.value);
      }
    }

    return noise;
  }

  // @addr 10.06.1.2 | fd00:npr:0006:001::2 — build prompt from noise
  buildMessages(noise) {
    const blocks = (noise.context_blocks ?? []).map(b => b.text).join('\n\n');

    return [
      { role: 'system', content: 'NPR inference context.' },
      { role: 'user', content: noise.input },
      ...(blocks ? [{ role: 'user', content: `Context:\n${blocks}` }] : []),
    ];
  }

  // @addr 10.06.1.3 | fd00:npr:0006:001::3 — validate candidate pattern
  validatePattern(candidate) {
    if (this.patternValidator?.validate) {
      return this.patternValidator.validate(candidate);
    }

    // fallback: non-empty string = valid
    return {
      valid: typeof candidate === 'string' && candidate.length > 0,
      sutra_hex: '0x0107',
    };
  }

  // @addr 10.06.1.4 | fd00:npr:0006:001::4 — main cycle
  async run(input, sessionId, signal) {
    const events = [];
    const cycles = [];

    // 0. Collect noise
    const noise = await this.collectNoise(input, sessionId);
    events.push({ type: 'noise_collected', ts: Date.now() });

    // 1. Iterate: inference → validate → correct if needed
    for (let i = 0; i < this.maxIterationsHex; i++) {
      const iterationHex = toHex(i);

      events.push({
        type: 'iteration_start',
        iteration_hex: iterationHex,
        ts: Date.now(),
      });

      // 1a. Build messages (add previous failed attempts for correction)
      const correctionContext = cycles.length > 0
        ? `\nPrevious attempts failed validation. Context so far:\n${cycles.map(c => c.content).join('\n---\n')}`
        : '';

      const messages = this.buildMessages({
        ...noise,
        input: noise.input + correctionContext,
      });

      // 1b. Inference via scheduler (queued, not direct)
      let candidate;
      try {
        const result = await this.scheduler.enqueue({
          sessionId,
          messages,
          priorityHex: 0x40,
          signal,
        });

        candidate = result.content ?? result ?? '';
      } catch (err) {
        // inference failed — return with error
        return this.returnBuilder.createFailedReturn({
          cycles,
          reason: 'INFERENCE_FAILED',
          noise,
        });
      }

      // 1c. Pattern validation
      const pattern = this.validatePattern(candidate);

      cycles.push({
        iteration_hex: iterationHex,
        content: candidate,
        pattern,
      });

      events.push({
        type: 'pattern_result',
        iteration_hex: iterationHex,
        valid: pattern.valid,
        ts: Date.now(),
      });

      // 1d. Valid? Return immediately
      if (pattern.valid) {
        return this.returnBuilder.createReturn({
          noise,
          pattern,
          candidate,
          iterations: i + 1,
          events,
        });
      }

      // 1e. Invalid → next iteration (correction goes to back of queue)
      this.emit('correction_cycle', { iteration: i, session_id: sessionId });
    }

    // Exhausted iteration budget
    return this.returnBuilder.createFailedReturn({
      cycles,
      reason: 'ITERATION_LIMIT',
      noise,
    });
  }
}

module.exports = { NPRLoop };
