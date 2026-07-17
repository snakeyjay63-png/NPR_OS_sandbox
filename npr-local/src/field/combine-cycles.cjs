// @net 10.18.0.0/24
// ═══════════════════════════════════════════════════
// @net 10.18.0.0/24
// field/combine-cycles.cjs — Stap 18: Combine Cycles
// ═══════════════════════════════════════════════════
//
// Deterministic cycle combination.
// Aggregates multiple CycleResults into a unified MotorField
// using weighted combination based on semantic overlap,
// NPR root consistency, and contradiction delta.
//
// combine_cycles          : NonEmptyList<CycleResult> × Question → Result<MotorField, CombineCyclesError>
// compute_cycle_weight    : CycleResult → ℝ≥0
// weighted_motor_field_sum: NonEmptyList<CycleResult> × NonEmptyList<ℝ≥0> → MotorField
//
// MotorField structure:
// { content, sources, signals, phasePosition, relations, contradictions }
//
// ═══════════════════════════════════════════════════

const { digitalRoot } = require('./npr.js');

/**
 * Sentinel error for empty context.
 * Use to signal when combine_cycles receives insufficient data.
 * @type {{error: string, message: string}}
 */
const empty_context_error = {
  error: 'empty_context',
  message: 'No cycle results provided or all results are empty',
};

/**
 * Sentinel error when all cycle weights resolve to 0.
 * @type {{error: string, message: string}}
 */
const no_active_cycle_weight = {
  error: 'no_active_cycle_weight',
  message: 'All cycle weights are zero — no active cycle to combine',
};

/** Default weight for a cycle with no quality indicators. */
const DEFAULT_CYCLE_WEIGHT = 1.0;

/** Minimum weight threshold to consider a cycle "active". */
const MIN_ACTIVE_WEIGHT = 1e-9;

// ─── Cycle Weight Computation ─────────────────────

/**
 * Compute the weight of a single cycle result based on its quality indicators.
 *
 * Weight factors:
 * - tokenCount: more tokens → higher confidence → weight += tokenCount * 0.1
 * - digitalRoot: presence of valid DR (1-9) → weight += 0.5
 * - phaseAligned: if the cycle's phase is aligned with DR → weight += 1.0
 * - contradictionCount: subtract 0.2 per contradiction found
 * - signalStrength: if present, adds directly (0-1 range)
 *
 * Result is clamped to ℝ≥0.
 *
 * @param {object} cycleResult - A cycle result object.
 * @param {number} [cycleResult.tokenCount] - Number of tokens processed.
 * @param {number} [cycleResult.digitalRoot] - Digital root of the cycle (1-9).
 * @param {boolean} [cycleResult.phaseAligned] - Whether phase is aligned.
 * @param {number} [cycleResult.contradictionCount] - Number of contradictions found.
 * @param {number} [cycleResult.signalStrength] - Signal strength in [0,1].
 * @param {number} [cycleResult.confidence] - Confidence score in [0,1].
 * @returns {number} Weight in ℝ≥0.
 */
function compute_cycle_weight(cycleResult) {
  if (!cycleResult || typeof cycleResult !== 'object') {
    return 0;
  }

  let weight = DEFAULT_CYCLE_WEIGHT;

  // Token count contribution: more tokens → more weight
  if (typeof cycleResult.tokenCount === 'number' && cycleResult.tokenCount > 0) {
    weight += Math.min(cycleResult.tokenCount * 0.1, 2.0);
  }

  // Valid digital root contributes
  if (typeof cycleResult.digitalRoot === 'number' && cycleResult.digitalRoot >= 1 && cycleResult.digitalRoot <= 9) {
    weight += 0.5;
  }

  // Phase alignment bonus
  if (cycleResult.phaseAligned === true) {
    weight += 1.0;
  }

  // Contradiction penalty
  if (typeof cycleResult.contradictionCount === 'number' && cycleResult.contradictionCount > 0) {
    weight -= Math.min(cycleResult.contradictionCount * 0.2, 2.0);
  }

  // Signal strength contribution
  if (typeof cycleResult.signalStrength === 'number' && cycleResult.signalStrength > 0) {
    weight += cycleResult.signalStrength;
  }

  // Confidence contribution
  if (typeof cycleResult.confidence === 'number' && cycleResult.confidence > 0) {
    weight += cycleResult.confidence * 0.5;
  }

  // Clamp to non-negative
  return Math.max(0, weight);
}

/**
 * Compute semantic overlap between two cycle results.
 * Compares shared keywords/tokens between their content strings.
 *
 * @param {object} a - First cycle result.
 * @param {object} b - Second cycle result.
 * @returns {number} Overlap ratio in [0,1].
 */
function semanticOverlap(a, b) {
  const tokensA = tokenize(a.content || '');
  const tokensB = tokenize(b.content || '');

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let shared = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) shared++;
  }

  return shared / Math.max(tokensA.size, tokensB.size);
}

/**
 * Check NPR root consistency between two cycle results.
 * Returns 1 if roots match, 0 if they differ.
 *
 * @param {object} a - First cycle result.
 * @param {object} b - Second cycle result.
 * @returns {number} Consistency score: 1 (same root) or 0 (different root).
 */
function nprRootConsistency(a, b) {
  const rootA = (a.digitalRoot !== undefined) ? a.digitalRoot : digitalRoot(a.tokenValue || 0);
  const rootB = (b.digitalRoot !== undefined) ? b.digitalRoot : digitalRoot(b.tokenValue || 0);
  return rootA === rootB ? 1 : 0;
}

/**
 * Compute contradiction delta between two cycle results.
 * Based on conflicting signals and semantic divergence.
 *
 * @param {object} a - First cycle result.
 * @param {object} b - Second cycle result.
 * @returns {number} Contradiction score in ℝ≥0. Higher = more contradictory.
 */
function contradictionDelta(a, b) {
  let delta = 0;

  // Direct contradiction: different roots
  const rootA = (a.digitalRoot !== undefined) ? a.digitalRoot : digitalRoot(a.tokenValue || 0);
  const rootB = (b.digitalRoot !== undefined) ? b.digitalRoot : digitalRoot(b.tokenValue || 0);
  if (rootA !== rootB && rootA !== 0 && rootB !== 0) {
    delta += 0.3;
  }

  // Semantic divergence
  const overlap = semanticOverlap(a, b);
  delta += (1 - overlap) * 0.4;

  // Signal conflict
  if (a.signals && b.signals && Array.isArray(a.signals) && Array.isArray(b.signals)) {
    const signalsA = new Set(a.signals.map(String));
    const signalsB = new Set(b.signals.map(String));
    // Count signals that are in A but not B, and vice versa
    let conflicts = 0;
    for (const s of signalsA) {
      if (!signalsB.has(s)) conflicts++;
    }
    for (const s of signalsB) {
      if (!signalsA.has(s)) conflicts++;
    }
    delta += Math.min(conflicts * 0.1, 0.3);
  }

  return delta;
}

// ─── Motor Field Combination ──────────────────────

/**
 * Combine multiple cycle results into a unified MotorField.
 *
 * Process:
 * 1. Compute weights for each cycle
 * 2. Check if all weights are zero → return error
 * 3. Normalize weights (sum to 1)
 * 4. Compute weighted motor field sum
 * 5. Return Result<MotorField, CombineCyclesError>
 *
 * @param {object[]} cycleResults - Array of cycle result objects. Must be non-empty.
 * @param {string} [question] - Optional question/context string for the combination.
 * @returns {{ok: object} | {error: string}} Result object with MotorField on success, error on failure.
 */
function combine_cycles(cycleResults, question) {
  // Validate input
  if (!Array.isArray(cycleResults) || cycleResults.length === 0) {
    return empty_context_error;
  }

  // Filter out null/undefined entries
  const validResults = cycleResults.filter(r => r != null);
  if (validResults.length === 0) {
    return empty_context_error;
  }

  // Compute weights
  const weights = validResults.map(r => compute_cycle_weight(r));

  // Check if all weights are zero
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight < MIN_ACTIVE_WEIGHT) {
    return no_active_cycle_weight;
  }

  // Normalize weights
  const normalizedWeights = weights.map(w => w / totalWeight);

  // Compute weighted motor field sum
  const motorField = weighted_motor_field_sum(validResults, normalizedWeights, question);

  return { ok: motorField };
}

/**
 * Compute the weighted sum of MotorFields from cycle results.
 *
 * Each field component is combined proportionally to its weight:
 * - content: concatenated, ordered by weight (highest first)
 * - sources: union of all sources, deduplicated
 * - signals: union of all signals, deduplicated
 * - phasePosition: weighted average (numeric) or majority vote (string)
 * - relations: merged list
 * - contradictions: aggregated with weighted scores
 *
 * @param {object[]} cycleResults - Array of cycle result objects.
 * @param {number[]} weights - Normalized weights (should sum to ~1).
 * @param {string} [question] - Optional context question.
 * @returns {object} MotorField with combined data.
 */
function weighted_motor_field_sum(cycleResults, weights, question) {
  const n = cycleResults.length;

  // Sort indices by weight (descending) for content ordering
  const indices = weights
    .map((w, i) => ({ weight: w, index: i }))
    .sort((a, b) => b.weight - a.weight)
    .map(e => e.index);

  // Content: weighted concatenation
  const contentParts = indices.map(i => {
    const content = cycleResults[i].content || '';
    return weights[i] > 0.1 ? content : '';
  }).filter(Boolean);

  const content = contentParts.length > 0
    ? contentParts.join('\n---\n')
    : (question || '');

  // Sources: deduplicated union
  const sourcesSet = new Set();
  for (const result of cycleResults) {
    if (Array.isArray(result.sources)) {
      for (const s of result.sources) sourcesSet.add(String(s));
    }
  }
  const sources = [...sourcesSet];

  // Signals: deduplicated union
  const signalsSet = new Set();
  for (const result of cycleResults) {
    if (Array.isArray(result.signals)) {
      for (const s of result.signals) signalsSet.add(String(s));
    }
  }
  const signals = [...signalsSet];

  // Phase position: weighted average if numeric, majority if string
  let phasePosition = 0;
  const phasePositions = cycleResults
    .map((r, i) => ({ pos: r.phasePosition, weight: weights[i] }))
    .filter(p => p.pos != null);

  if (phasePositions.length > 0) {
    const firstPos = phasePositions[0].pos;
    if (typeof firstPos === 'number') {
      // Weighted average
      phasePosition = phasePositions.reduce(
        (sum, p) => sum + (typeof p.pos === 'number' ? p.pos * p.weight : 0), 0
      );
    } else {
      // Majority vote by weight
      const voteCounts = {};
      for (const p of phasePositions) {
        const key = String(p.pos);
        voteCounts[key] = (voteCounts[key] || 0) + p.weight;
      }
      const topVote = Object.entries(voteCounts)
        .sort((a, b) => b[1] - a[1])[0];
      phasePosition = topVote ? topVote[0] : 0;
    }
  }

  // Relations: merged list, deduplicated
  const relationsSet = new Set();
  for (const result of cycleResults) {
    if (Array.isArray(result.relations)) {
      for (const r of result.relations) {
        relationsSet.add(typeof r === 'object' ? JSON.stringify(r) : String(r));
      }
    }
  }
  const relations = [...relationsSet].map(r => {
    try { return JSON.parse(r); } catch { return r; }
  });

  // Contradictions: aggregated
  const contradictions = [];
  for (let i = 0; i < cycleResults.length; i++) {
    if (Array.isArray(cycleResults[i].contradictions)) {
      for (const c of cycleResults[i].contradictions) {
        contradictions.push({
          source: `cycle[${i}]`,
          weight: weights[i],
          ...typeof c === 'object' ? c : { text: String(c) },
        });
      }
    }
  }

  // Compute combined digital root
  const combinedDigitalRoot = cycleResults.some(r => r.digitalRoot != null)
    ? digitalRoot(cycleResults.reduce((sum, r) => sum + (r.digitalRoot || 0), 0))
    : 0;

  return {
    content,
    sources,
    signals,
    phasePosition,
    relations,
    contradictions,
    digitalRoot: combinedDigitalRoot,
    cycleCount: n,
    weightDistribution: indices.map(i => ({ cycleIndex: i, weight: weights[i] })),
    question,
  };
}

// ─── Internal Helpers ─────────────────────────────

/**
 * Simple tokenizer: split text on whitespace and punctuation, lowercase.
 * @param {string} text - Text to tokenize.
 * @returns {Set<string>} Set of unique lowercase tokens.
 */
function tokenize(text) {
  const tokens = new Set();
  const words = text.toLowerCase().replace(/[^\w\u0900-\u097F]/g, ' ').split(/\s+/);
  for (const w of words) {
    if (w.length > 0) tokens.add(w);
  }
  return tokens;
}

// ─── Module Exports ───────────────────────────────

module.exports = {
  combine_cycles,
  compute_cycle_weight,
  weighted_motor_field_sum,
  empty_context_error,
  no_active_cycle_weight,
  // Internal helpers (exported for testing)
  semanticOverlap,
  nprRootConsistency,
  contradictionDelta,
  tokenize,
  DEFAULT_CYCLE_WEIGHT,
  MIN_ACTIVE_WEIGHT,
};
