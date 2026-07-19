/**
 * NPR Factory Evaluation Harness
 * 
 * Audits model output before distribution:
 * - Length bounds (min/max tokens)
 * - Grounding check (does output relate to input?)
 * - Consistency check (no internal contradictions)
 * - Toxicity filter (basic keyword-based)
 * - Tool-call validation (if output contains tool calls)
 * 
 * All checks are configurable and pluggable.
 */

const crypto = require('crypto');

const DEFAULT_CHECKS = {
  lengthBounds:    { enabled: true, minChars: 1, maxChars: 16384 },
  grounding:       { enabled: true, threshold: 0.2 },
  consistency:     { enabled: true },
  toxicity:        { enabled: true },
  toolValidation:  { enabled: true },
};

// Simple toxicity/unsafe word list (expand as needed)
const TOXICITY_KEYWORDS = [
  'hate speech', 'self-harm', 'violent content',
];

class EvaluationHarness {
  constructor(config = {}) {
    this.checks = { ...DEFAULT_CHECKS, ...config };
  }

  /**
   * Run all enabled checks on the output.
   * @param {string} output - Raw model output.
   * @param {Object} record - Full audit record (for context).
   * @returns {Object} Evaluation result.
   */
  evaluate(output, record) {
    const results = [];
    let finalVerdict = 'pass';

    // 1. Length Bounds
    if (this.checks.lengthBounds.enabled) {
      const r = this.checkLength(output);
      results.push(r);
      if (!r.passed) finalVerdict = 'fail';
    }

    // 2. Grounding
    if (this.checks.grounding.enabled) {
      const r = this.checkGrounding(output, record);
      results.push(r);
      if (!r.passed) finalVerdict = 'warn';
    }

    // 3. Consistency
    if (this.checks.consistency.enabled) {
      const r = this.checkConsistency(output);
      results.push(r);
      if (!r.passed) finalVerdict = 'warn';
    }

    // 4. Toxicity
    if (this.checks.toxicity.enabled) {
      const r = this.checkToxicity(output);
      results.push(r);
      if (!r.passed) finalVerdict = 'fail';
    }

    // 5. Tool Validation
    if (this.checks.toolValidation.enabled) {
      const r = this.checkToolCalls(output);
      results.push(r);
      if (!r.passed) finalVerdict = 'warn';
    }

    return {
      checks: results,
      scores: this.computeScores(results),
      failures: results.filter(r => !r.passed).map(r => r.name),
      finalVerdict,
    };
  }

  // --- Individual Checks ---

  checkLength(output) {
    const { minChars, maxChars } = this.checks.lengthBounds;
    const len = output.length;
    const passed = len >= minChars && len <= maxChars;
    return {
      name: 'length_bounds',
      passed,
      detail: passed ? `OK (${len} chars)` : `Out of bounds: ${len} chars [${minChars}–${maxChars}]`,
    };
  }

  checkGrounding(output, record) {
    // Simple overlap check: does output share tokens/words with input?
    if (!record?.source?.documents?.[0]) return { name: 'grounding', passed: true, detail: 'No source to ground against' };
    
    const source = String(record.source.documents[0]).toLowerCase();
    const out = output.toLowerCase();
    
    // Extract meaningful words (skip stop words roughly)
    const sourceWords = new Set(source.split(/\s+/).filter(w => w.length > 3));
    const outWords = new Set(out.split(/\s+/).filter(w => w.length > 3));
    
    let overlap = 0;
    for (const w of outWords) {
      if (sourceWords.has(w)) overlap++;
    }
    
    const ratio = sourceWords.size > 0 ? overlap / Math.max(sourceWords.size, outWords.size) : 0;
    const passed = ratio >= this.checks.grounding.threshold;
    
    return {
      name: 'grounding',
      passed,
      detail: `Word overlap ratio: ${ratio.toFixed(3)} (threshold: ${this.checks.grounding.threshold})`,
    };
  }

  checkConsistency(output) {
    // Check for obvious internal contradictions (self-contradiction patterns)
    const lower = output.toLowerCase();
    const patterns = [
      /i\s+(don't\s+)?think\s+.*\bbut\b.*\bi\s+(do\s+)?think/i,
      /this\s+is\s+(correct|true).*?this\s+is\s+(incorrect|false)/i,
    ];
    
    for (const pat of patterns) {
      if (pat.test(lower)) {
        return { name: 'consistency', passed: false, detail: 'Potential self-contradiction detected' };
      }
    }
    
    return { name: 'consistency', passed: true, detail: 'No obvious contradictions' };
  }

  checkToxicity(output) {
    const lower = output.toLowerCase();
    for (const kw of TOXICITY_KEYWORDS) {
      if (lower.includes(kw)) {
        return { name: 'toxicity', passed: false, detail: `Flagged: "${kw}"` };
      }
    }
    return { name: 'toxicity', passed: true, detail: 'Clean' };
  }

  checkToolCalls(output) {
    // If output looks like it contains tool calls, validate structure
    const hasToolCall = /<tool_call>|```json|"tool"\s*:|{"name"\s*:/.test(output);
    
    if (!hasToolCall) return { name: 'tool_validation', passed: true, detail: 'No tool calls detected' };
    
    // Try to extract and validate JSON tool calls
    try {
      const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        JSON.parse(jsonMatch[1]); // Will throw if invalid
      }
      return { name: 'tool_validation', passed: true, detail: 'Tool calls structurally valid' };
    } catch {
      return { name: 'tool_validation', passed: false, detail: 'Malformed tool call JSON' };
    }
  }

  computeScores(results) {
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    return {
      overall: total > 0 ? passed / total : 1,
      checks: results.map(r => ({ name: r.name, score: r.passed ? 1 : 0 })),
    };
  }
}

module.exports = EvaluationHarness;
