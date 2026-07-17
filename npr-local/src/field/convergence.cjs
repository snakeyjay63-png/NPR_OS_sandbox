// @net 10.19.0.0/24
// ═══════════════════════════════════════════════════
// @net 10.19.0.0/24
// field/convergence.cjs — Stap 19: Convergence + Contradiction
// ═══════════════════════════════════════════════════
//
// Convergence checking and contradiction analysis for NPR cycles.
// Determines when iterative routing has stabilized and the result
// is reliable enough to return to the user.
//
// semantic_distance   : RouterOutput × RouterOutput → [0..1]
// contradiction_delta : RouterOutput × RouterOutput → ℝ≥0
// root                : RouterOutput → ℕ (digitalRoot)
// has_converged       : RouterOutput × RouterOutput × ε × δ → boolean
// effective_max_iterations: ℕ? → ℕ in [1..64]
//
// RouterOutput structure: { content, sources, dr, signals, contradictions }
//
// ═══════════════════════════════════════════════════

const { digitalRoot } = require('./npr.js');

/**
 * Default maximum number of iterations before forced convergence.
 * Based on the 3×3 NPR cycle structure (3 phases × 3 repetitions = 9).
 * @type {number}
 */
const DEFAULT_MAX_ITERATIONS = 9;

/**
 * Default epsilon for semantic stability check.
 * If semantic_distance ≤ this, content is considered stable.
 * @type {number}
 */
const DEFAULT_EPSILON = 0.15;

/**
 * Default delta for contradiction stability check.
 * If contradiction_delta ≤ this, contradictions are considered stable.
 * @type {number}
 */
const DEFAULT_DELTA = 0.1;

// ─── Tokenization ─────────────────────────────────

/**
 * Extract a set of tokens from RouterOutput content for comparison.
 * Simple whitespace + punctuation split, lowercased.
 *
 * @param {string} text - Content text to tokenize.
 * @returns {Set<string>} Set of unique tokens.
 */
function tokenize(text) {
  const tokens = new Set();
  if (!text) return tokens;
  const words = text.toLowerCase().replace(/[^\w\u0900-\u097F]/g, ' ').split(/\s+/);
  for (const w of words) {
    if (w.length > 0) tokens.add(w);
  }
  return tokens;
}

// ─── Core Analysis Functions ──────────────────────

/**
 * Compute Jaccard-based semantic distance between two RouterOutputs.
 *
 * Distance = 1 - (|intersection| / |union|)
 * Returns 0 if identical token sets, approaches 1 as sets diverge.
 *
 * @param {object} a - First RouterOutput.
 * @param {object} b - Second RouterOutput.
 * @returns {number} Distance in [0..1]. 0 = identical, 1 = completely different.
 */
function semantic_distance(a, b) {
  const tokensA = tokenize(a.content || '');
  const tokensB = tokenize(b.content || '');

  // Both empty → identical
  if (tokensA.size === 0 && tokensB.size === 0) return 0;

  // One empty → completely different
  if (tokensA.size === 0 || tokensB.size === 0) return 1;

  // Jaccard similarity
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  const jaccardSimilarity = intersection / union;

  return 1 - jaccardSimilarity;
}

/**
 * Detect contradictions between consecutive RouterOutputs.
 *
 * Checks for:
 * 1. Conflicting digital roots (dr changes)
 * 2. Conflicting signals (signals present in one but not the other)
 * 3. Explicit contradictions listed in the outputs
 * 4. Semantic divergence (complementary to semantic_distance)
 *
 * @param {object} a - First RouterOutput.
 * @param {object} b - Second RouterOutput.
 * @returns {number} Contradiction score in ℝ≥0. Higher = more contradictory.
 */
function contradiction_delta(a, b) {
  let delta = 0;

  // 1. Digital root conflict
  const drA = root(a);
  const drB = root(b);
  if (drA > 0 && drB > 0 && drA !== drB) {
    // Different roots is a significant contradiction
    delta += 0.4;
  }

  // 2. Signal conflicts
  const signalsA = new Set((a.signals || []).map(String));
  const signalsB = new Set((b.signals || []).map(String));

  if (signalsA.size > 0 || signalsB.size > 0) {
    let conflicts = 0;
    let totalSignals = 0;

    for (const s of signalsA) {
      totalSignals++;
      if (!signalsB.has(s)) conflicts++;
    }
    for (const s of signalsB) {
      totalSignals++;
      if (!signalsA.has(s)) conflicts++;
    }

    if (totalSignals > 0) {
      delta += (conflicts / totalSignals) * 0.3;
    }
  }

  // 3. Explicit contradiction overlap
  const contradictionsA = new Set((a.contradictions || []).map(String));
  const contradictionsB = new Set((b.contradictions || []).map(String));

  // New contradictions that appeared in b but not a
  let newContradictions = 0;
  for (const c of contradictionsB) {
    if (!contradictionsA.has(c)) newContradictions++;
  }
  delta += Math.min(newContradictions * 0.1, 0.3);

  return delta;
}

/**
 * Extract the NPR digital root position from a RouterOutput.
 *
 * @param {object} output - RouterOutput object.
 * @returns {number} Digital root in [0..9].
 */
function root(output) {
  if (!output || typeof output !== 'object') return 0;

  // Primary: explicit dr field
  if (typeof output.dr === 'number') return output.dr;

  // Secondary: digitalRoot field
  if (typeof output.digitalRoot === 'number') return output.digitalRoot;

  // Tertiary: compute from content
  if (output.content && typeof output.content === 'string') {
    let sum = 0;
    for (const ch of output.content) {
      sum += ch.codePointAt(0) || 0;
    }
    return digitalRoot(sum);
  }

  return 0;
}

/**
 * Check if a sequence of RouterOutputs has converged.
 *
 * Three convergence criteria (all must be true):
 * 1. **root_stable**: digital root is the same between current and previous
 * 2. **semantic_stable**: semantic distance is within epsilon threshold
 * 3. **contradiction_stable**: contradiction delta is within delta threshold
 *
 * @param {object} output_i - Current iteration RouterOutput.
 * @param {object} output_prev - Previous iteration RouterOutput.
 * @param {number} [epsilon=DEFAULT_EPSILON] - Semantic stability threshold (0-1).
 * @param {number} [delta=DEFAULT_DELTA] - Contradiction stability threshold (0+).
 * @returns {{converged: boolean, rootStable: boolean, semanticStable: boolean, contradictionStable: boolean, details: object}}
 */
function has_converged(output_i, output_prev, epsilon, delta) {
  const eps = epsilon !== undefined ? epsilon : DEFAULT_EPSILON;
  const del = delta !== undefined ? delta : DEFAULT_DELTA;

  // Root stability: digital root unchanged
  const dr_i = root(output_i);
  const dr_prev = root(output_prev);
  const rootStable = (dr_i === dr_prev);

  // Semantic stability: content similarity within threshold
  const semDist = semantic_distance(output_i, output_prev);
  const semanticStable = semDist <= eps;

  // Contradiction stability: contradictions within threshold
  const contraDelta = contradiction_delta(output_i, output_prev);
  const contradictionStable = contraDelta <= del;

  // All three must be true for convergence
  const converged = rootStable && semanticStable && contradictionStable;

  return {
    converged,
    rootStable,
    semanticStable,
    contradictionStable,
    details: {
      dr_current: dr_i,
      dr_previous: dr_prev,
      semanticDistance: semDist,
      epsilon: eps,
      contradictionDelta: contraDelta,
      delta: del,
    },
  };
}

// ─── Iteration Control ────────────────────────────

/**
 * Clamp iteration count to valid range [1..64], defaulting to 9.
 *
 * @param {number} [n] - Requested iteration count.
 * @returns {number} Clamped iteration count in [1..64].
 */
function effective_max_iterations(n) {
  if (n === undefined || n === null || isNaN(n)) {
    return DEFAULT_MAX_ITERATIONS;
  }
  return Math.max(1, Math.min(64, Math.floor(n)));
}

/**
 * Run convergence check over a sequence of RouterOutputs.
 * Returns the convergence result for each consecutive pair.
 *
 * @param {object[]} outputs - Sequence of RouterOutputs.
 * @param {number} [epsilon] - Semantic stability threshold.
 * @param {number} [delta] - Contradiction stability threshold.
 * @returns {{iterations: object[], converged: boolean, convergedAt: number, maxIterations: number}}
 */
function check_convergence(outputs, epsilon, delta) {
  const maxIter = effective_max_iterations(epsilon); // unused; keep for API compat
  const iterations = [];
  let convergedAt = -1;

  for (let i = 1; i < outputs.length; i++) {
    const result = has_converged(outputs[i], outputs[i - 1], epsilon, delta);
    result.iteration = i;
    iterations.push(result);

    if (result.converged && convergedAt === -1) {
      convergedAt = i;
    }
  }

  return {
    iterations,
    converged: convergedAt >= 0,
    convergedAt,
    maxIterations: DEFAULT_MAX_ITERATIONS,
    totalOutputs: outputs.length,
  };
}

// ─── Module Exports ───────────────────────────────

module.exports = {
  semantic_distance,
  contradiction_delta,
  root,
  has_converged,
  DEFAULT_MAX_ITERATIONS,
  effective_max_iterations,
  // Extended API
  check_convergence,
  DEFAULT_EPSILON,
  DEFAULT_DELTA,
};
