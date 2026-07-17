// @addr 10.02.0.0
// NPR Loop — Noise → Pattern → Return
// The iterative agent core. Each cycle:
//   1. Gather noise (runtime evidence)
//   2. Submit to Llama for candidate generation
//   3. Validate candidate via Patañjali 1.7
//   4. If valid → Return. If not → iterate with feedback.
//
// Contract: one input → one canonical return. No loops forever.

"use strict";

const { nprRoute } = require('../field/npr');
const { validatePattern } = require('../field/patanjali-17');
const { createReturn, createFailedReturn } = require('../field/return-structure');
const { gatherNoise } = require('./noise-gatherer');
const llamaClient = require('../inference/llama-client');

// ─── Config ────────────────────────────────────────────────────────────

// @addr 10.02.0.1
const DEFAULT_MAX_ITERATIONS = 0x0A; // 10
const DEFAULT_TIMEOUT_MS = 0x2710;   // 10000

// ─── Core Loop ─────────────────────────────────────────────────────────

// @addr 10.02.1.0
/**
 * Run the NPR cycle until validation passes or iterations exhausted.
 *
 * @param {object} opts
 * @param {string} opts.input       - Raw input (question, task, signal).
 * @param {object} [opts.contracts] - Formal contracts for validation.
 * @param {number} [opts.maxIterations] - Hard cap on cycles.
 * @param {number} [opts.timeoutMs]     - Total timeout.
 * @param {string} [opts.sessionId]
 *
 * @returns {Promise<object>} Canonical return envelope.
 */
async function nprLoop({
  input,
  contracts,
  maxIterations = DEFAULT_MAX_ITERATIONS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  sessionId,
} = {}) {
  const start = Date.now();
  const route = nprRoute(input);
  const baseNoise = { input, route, session_id: sessionId };

  // ─── Phase 0: Initial noise gathering ───────────────────────────────

  // @addr 10.02.1.1
  let noise = await gatherNoise(baseNoise);

  // Lightweight Llama health check
  const client = llamaClient.createLlamaClient();
  try {
    // Quick probe: try a tiny completion to verify llama is alive
    await client.complete(
      [{ role: 'user', content: '.' }],
      { maxTokens: 2, timeout: 0x07D0 },
    );
    noise.llama = { available: true };
  } catch (err) {
    noise.llama = { available: false, reason: err.message };
  }
  noise._client = client;

  // ─── Phase 1: Iterative refinement ──────────────────────────────────

  // @addr 10.02.1.2
  const cycles = [];

  for (let i = 0; i < maxIterations; i++) {
    // Timeout check
    if (Date.now() - start > timeoutMs) {
      return createFailedReturn({
        cycles,
        reason: 'TIMEOUT',
        noise,
      });
    }

    // Generate candidate from Llama
    const candidate = await generateCandidate({
      input,
      noise,
      feedback: i > 0 ? cycles[i - 1].feedback : null,
      contracts,
    });

    // Validate via Patañjali 1.7
    const pattern = validatePattern({
      candidate,
      noise,
      contracts,
    });

    const iterationHex = '0x' + (i + 1).toString(16).toUpperCase().padStart(4, '0');

    cycles.push({
      iteration_hex: iterationHex,
      pattern,
      candidate,
      feedback: null,
    });

    // ─── Valid return? ────────────────────────────────────────────────

    if (pattern.valid) {
      return createReturn({
        noise,
        pattern,
        candidate,
        iterations: i + 1,
      });
    }

    // ─── Prepare feedback for next iteration ──────────────────────────

    // @addr 10.02.1.3
    cycles[i].feedback = buildFeedback(pattern, candidate);

    // Refresh noise with latest state (ports, VM, etc.)
    noise = await gatherNoise({
      ...baseNoise,
      previousAttempt: candidate,
      iteration: i + 1,
    });
  }

  // ─── Exhausted ──────────────────────────────────────────────────────

  return createFailedReturn({
    cycles,
    reason: 'ITERATION_LIMIT',
    noise,
  });
}

// ─── Candidate Generation ──────────────────────────────────────────────

// @addr 10.02.2.0
/**
 * Submit to Llama for candidate generation.
 * Builds a system prompt from noise + contracts + optional feedback.
 */
async function generateCandidate({ input, noise, feedback, contracts }) {
  const client = noise._client || llamaClient.createLlamaClient();

  const attempt = feedback ? 'refinement' : '1st';
  const systemPrompt = [
    'NPR agent. Respond with structured JSON.',
    `Route: ${noise.route}`,
    `Attempt: ${attempt}`,
  ];

  if (contracts) {
    systemPrompt.push(`Contracts: ${JSON.stringify(contracts)}`);
  }

  if (feedback) {
    systemPrompt.push(`Previous validation feedback: ${feedback}`);
  }

  // Gather noise context for the model
  const noiseContext = {
    vm: noise.vm ?? null,
    workspace: noise.workspace ?? null,
    ports: noise.ports ?? null,
    tools: noise.tools ?? null,
    openclaw: noise.openclaw ?? null,
  };

  const userPrompt = [
    `Input: ${input}`,
    `Runtime context: ${JSON.stringify(noiseContext)}`,
    'Return a JSON object with: { result, derivation, source }',
  ].join('\n');

  try {
    const content = await client.complete(
      [
        { role: 'system', content: systemPrompt.join('\n') },
        { role: 'user', content: userPrompt },
      ],
      { maxTokens: 0x03E8 }, // 1000
    );

    // Parse candidate — if Llama returns invalid JSON, wrap as string
    try {
      return JSON.parse(content);
    } catch {
      return { result: content, derivation: 'raw', source: 'llama' };
    }
  } catch (err) {
    // Llama unavailable — return noise-only candidate
    return {
      result: null,
      derivation: 'no-model',
      source: 'local',
      error: err.message,
    };
  }
}

// ─── Feedback Builder ──────────────────────────────────────────────────

// @addr 10.02.2.1
/**
 * Convert validation failures into actionable feedback for the next iteration.
 */
function buildFeedback(pattern, candidate) {
  const issues = [];

  const report = (section, checks) => {
    for (const check of checks) {
      if (!check.pass) {
        issues.push(`${section}: ${check.detail}`);
      }
    }
  };

  report('Pratyaksha', pattern.pratyaksha.checks);
  report('Anumana', pattern.anumana.checks);
  report('Agama', pattern.agama.checks);

  if (issues.length === 0) {
    return null; // Shouldn't happen — pattern.valid would be true
  }

  return `Validation failed (${issues.length} issues):\n` + issues.map((i, n) => `  ${n + 1}. ${i}`).join('\n');
}

// ─── Helpers ───────────────────────────────────────────────────────────

// (removed: cyclesCount was inlined into generateCandidate)

// ─── Exports ───────────────────────────────────────────────────────────

module.exports = {
  nprLoop,
  generateCandidate,
  buildFeedback,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_TIMEOUT_MS,
};
