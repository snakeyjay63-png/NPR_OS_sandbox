// @addr 10.04.0.0 | fd00:npr:0004:000::0 — NPR Return Structure
// ═══════════════════════════════════════════════════
// Canonical NPR Return envelope.
// Every NPR-loop response shares this outer structure.
// Noise → Pattern → Return.
// ═══════════════════════════════════════════════════

const { nprRoute } = require('./npr');

// ─── Helpers ───

// @addr 10.04.2.0 | fd00:npr:0004:002::0 — halt reasons
const HALT_REASONS = {
  VALID_RETURN: 'VALID_RETURN',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  ITERATION_LIMIT: 'ITERATION_LIMIT',
  CONVERGENCE: 'CONVERGENCE',
  DIRECT: 'DIRECT',
};

// @addr 10.04.2.1 | fd00:npr:0004:002::1 — default iteration limits
const DEFAULT_MAX_ITERATIONS = 16;
const DEFAULT_CONVERGENCE_THRESHOLD = 0.01;

// @addr 10.04.0.1 | fd00:npr:0004:000::1 — hex from int
function toHex(n) {
  if (typeof n !== 'number') return '0x0000';
  return '0x' + Math.abs(Math.floor(n)).toString(16).toUpperCase();
}

// @addr 10.04.0.2 | fd00:npr:0004:000::2 — simple checksum (first 4 hex chars)
function checksumHex(str) {
  let h = 0x0000;
  for (let i = 0; i < Math.min(str.length, 64); i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return '0x' + (h & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

// ─── Canonical Return ───

// @addr 10.04.1.0 | fd00:npr:0004:001::0 — create canonical return
function createReturn({ noise, pattern, candidate, iterations, events = [], haltReason } = {}) {
  const route = noise?.route ?? nprRoute(noise?.input ?? '');

  // Determine halt reason if not explicitly provided
  const resolvedHalt = haltReason ?? (pattern?.valid ? HALT_REASONS.VALID_RETURN : HALT_REASONS.VALIDATION_FAILED);

  return {
    schema_hex: '0x0100',

    ok: pattern?.valid ?? false,

    route: {
      gateway_port_hex: '0x1388',  // 5000
      llama_port_hex: '0x223D',    // 8765
      openclaw_port_hex: '0x4965', // 18789
      npr: route,
    },

    noise: {
      session_id: noise?.session_id ?? 'unknown',
      input_checksum_hex: checksumHex(noise?.input ?? ''),
      context_blocks: noise?.context_blocks ?? [],
    },

    pattern: pattern ?? { sutra_hex: '0x0107', valid: false },

    return: {
      content: pattern?.valid ? candidate : null,
      iterations_hex: toHex(iterations ?? 0),
      halt_reason: resolvedHalt,
      events: events,
    },
  };
}

// ─── Failed Return (iteration limit, hard error) ───

// @addr 10.04.1.1 | fd00:npr:0004:001::1 — create failed return
function createFailedReturn({ cycles, reason = 'ITERATION_LIMIT', noise } = {}) {
  return {
    schema_hex: '0x0100',
    ok: false,

    route: {
      gateway_port_hex: '0x1388',
      llama_port_hex: '0x223D',
      openclaw_port_hex: '0x4965',
      npr: noise?.route ?? null,
    },

    noise: {
      session_id: noise?.session_id ?? 'unknown',
      input_checksum_hex: checksumHex(noise?.input ?? ''),
      context_blocks: noise?.context_blocks ?? [],
    },

    pattern: {
      sutra_hex: '0x0107',
      valid: false,
      cycles: cycles?.map(c => ({
        iteration_hex: c.iteration_hex,
        pratyaksha: c.pattern?.pratyaksha,
        anumana: c.pattern?.anumana,
        agama: c.pattern?.agama,
      })),
    },

    return: {
      content: null,
      iterations_hex: toHex(cycles?.length ?? 0),
      halt_reason: reason,
      events: [],
    },
  };
}

// ─── Lightweight Return (for non-NPR routes that need envelope) ───

// @addr 10.04.1.2 | fd00:npr:0004:001::2 — envelope without full NPR cycle
function envelope(content, { route, sessionId } = {}) {
  return {
    schema_hex: '0x0100',
    ok: true,
    route: route ?? null,
    noise: {
      session_id: sessionId ?? 'ad-hoc',
      input_checksum_hex: '0x0000',
      context_blocks: [],
    },
    pattern: { sutra_hex: '0x0107', valid: true },
    return: {
      content,
      iterations_hex: '0x0001',
      halt_reason: 'DIRECT',
      events: [],
    },
  };
}

// ─── NPR Iteration Loop ──────────────────────────

// @addr 10.04.2.2 | fd00:npr:0004:002::2 — run NPR iteration loop
/**
 * Run Noise→Pattern→Return iterations until convergence or limit.
 *
 * @param {object} opts - Options
 * @param {object} opts.noise - Initial noise input
 * @param {Function} [opts.patternFn] - Pattern extraction function (noise → pattern)
 * @param {Function} [opts.validateFn] - Validation function (pattern → boolean)
 * @param {Function} [opts.candidateFn] - Candidate builder (pattern, iteration → candidate)
 * @param {number} [opts.maxIterations=16] - Max iterations before forced halt
 * @param {number} [opts.convergenceThreshold=0.01] - Convergence threshold
 * @param {Function} [opts.convergenceFn] - Convergence check (prev, curr → delta)
 * @returns {object} Return envelope with iteration history
 */
function nprIterate({
  noise,
  patternFn,
  validateFn,
  candidateFn,
  maxIterations = DEFAULT_MAX_ITERATIONS,
  convergenceThreshold = DEFAULT_CONVERGENCE_THRESHOLD,
  convergenceFn,
} = {}) {
  const cycles = [];
  let prevCandidate = null;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Noise → Pattern
    const pattern = patternFn ? patternFn(noise, iter) : { valid: false };

    // Build candidate
    const candidate = candidateFn ? candidateFn(pattern, iter) : null;

    // Validate
    const valid = validateFn ? validateFn(pattern, candidate) : (pattern.valid ?? false);

    // Record cycle
    const cycle = {
      iteration: iter,
      iteration_hex: toHex(iter),
      pattern: pattern ?? {},
      candidate,
      valid,
    };
    cycles.push(cycle);

    // Check validation success
    if (valid) {
      return createReturn({
        noise,
        pattern,
        candidate,
        iterations: iter + 1,
        events: cycles.map(c => ({
          iteration_hex: c.iteration_hex,
          valid: c.valid,
        })),
      });
    }

    // Check convergence (candidate stability)
    if (convergenceFn && prevCandidate !== null) {
      const delta = convergenceFn(prevCandidate, candidate);
      if (delta < convergenceThreshold) {
        return createReturn({
          noise,
          pattern,
          candidate,
          iterations: iter + 1,
          events: cycles.map(c => ({
            iteration_hex: c.iteration_hex,
            valid: c.valid,
            delta: typeof delta === 'number' ? delta.toFixed(4) : String(delta),
          })),
          haltReason: HALT_REASONS.CONVERGENCE,
        });
      }
    }

    prevCandidate = candidate;
  }

  // Iteration limit reached
  return createFailedReturn({
    cycles,
    reason: HALT_REASONS.ITERATION_LIMIT,
    noise,
  });
}

// ─── Module Exports ──────────────────────────────

module.exports = {
  createReturn,
  createFailedReturn,
  envelope,
  toHex,
  checksumHex,
  nprIterate,
  HALT_REASONS,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_CONVERGENCE_THRESHOLD,
};
