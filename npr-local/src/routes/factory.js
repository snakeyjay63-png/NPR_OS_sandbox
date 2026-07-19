/**
 * NPR Factory Routes
 * 
 * REST endpoints for the auditable inference factory:
 * - POST /factory/run — Single auditable run
 * - POST /factory/iterative — Iterative run until convergence
 * - GET /factory/archive — Replay archive
 * - POST /factory/reset — Reset convergence detector
 * - GET /factory/status — Factory health + stats
 */

const { initFactory, factoryAgentTurn, factoryIterativeTurn } = require('../agent/loop.js');

// Lazy-initialized factory instance
let factoryInstance = null;

/**
 * Initialize factory on first request.
 */
function getFactory() {
  if (!factoryInstance) {
    factoryInstance = initFactory({
      modelEndpoint: process.env.FACTORY_MODEL_API || process.env.MODEL_API || 'http://127.0.0.1:8765/v1/chat/completions',
      temperature: parseFloat(process.env.FACTORY_TEMP) || 0.3,
      maxTokens: parseInt(process.env.FACTORY_MAX_TOKENS) || 2048,
      convergenceWindow: parseInt(process.env.FACTORY_CONV_WINDOW) || 5,
    });
  }
  return factoryInstance;
}

// ─── Handlers ───

/**
 * POST /factory/run
 * Execute a single auditable factory run.
 */
async function handleRun(req, res) {
  try {
    const { input, sessionId = 'factory-1' } = req.body || {};
    if (!input) return res.status(400).json({ error: 'Missing input' });

    const f = getFactory();
    const result = await factoryAgentTurn(sessionId, input);

    res.json({
      success: result.success !== false,
      output: result.response,
      convergence: result.convergence,
      audit: result.audit,
      session: result.session,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /factory/iterative
 * Run iterative feedback loop until convergence.
 */
async function handleIterative(req, res) {
  try {
    const { input, sessionId = 'factory-1', maxIterations = 10 } = req.body || {};
    if (!input) return res.status(400).json({ error: 'Missing input' });

    const result = await factoryIterativeTurn(sessionId, input, { maxIterations });

    res.json({
      success: !result.error,
      output: result.response,
      iterations: result.iterations,
      chain: result.chain || [],
      session: result.session,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /factory/archive
 * Return recent factory runs from replay archive.
 */
function handleArchive(req, res) {
  try {
    const f = getFactory();
    const limit = parseInt(req.query?.limit) || 20;
    const archive = (f?.archive || []).slice(-limit).reverse();

    res.json({
      count: archive.length,
      runs: archive.map(r => ({
        runId: r.runId,
        timestamp: r.timestamp,
        convergence: r.convergence,
        verdict: r.evaluation?.finalVerdict,
        route: r.distribution?.route,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /factory/reset
 * Reset convergence detector (start new chain).
 */
function handleReset(req, res) {
  try {
    const f = getFactory();
    f.resetConvergence();
    res.json({ success: true, message: 'Convergence detector reset' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /factory/status
 * Factory health + statistics.
 */
function handleStatus(req, res) {
  try {
    const f = getFactory();
    res.json({
      initialized: !!f,
      archiveSize: f?.archive?.length || 0,
      convergenceWindow: f?.convergence?.windowSize || 5,
      modelEndpoint: f?.config?.modelEndpoint,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { handleRun, handleIterative, handleArchive, handleReset, handleStatus };
