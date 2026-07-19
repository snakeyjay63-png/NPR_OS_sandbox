/**
 * NPR Factory Core
 * 
 * Orchestrates the auditable inference pipeline:
 * Source -> Context -> Inference -> Evaluation -> Distribution
 */

const crypto = require('crypto');
const { createAuditRecord } = require('./schema.cjs');

const SourceRegistry = require('./source.cjs');
const ContextCompiler = require('./context.cjs');
const InferenceRuntime = require('./inference.cjs');
const ConvergenceDetector = require('./convergence.cjs');
const EvaluationHarness = require('./eval.cjs');
const DistributionLayer = require('./distribution.cjs');

class NPRFactory {
  constructor(config = {}) {
    this.config = config;
    this.archive = []; // In-memory replay archive (Fase 1)
    this.convergence = new ConvergenceDetector(config.convergenceWindow || 5);
    this.evaluation = new EvaluationHarness(config.evaluation);
    this.distribution = new DistributionLayer(config.distribution);
  }

  /**
   * Executes a full auditable run.
   * @param {Object} input - The raw input request.
   * @returns {Promise<Object>} - The audit record + result.
   */
  async run(input) {
    const runId = `run-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const record = createAuditRecord(runId);

    console.log(`[Factory] Starting run ${runId}`);

    try {
      // 1. Source Registry (Track input provenance)
      record.source = await this.processSource(input);

      // 2. Context Compiler (Assemble prompt + metadata)
      record.context = await this.compileContext(input, record.source);

      // 3. Inference Runtime (Execute model)
      const result = await this.executeInference(record.context);
      record.inference.durationMs = result.durationMs;
      record.inference.tokensGenerated = result.tokensGenerated;

      // 4. Convergence Check (Information dynamics)
      const convergence = this.convergence.check(result.output);
      record.convergence = convergence;
      console.log(`[Factory] Convergence: ${convergence.status} — ${convergence.reason}`);

      // 5. Evaluation Harness (Audit output)
      record.evaluation = await this.evaluate(result.output, record);

      // 6. Distribution Layer (Route output)
      record.distribution = this.distribute(result.output, record);

      // Archive the run
      this.archive.push(record);
      if (this.archive.length > 100) this.archive.shift(); // Keep last 100

      return {
        success: true,
        output: record.distribution.selectedOutput,
        convergence: convergence,
        audit: record,
      };

    } catch (err) {
      console.error(`[Factory] Run ${runId} failed:`, err.message);
      record.evaluation.failures.push({ step: 'pipeline', error: err.message });
      return {
        success: false,
        error: err.message,
        audit: record,
      };
    }
  }

  /**
   * Executes an iterative feedback loop until convergence.
   * Feeds output back as input until a fixed point or cycle is detected.
   * @param {Object} input - The initial input.
   * @param {Object} options - { maxIterations, feedbackFn }
   * @returns {Promise<Object>} - Final result + iteration history.
   */
  async runIterative(input, options = {}) {
    const { maxIterations = 10, feedbackFn } = options;
    const chain = [];
    let currentInput = input;

    for (let i = 0; i < maxIterations; i++) {
      console.log(`[Factory] Iteration ${i + 1}...`);
      const result = await this.run(currentInput);
      chain.push(result);

      if (!result.success) {
        return { ...result, iterations: chain.length };
      }

      // Stop if convergence detected
      if (result.convergence.status !== 'converging') {
        console.log(`[Factory] Stopped: ${result.convergence.reason} at iteration ${i + 1}`);
        return { ...result, iterations: chain.length, chain };
      }

      // Prepare next input from feedback
      if (feedbackFn) {
        currentInput = feedbackFn(result.output, chain);
      } else {
        // Default: feed raw output back as string input
        currentInput = result.output;
      }
    }

    console.log(`[Factory] Max iterations (${maxIterations}) reached`);
    return { ...chain[chain.length - 1], iterations: chain.length, chain };
  }

  /**
   * Reset convergence detector (start a new chain).
   */
  resetConvergence() {
    this.convergence.reset();
  }

  // --- Pipeline Steps (Stubs for now) ---

  async processSource(input) {
    const registry = new SourceRegistry();
    const record = registry.ingest(input, {
      source: 'factory_input',
      timestamp: new Date().toISOString(),
    });

    return {
      ...record,
      transformations: registry.getChain(),
    };
  }

  async compileContext(input, source) {
    const compiler = new ContextCompiler();
    // Determine template type based on input structure or default
    const templateType = typeof input === 'string' ? 'default' : 'chat';
    
    return compiler.assemble(templateType, source, { type: 'analysis' });
  }

  async executeInference(context) {
    const runtime = new InferenceRuntime({
      endpoint: this.config.modelEndpoint || 'http://127.0.0.1:8765/v1/completions',
    });

    return runtime.execute(context, {
      temperature: this.config.temperature || 0.2,
      maxTokens: this.config.maxTokens || 2048,
    });
  }

  async evaluate(output, record) {
    return this.evaluation.evaluate(output, record);
  }

  distribute(output, record) {
    return this.distribution.distribute(output, record);
  }

  /**
   * Configure the evaluation harness.
   */
  configureEvaluation(config) {
    this.evaluation = new EvaluationHarness({ ...this.evaluation.checks, ...config });
  }

  /**
   * Configure the distribution layer.
   */
  configureDistribution(config) {
    if (config.defaultRoute) this.distribution.defaultRoute = config.defaultRoute;
    if (config.slotMap) this.distribution.setSlotMap(config.slotMap);
    if (config.queue) this.distribution.setQueue(config.queue);
  }
}

module.exports = NPRFactory;
