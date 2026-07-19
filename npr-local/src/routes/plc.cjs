// @net 10.08.2.0/24
// ═══════════════════════════════════════════════
// routes/plc.cjs — PLC Taalveld REST Endpoints
// ═══════════════════════════════════════════════
//
// POST   /plc/parse          — Parse ST code
// POST   /plc/parse-ladder   — Parse Ladder code
// POST   /plc/convert        — Ladder → ST converter
// GET    /plc/io-map         — I/O mapping
// POST   /plc/trace          — Trace output → inputs
// GET    /plc/analyze        — Run analysis
// POST   /plc/fault-tree     — Fault tree analysis
// GET    /plc/status         — Parser/analyzer status
//
// ═══════════════════════════════════════════════

const { parseST } = require('../language-fields/plc/parser/st-parser.cjs');
const { parseLadder } = require('../language-fields/plc/parser/ladder-parser.cjs');
const { buildFaultTree, serializeTree } = require('../language-fields/plc/analyzer/fault-tree.cjs');
const {
  traceOutput,
  detectDeadLogic,
  detectConflictingCoils,
  validatePLC,
  createEmptyPLC,
} = require('../language-fields/plc/canonical/representation.cjs');

// ─── In-memory PLC store (Fase 1: geen database) ───

const plcStore = new Map();

// ─── POST /plc/parse (auto-detect ST or Ladder) ───

function handlerParse(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const body = req.body || {};
  const { code, plcId, sourceFile, safetyRated, language } = body;
  
  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' });
  }
  
  try {
    let result;
    const lang = (language || '').toLowerCase();
    
    // Auto-detect: "rung" keyword = Ladder, otherwise ST
    if (lang === 'ladder' || lang === 'lad' || code.trim().toLowerCase().startsWith('rung')) {
      result = parseLadder(code, {
        plcId: plcId || `PLC-${Date.now()}`,
        sourceFile,
        safetyRated: safetyRated || false,
      });
    } else {
      result = parseST(code, {
        plcId: plcId || `PLC-${Date.now()}`,
        sourceFile,
        safetyRated: safetyRated || false,
      });
    }
    
    if (result.plcId) {
      plcStore.set(result.plcId, result);
    }
    
    res.json({
      success: true,
      plcId: result.plcId,
      validation: result.validation,
      model: result.model,
      st: result.st || undefined, // Ladder parse returns ST too
    });
    
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}

// ─── GET /plc/io-map ───

function handlerIoMap(req, res) {
  const plcId = (req.query || {}).plcId || null;
  
  if (!plcId) {
    return res.status(400).json({ error: 'Missing plcId parameter' });
  }
  
  const stored = plcStore.get(plcId);
  if (!stored) {
    return res.status(404).json({ error: `PLC ${plcId} not found` });
  }
  
  const model = stored.model;
  
  res.json({
    success: true,
    plcId,
    inputs: model.io.inputs,
    outputs: model.io.outputs,
    state: model.state,
  });
}

// ─── POST /plc/trace ───

function handlerTrace(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const body = req.body || {};
  const { plcId, output } = body;
  
  if (!plcId || !output) {
    return res.status(400).json({ error: 'Missing plcId or output parameter' });
  }
  
  const stored = plcStore.get(plcId);
  if (!stored) {
    return res.status(404).json({ error: `PLC ${plcId} not found` });
  }
  
  const trace = traceOutput(stored.model, output);
  
  res.json({
    success: true,
    plcId,
    output,
    trace,
  });
}

// ─── GET /plc/analyze ───

function handlerAnalyze(req, res) {
  const plcId = (req.query || {}).plcId || null;
  const analysis = (req.query || {}).type || 'all';
  
  if (!plcId) {
    return res.status(400).json({ error: 'Missing plcId parameter' });
  }
  
  const stored = plcStore.get(plcId);
  if (!stored) {
    return res.status(404).json({ error: `PLC ${plcId} not found` });
  }
  
  const model = stored.model;
  const results = {};
  
  // Run requested analyses
  if (analysis === 'all' || analysis === 'dead-logic') {
    results.deadLogic = detectDeadLogic(model);
  }
  
  if (analysis === 'all' || analysis === 'conflicts') {
    results.conflicts = detectConflictingCoils(model);
  }
  
  if (analysis === 'all' || analysis === 'validation') {
    results.validation = validatePLC(model);
  }
  
  res.json({
    success: true,
    plcId,
    analysis,
    results,
  });
}

// ─── POST /plc/parse-ladder ───

function handlerParseLadder(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const body = req.body || {};
  const { code, plcId, sourceFile, safetyRated } = body;
  
  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' });
  }
  
  try {
    const result = parseLadder(code, {
      plcId: plcId || `PLC-LAD-${Date.now()}`,
      sourceFile,
      safetyRated: safetyRated || false,
    });
    
    if (result.plcId) {
      plcStore.set(result.plcId, result);
    }
    
    res.json({
      success: true,
      plcId: result.plcId,
      validation: result.validation,
      model: result.model,
    });
    
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}

// ─── POST /plc/convert (Ladder → ST) ───

function handlerConvert(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const body = req.body || {};
  const { code, plcId, sourceFile, safetyRated, language } = body;
  
  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' });
  }
  
  try {
    let result;
    const lang = (language || 'ladder').toLowerCase();
    
    if (lang === 'ladder' || lang === 'lad') {
      result = parseLadder(code, {
        plcId: plcId || `PLC-CONV-${Date.now()}`,
        sourceFile,
        safetyRated: safetyRated || false,
      });
    } else {
      return res.status(400).json({
        error: `Unsupported source language: ${language}. Use "ladder" or "lad".`,
      });
    }
    
    if (result.plcId) {
      plcStore.set(result.plcId, result);
    }
    
    res.json({
      success: true,
      plcId: result.plcId,
      validation: result.validation,
      st: result.st,
      model: result.model,
    });
    
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}

// ─── POST /plc/fault-tree ───

function handlerFaultTree(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const body = req.body || {};
  const { plcId, code, topEvent } = body;
  
  let model;
  
  // If plcId provided, load from store
  if (plcId) {
    const stored = plcStore.get(plcId);
    if (!stored) {
      return res.status(404).json({ error: `PLC ${plcId} not found` });
    }
    model = stored.model;
  } else if (code) {
    // Parse inline code (auto-detect: if starts with "rung" → ladder, else → ST)
    try {
      let result;
      if (code.trim().toLowerCase().startsWith('rung')) {
        result = parseLadder(code, { plcId: `PLC-FTA-${Date.now()}` });
      } else {
        result = parseST(code, { plcId: `PLC-FTA-${Date.now()}` });
      }
      model = result.model;
    } catch (err) {
      return res.status(400).json({ error: `Parse failed: ${err.message}` });
    }
  } else {
    return res.status(400).json({ error: 'Missing plcId or code parameter' });
  }
  
  try {
    const tree = buildFaultTree(model, { topEvent });
    tree._model = model; // for recommendations
    const serialized = serializeTree(tree);
    
    res.json({
      success: true,
      tree: serialized,
    });
    
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}

// ─── GET /plc/status ───

function handlerStatus(req, res) {
  res.json({
    success: true,
    parser: {
      version: '0.0.2',
      supported_languages: ['ST', 'LAD'],
      converters: ['ladder_to_st'],
      analyzers: ['fault_tree', 'dead_logic', 'conflicting_coils'],
    },
    stored_plcs: plcStore.size,
    plc_ids: [...plcStore.keys()],
  });
}

// ─── Exports ───

module.exports = {
  handlerParse,
  handlerParseLadder,
  handlerConvert,
  handlerFaultTree,
  handlerIoMap,
  handlerTrace,
  handlerAnalyze,
  handlerStatus,
  plcStore,
};
