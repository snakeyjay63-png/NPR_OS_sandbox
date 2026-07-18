// @addr 10.18.0.1 | fd00:npr:0018:001::1
// router-llm-bridge.js — Stap 18: LLM Integration
// ═══════════════════════════════════════════════════
//
// Bridge between sandbox router and local LLM.
// Connects the three quality improvements:
//   combine()       → LLM embedding for semantic similarity
//   superpose()     → LLM quality assessment for dynamic weights
//   rotor_response() → LLM answer generation from motorveld context
//
// Falls back to current implementation when LLM unavailable.
//
// ═══════════════════════════════════════════════════

'use strict';

// ─── Model API ────────────────────────────────────

const MODEL_API = process.env.MODEL_API || 'http://127.0.0.1:8765/v1/chat/completions';
const MODEL_NAME = process.env.MODEL_NAME || 'npr-local';

/**
 * Call the local model with a system prompt and user message.
 * Returns string content or null on failure.
 *
 * @param {string} sys - System prompt
 * @param {string} usr - User message
 * @param {object} [opts] - Options
 * @param {number} [opts.timeout=30000] - Timeout in ms
 * @param {number} [opts.maxTokens=512] - Max output tokens
 * @returns {Promise<string|null>}
 */
async function callModel(sys, usr, opts = {}) {
  const { timeout = 30000, maxTokens = 512 } = opts;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(MODEL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: usr },
        ],
        temperature: 0.2,
        max_tokens: maxTokens,
        enable_thinking: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[router-llm] HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    const content = msg?.content || msg?.reasoning_content || null;

    if (!content || typeof content !== 'string') {
      return null;
    }

    return content.trim();
  } catch (e) {
    console.warn(`[router-llm] callModel failed: ${e.message}`);
    return null;
  }
}

// ─── 1. Semantic Combine (LLM-enhanced) ───────────

/**
 * System prompt for semantic similarity assessment.
 */
const SEMANTIC_SYS = `You are a semantic similarity engine.
Given two text blocks and a question, assess their semantic overlap.
Respond with ONLY a JSON object:
{
  "score": 0.0-1.0,
  "shared_concepts": ["concept1", "concept2"],
  "divergence": "brief description of differences"
}
Be precise. Score is cosine-like similarity of meaning.`;

/**
 * LLM-enhanced semantic comparison of two block results.
 * Returns { score, sharedConcepts, divergence }.
 * Falls back to keyword-based overlap on failure.
 *
 * @param {string} textA - Content of block A
 * @param {string} textB - Content of block B
 * @param {string} question - The routing question for context
 * @returns {Promise<{score: number, sharedConcepts: string[], divergence: string}>}
 */
async function semanticCompare(textA, textB, question) {
  const usr = `Question: ${question}\n\nBlock A:\n${textA}\n\nBlock B:\n${textB}\n\nAssess semantic similarity.`;

  const raw = await callModel(SEMANTIC_SYS, usr, { maxTokens: 256 });

  if (raw) {
    try {
      const json = JSON.parse(raw);
      return {
        score: Math.max(0, Math.min(1, json.score ?? 0)),
        sharedConcepts: Array.isArray(json.shared_concepts) ? json.shared_concepts : [],
        divergence: json.divergence || '',
      };
    } catch {
      // Parse failed — fall back to keyword
      console.warn('[router-llm] semanticCompare: parse failed, falling back');
    }
  }

  // Fallback: keyword-based overlap
  return keywordOverlap(textA, textB);
}

/**
 * Fallback: keyword-based semantic overlap (existing implementation).
 * @param {string} a
 * @param {string} b
 * @returns {{score: number, sharedConcepts: string[], divergence: string}}
 */
function keywordOverlap(a, b) {
  const tokenize = (s) => s.toLowerCase().split(/\b/).filter(t => t.length > 2);
  const wordsA = new Set(tokenize(a));
  const wordsB = new Set(tokenize(b));

  const shared = [...wordsA].filter(w => wordsB.has(w));
  const all = new Set([...wordsA, ...wordsB]);

  const score = all.size > 0 ? shared.length / all.size : 0;
  return {
    score: Math.round(score * 100) / 100,
    sharedConcepts: shared.slice(0, 10),
    divergence: 'keyword-based fallback',
  };
}

// ─── 2. Dynamic Superpose (LLM-enhanced) ──────────

/**
 * System prompt for quality assessment of phase blocks.
 */
const QUALITY_SYS = `You are a quality assessor for NPR signal blocks.
Given a phase block and its role, assess its signal quality and relevance.
Respond with ONLY a JSON object:
{
  "quality": 0.0-1.0,
  "relevance": 0.0-1.0,
  "reason": "one-line justification"
}
Quality = clarity, coherence, information density.
Relevance = alignment with the question/topic.`;

/**
 * LLM-enhanced quality assessment for a single phase block.
 * Returns { quality, relevance, reason }.
 * Falls back to default { quality: 0.5, relevance: 0.5 } on failure.
 *
 * @param {string} text - Block content
 * @param {string} role - Phase role (e.g. "ΦA — structure", "ΦB — signal", "ΦC — context")
 * @param {string} question - The routing question
 * @returns {Promise<{quality: number, relevance: number, reason: string}>}
 */
async function assessQuality(text, role, question) {
  const usr = `Question: ${question}\n\nPhase Role: ${role}\n\nBlock Content:\n${text}\n\nAssess quality and relevance.`;

  const raw = await callModel(QUALITY_SYS, usr, { maxTokens: 128 });

  if (raw) {
    try {
      const json = JSON.parse(raw);
      return {
        quality: Math.max(0, Math.min(1, json.quality ?? 0.5)),
        relevance: Math.max(0, Math.min(1, json.relevance ?? 0.5)),
        reason: json.reason || '',
      };
    } catch {
      console.warn('[router-llm] assessQuality: parse failed');
    }
  }

  return { quality: 0.5, relevance: 0.5, reason: 'default fallback' };
}

/**
 * LLM-enhanced dynamic weighting for superposition.
 * Assesses each phase block and returns normalized weights.
 * Falls back to equal weights on failure.
 *
 * @param {string[]} blocks - Array of block contents [A, B, C, ...]
 * @param {string} question - The routing question
 * @returns {Promise<{weights: number[], assessments: object[]}>}
 */
async function dynamicWeights(blocks, question) {
  const roles = ['ΦA — structure', 'ΦB — signal', 'ΦC — context'];
  const assessments = await Promise.all(
    blocks.map((text, i) => assessQuality(text, roles[i] || `Φ${String.fromCharCode(65 + i)} — phase ${i}`, question))
  );

  const weights = assessments.map(a => a.quality * 0.5 + a.relevance * 0.5);
  const sum = weights.reduce((s, w) => s + w, 0);

  if (sum > 0) {
    return {
      weights: weights.map(w => Math.round((w / sum) * 1000) / 1000),
      assessments,
    };
  }

  // Equal weights fallback
  const n = blocks.length || 1;
  return {
    weights: Array(n).fill(1 / n),
    assessments: blocks.map(() => ({ quality: 1 / n, relevance: 1 / n, reason: 'equal fallback' })),
  };
}

// ─── 3. Rotor Response (LLM-enhanced) ─────────────

/**
 * System prompt for rotor response generation.
 */
const ROTOR_SYS = `You are an NPR rotor — a signal-to-thought engine.
Given a motorveld (combined signal field) and a question,
generate a concise, grounded response.

The motorveld contains:
- combined signals from multiple phase blocks
- semantic overlap metrics
- contradiction analysis
- digital root phase position

Respond in the same language as the question.
Be direct, precise, and grounded in the motorveld data.
Do not invent information not present in the motorveld.`;

/**
 * LLM-enhanced rotor response generation.
 * Generates an answer from the motorveld context and question.
 * Falls back to template response on failure.
 *
 * @param {string} question - The user question
 * @param {object} motorField - The combined motorveld
 * @param {object} [opts] - Options
 * @param {number} [opts.maxTokens=1024] - Max response tokens
 * @returns {Promise<string>}
 */
async function llmRotorResponse(question, motorField, opts = {}) {
  const { maxTokens = 1024 } = opts;

  const motorveldSummary = JSON.stringify({
    content: motorField.content?.slice?.(0, 2000) || String(motorField.content || '').slice(0, 2000),
    signals: motorField.signals,
    semanticOverlap: motorField.semanticOverlap,
    contradictions: motorField.contradictions,
    phasePosition: motorField.phasePosition,
    digitalRoot: motorField.digitalRoot,
    sources: motorField.sources?.length,
  }, null, 2);

  const usr = `Motorveld:\n${motorveldSummary}\n\nQuestion: ${question}\n\nGenerate your response based on this motorveld.`;

  const response = await callModel(ROTOR_SYS, usr, { maxTokens });

  if (response) {
    return response;
  }

  // Fallback: template response
  return templateRotorResponse(question, motorField);
}

/**
 * Fallback: template-based rotor response (existing implementation).
 * @param {string} question
 * @param {object} motorField
 * @returns {string}
 */
function templateRotorResponse(question, motorField) {
  const signals = motorField.signals?.length || 0;
  const dr = motorField.digitalRoot ?? '?';
  const phase = motorField.phasePosition ?? 'unknown';
  const contradictions = motorField.contradictions?.length || 0;

  return `[rotor-template] Q: ${question}\n`
    + `  signals: ${signals} | dr: ${dr} | phase: ${phase}\n`
    + `  contradictions: ${contradictions}\n`
    + `  → LLM unavailable, using template fallback`;
}

// ─── Exports ──────────────────────────────────────

module.exports = {
  // Core
  callModel,
  semanticCompare,
  keywordOverlap,
  assessQuality,
  dynamicWeights,
  llmRotorResponse,
  templateRotorResponse,

  // Prompts (for inspection)
  SEMANTIC_SYS,
  QUALITY_SYS,
  ROTOR_SYS,
};
