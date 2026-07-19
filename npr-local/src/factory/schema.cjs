/**
 * NPR Factory Audit Schema
 * 
 * Defines the structure of a fully auditable inference run.
 * This is the "contract" for the factory pipeline.
 */

module.exports = {
  /**
   * Generates a blank audit record structure.
   * Fill this out as the pipeline progresses.
   */
  createAuditRecord: (runId) => ({
    runId,
    timestamp: new Date().toISOString(),
    model: {
      name: null,
      checkpointHash: null,
      quantization: null,
      runtime: null,
      runtimeCommit: null,
    },
    source: {
      documents: [],
      hashes: [],
      licenses: [],
      transformations: [],
    },
    context: {
      templateHash: null,
      tokenCount: 0,
      headroomRatio: 0,
      hexaSlot: null,
      promptPreview: '', // First 100 chars for debugging
    },
    inference: {
      seed: null,
      temperature: 0,
      topP: 1,
      maxTokens: 2048,
      durationMs: 0,
      tokensGenerated: 0,
    },
    evaluation: {
      checks: [],
      scores: {},
      failures: [],
      finalVerdict: null,
    },
    convergence: {
      status: null, // 'converging' | 'fixed-point' | 'cycle-detected'
      hash: null,
      reason: null,
    },
    distribution: {
      route: null,
      rankingRule: null,
      selectedOutput: null,
      filteredOutputs: [],
    },
  }),

  /**
   * Validates that a record has the required fields.
   */
  validateRecord: (record) => {
    const required = ['runId', 'model', 'source', 'context', 'inference', 'evaluation', 'convergence', 'distribution'];
    const missing = required.filter(key => !record[key]);
    return {
      valid: missing.length === 0,
      missing,
    };
  },
};
