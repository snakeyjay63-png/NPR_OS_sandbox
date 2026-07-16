// @net 10.04.0.0/24
// routes/memory-context.js — Memory Context Loader
// Equivalent: openclaw memory context
//
// Loads phase-appropriate context files based on NPR slot/phase.
// Solves: Issue #1 — /memory/context returns empty without workspace param
// Solves: Issue #2 — /memory/context only scans /warehouse
// Solves: Issue #3 — /memory/context returns raw file content instead of structured JSON
// ═══════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { getContextForRoute, loadContext, listWarehouse, PHASE_CONTEXT, getPhaseFromSlot } = require('../memory/context');
const { listMemoryWithMeta, memorySummary, searchMemory } = require('../memory/list');

/**
 * GET /memory/context?slot=10&phase=6N&workspace=/path
 *
 * Returns structured JSON context for the given slot/phase.
 * Defaults to the NPR workspace if workspace not specified.
 */
function handler(req, res, ctx = {}) {
  const url = ctx.url || new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const params = new URLSearchParams(url.search);

  // Resolve workspace directory
  const workspace = params.get('workspace')
    || process.env.NPR_WORKSPACE
    || path.join(process.env.HOME || '/home/claw', '.openclaw', 'workspace');

  // Optional: override phase or derive from slot
  const slot = params.get('slot') ? parseInt(params.get('slot')) : null;
  const phase = params.get('phase') || (slot !== null ? getPhaseFromSlot(slot) : '6N');

  // Validate phase
  if (!PHASE_CONTEXT[phase]) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: `invalid phase: ${phase}`,
      valid: Object.keys(PHASE_CONTEXT),
    }));
    return;
  }

  // Load context
  const result = loadContext(phase, workspace);

  // Also include warehouse manifest and memory summary
  const warehouse = listWarehouse(workspace);
  const summary = memorySummary(workspace);

  // Structured JSON response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    // Meta
    phase,
    label: result.label,
    slot: slot,
    workspace,

    // Context files loaded
    files: result.files,
    chars: result.chars,
    maxChars: PHASE_CONTEXT[phase].maxChars,

    // Raw context text (for agent prompt)
    context: result.context,

    // Warehouse manifest
    warehouse,

    // Memory summary
    memory: summary,
  }, null, 2));
}

module.exports = { handler };
