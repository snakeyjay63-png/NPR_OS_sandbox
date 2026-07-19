// @net 10.08.2.1/24
// ═══════════════════════════════════════════════
// language-fields/plc/analyzer/fault-tree.cjs
// ═══════════════════════════════════════════════
//
// Fault Tree Analysis (FTA) — PLC model → failure tree
//
// Top-down deductive: wat kan falen → waarom → hoe waarschijnlijk
//
// Output:
//   - Fault tree (boomstructuur)
//   - Cut sets (minimale combinaties die top-event veroorzaken)
//   - Criticality ranking
//   - Safety recommendation
//
// ═══════════════════════════════════════════════

// ─── Gate Types ───

const GATE_TYPES = {
  AND:   'AND',   // Alle ingangen moeten falen
  OR:    'OR',    // Eén ingang faalt → uitgang faalt
  VOTE:  'VOTE',  // k-uut-n (majority vote)
  INHIBIT: 'INHIBIT', // Ingang faalt + conditie waar → uitgang faalt
};

// ─── Event Types ───

const EVENT_TYPES = {
  TOP:       'TOP',       // Top event (systeemfalen)
  INTERMEDIATE: 'INTERMEDIATE', // Tussen-event (sub-falen)
  BASIC:     'BASIC',     // Basis-event (geen verdere decompositie)
  UND:       'UND',       // Onbekend / niet onderzocht
  TRANSPORT: 'TRANSPORT', // Event uit andere deel van boom
};

// ─── Default Failure Rates (per uur) ───

const DEFAULT_FAILURE_RATES = {
  // Digital inputs
  'input_stuck_high': 1e-6,
  'input_stuck_low':  1e-6,
  'input_noise':      5e-6,
  
  // Digital outputs
  'output_stuck_on':   2e-6,
  'output_stuck_off':  2e-6,
  'output_relay_wear': 1e-5,
  
  // Processor
  'cpu_crash':        1e-7,
  'memory_corruption': 5e-8,
  'scan_timeout':     1e-6,
  'watchdog_failure': 1e-7,
  
  // Communication
  'comm_timeout':     1e-5,
  'comm_corruption':  5e-7,
  
  // Power
  'power_loss':       1e-4,
  'power_sag':        5e-4,
  'power_spike':      1e-5,
  
  // Safety
  'interlock_bypass': 1e-8,
  'sensor_failure':   1e-5,
  'actuator_failure': 2e-5,
};

// ─── Fault Tree Node ───

class FaultNode {
  constructor(id, type, label) {
    this.id = id;
    this.type = type; // EVENT_TYPES
    this.label = label;
    this.gate = null;    // GATE_TYPES (for intermediate)
    this.children = [];
    this.failureRate = 0; // per hour (for basic events)
    this.importance = 0;  // Fussell-Vesely importance
    this.metadata = {};
  }
}

// ─── Build Fault Tree From PLC Model ───

function buildFaultTree(model, options = {}) {
  const topEventLabel = options.topEvent || 'System Failure';
  
  const tree = {
    topEvent: new FaultNode('TOP', EVENT_TYPES.TOP, topEventLabel),
    allNodes: new Map(),
    cutSets: [],
    criticality: [],
    recommendations: [],
  };
  
  // Register top event
  tree.allNodes.set('TOP', tree.topEvent);
  
  // Build sub-trees based on model structure
  buildOutputFailureTrees(model, tree);
  buildSafetyFailureTrees(model, tree);
  buildProcessorFailureTrees(model, tree);
  buildPowerFailureTrees(model, tree);
  
  // Compute cut sets
  tree.cutSets = computeCutSets(tree.topEvent, tree.allNodes);
  
  // Compute importance
  computeImportance(tree);
  
  // Generate recommendations
  tree.recommendations = generateRecommendations(tree);
  
  return tree;
}

// ─── Output Failure Sub-Tree ───

function buildOutputFailureTrees(model, tree) {
  const outputs = model.io?.outputs || [];
  if (outputs.length === 0) return;
  
  // Top event → OR gate (any output failure = system failure)
  const outputGate = createNode(tree, 'OR', 'Any Output Failure');
  tree.topEvent.gate = GATE_TYPES.OR;
  tree.topEvent.children.push(outputGate);
  
  for (const output of outputs) {
    // Each output can fail in multiple ways
    const outGate = createNode(tree, 'OR', `${output.symbolic} Failure`);
    outputGate.children.push(outGate);
    
    // Stuck on
    const stuckOn = createBasicNode(tree, `stuck_on_${output.symbolic}`,
      `${output.symbolic} Stuck ON`, DEFAULT_FAILURE_RATES.output_stuck_on);
    outGate.children.push(stuckOn);
    
    // Stuck off
    const stuckOff = createBasicNode(tree, `stuck_off_${output.symbolic}`,
      `${output.symbolic} Stuck OFF`, DEFAULT_FAILURE_RATES.output_stuck_off);
    outGate.children.push(stuckOff);
    
    // If safety-critical, add relay wear
    if (output.safety_critical) {
      const relayWear = createBasicNode(tree, `relay_${output.symbolic}`,
        `${output.symbolic} Relay Wear`, DEFAULT_FAILURE_RATES.output_relay_wear);
      outGate.children.push(relayWear);
    }
    
    // Trace logic: if output written by networks with conditions,
    // add input failures as contributors
    const writers = (model.networks || []).filter(n => n.logic?.output === output.symbolic);
    if (writers.length > 0) {
      const logicGate = createNode(tree, 'OR', `${output.symbolic} Logic Fault`);
      outGate.children.push(logicGate);
      
      for (const writer of writers) {
        for (const cond of (writer.logic.conditions || [])) {
          // Input stuck in wrong state
          const inputFailure = createBasicNode(tree,
            `input_fault_${cond.input}`,
            `${cond.input} Sensor/Contact Fault`,
            DEFAULT_FAILURE_RATES.sensor_failure);
          logicGate.children.push(inputFailure);
        }
      }
    }
  }
}

// ─── Safety Failure Sub-Tree ───

function buildSafetyFailureTrees(model, tree) {
  const interlocks = model.interlocks || [];
  if (interlocks.length === 0) return;
  
  const safetyGate = createNode(tree, 'OR', 'Safety System Failure');
  tree.topEvent.children.push(safetyGate);
  
  for (const interlock of interlocks) {
    const ilGate = createNode(tree, 'AND', `${interlock.id} Bypassed`);
    safetyGate.children.push(ilGate);
    
    // Interlock fails if condition fails AND software fails (AND = both must happen)
    const condFail = createBasicNode(tree,
      `cond_fail_${interlock.id}`,
      `${interlock.id} Condition Failed`,
      DEFAULT_FAILURE_RATES.sensor_failure);
    ilGate.children.push(condFail);
    
    const swFail = createBasicNode(tree,
      `sw_fail_${interlock.id}`,
      `${interlock.id} Software Bypass`,
      DEFAULT_FAILURE_RATES.interlock_bypass);
    ilGate.children.push(swFail);
  }
}

// ─── Processor Failure Sub-Tree ───

function buildProcessorFailureTrees(model, tree) {
  const procGate = createNode(tree, 'OR', 'Processor Failure');
  tree.topEvent.children.push(procGate);
  
  // CPU crash
  const cpuCrash = createBasicNode(tree, 'cpu_crash',
    'CPU Crash / Lockup', DEFAULT_FAILURE_RATES.cpu_crash);
  procGate.children.push(cpuCrash);
  
  // Memory corruption
  const memCorrupt = createBasicNode(tree, 'mem_corrupt',
    'Memory Corruption', DEFAULT_FAILURE_RATES.memory_corruption);
  procGate.children.push(memCorrupt);
  
  // Scan timeout
  const scanTO = createBasicNode(tree, 'scan_timeout',
    'Scan Cycle Timeout', DEFAULT_FAILURE_RATES.scan_timeout);
  procGate.children.push(scanTO);
  
  // Watchdog failure
  const wdFail = createBasicNode(tree, 'watchdog_fail',
    'Watchdog Failure', DEFAULT_FAILURE_RATES.watchdog_failure);
  procGate.children.push(wdFail);
}

// ─── Power Failure Sub-Tree ───

function buildPowerFailureTrees(model, tree) {
  const powerGate = createNode(tree, 'OR', 'Power System Failure');
  tree.topEvent.children.push(powerGate);
  
  // Power loss
  const pLoss = createBasicNode(tree, 'power_loss',
    'Total Power Loss', DEFAULT_FAILURE_RATES.power_loss);
  powerGate.children.push(pLoss);
  
  // Power sag → AND gate: sag + no UPS → system failure
  const sagGate = createNode(tree, 'AND', 'Power Sag Impact');
  powerGate.children.push(sagGate);
  
  const sag = createBasicNode(tree, 'power_sag',
    'Power Sag (<80% voltage)', DEFAULT_FAILURE_RATES.power_sag);
  sagGate.children.push(sag);
  
  const noUps = createBasicNode(tree, 'no_ups',
    'No UPS / UPS Failed', DEFAULT_FAILURE_RATES.power_loss);
  sagGate.children.push(noUps);
  
  // Power spike
  const spike = createBasicNode(tree, 'power_spike',
    'Power Spike / Surge', DEFAULT_FAILURE_RATES.power_spike);
  powerGate.children.push(spike);
}

// ─── Node Helpers ───

let nodeIdCounter = 0;

function createNode(tree, gateType, label) {
  const id = `INT_${++nodeIdCounter}`;
  const node = new FaultNode(id, EVENT_TYPES.INTERMEDIATE, label);
  node.gate = gateType;
  tree.allNodes.set(id, node);
  return node;
}

function createBasicNode(tree, suffix, label, rate) {
  const id = `BASIC_${suffix.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  const node = new FaultNode(id, EVENT_TYPES.BASIC, label);
  node.failureRate = rate || DEFAULT_FAILURE_RATES[suffix] || 1e-6;
  tree.allNodes.set(id, node);
  return node;
}

// ─── Cut Set Analysis ───

function computeCutSets(topNode, allNodes) {
  const cutSetsRaw = extractCutSets(topNode);
  
  // Minimal cut sets: remove any superset
  const minimal = [];
  for (const cs of cutSetsRaw) {
    const csSet = new Set(cs);
    const isSuperset = minimal.some(m => {
      const mSet = new Set(m);
      return mSet.size <= csSet.size && [...mSet].every(x => csSet.has(x));
    });
    if (!isSuperset) {
      minimal.push(cs);
      // Remove any existing sets that are supersets of this new one
      for (let i = minimal.length - 1; i >= 0; i--) {
        const existing = new Set(minimal[i]);
        if (existing.size > csSet.size && [...csSet].every(x => existing.has(x))) {
          minimal.splice(i, 1);
        }
      }
    }
  }
  
  return minimal.map(cs => ({
    events: cs,
    order: cs.length, // cut set order = number of basic events
  }));
}

function extractCutSets(node) {
  // Basic event: single cut set
  if (node.type === EVENT_TYPES.BASIC) {
    return [[node.id]];
  }
  
  // No children: undecomposed
  if (node.children.length === 0) {
    return [[node.id]];
  }
  
  // OR gate: union of children cut sets
  if (node.gate === GATE_TYPES.OR) {
    const all = [];
    for (const child of node.children) {
      all.push(...extractCutSets(child));
    }
    return all;
  }
  
  // AND gate: cartesian product of children cut sets
  if (node.gate === GATE_TYPES.AND) {
    const childSets = node.children.map(c => extractCutSets(c));
    return cartesianProduct(...childSets);
  }
  
  // VOTE k-out-of-n
  if (node.gate === GATE_TYPES.VOTE) {
    const k = node.metadata?.k || Math.ceil(node.children.length / 2);
    const childSets = node.children.map(c => extractCutSets(c));
    return voteCutSets(childSets, k);
  }
  
  // INHIBIT: treat as AND
  if (node.gate === GATE_TYPES.INHIBIT) {
    const childSets = node.children.map(c => extractCutSets(c));
    return cartesianProduct(...childSets);
  }
  
  // Default: treat as OR
  const all = [];
  for (const child of node.children) {
    all.push(...extractCutSets(child));
  }
  return all;
}

function cartesianProduct(...arrays) {
  if (arrays.length === 0) return [[]];
  if (arrays.length === 1) return arrays[0].map(a => [a]);
  
  const result = [];
  const rest = cartesianProduct(...arrays.slice(1));
  for (const first of arrays[0]) {
    for (const r of rest) {
      result.push([first, ...r]);
    }
  }
  return result;
}

function voteCutSets(childSets, k) {
  // Simplified: for k-out-of-n, combine one event from each of k children
  if (childSets.length <= k) {
    return cartesianProduct(...childSets);
  }
  
  // Generate all k-combinations of children, then cartesian product
  const combos = combinations(childSets, k);
  const result = [];
  for (const combo of combos) {
    result.push(...cartesianProduct(...combo));
  }
  return result;
}

function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length === 0) return [];
  
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

// ─── Importance Analysis (Fussell-Vesely) ───

function computeImportance(tree) {
  const allNodes = tree.allNodes;
  const cutSets = tree.cutSets;
  
  if (cutSets.length === 0) return;
  
  // For each basic event, compute Fussell-Vesely importance
  // IV_j = (number of cut sets containing j) / (total cut sets)
  // Weighted by cut set probability
  for (const [id, node] of allNodes) {
    if (node.type !== EVENT_TYPES.BASIC) continue;
    
    const csContaining = cutSets.filter(cs => cs.events.includes(id));
    const totalCs = cutSets.length;
    
    // Simple importance: fraction of cut sets this event appears in
    node.importance = totalCs > 0 ? csContaining.length / totalCs : 0;
    
    // Weighted by cut set order (lower order = more critical)
    node.weightedImportance = csContaining.reduce((sum, cs) => {
      return sum + (1 / cs.order);
    }, 0);
  }
  
  // Sort criticality
  tree.criticality = [...allNodes.values()]
    .filter(n => n.type === EVENT_TYPES.BASIC)
    .sort((a, b) => b.weightedImportance - a.weightedImportance)
    .slice(0, 10)
    .map(n => ({
      id: n.id,
      label: n.label,
      importance: n.importance,
      weightedImportance: n.weightedImportance,
      failureRate: n.failureRate,
    }));
}

// ─── Recommendations ───

function generateRecommendations(tree) {
  const recs = [];
  
  // High-importance basic events need redundancy
  for (const item of (tree.criticality || [])) {
    if (item.weightedImportance > 0.3) {
      recs.push({
        priority: 'HIGH',
        event: item.id,
        label: item.label,
        recommendation: `Add redundancy for "${item.label}" (importance: ${(item.weightedImportance * 100).toFixed(1)}%)`,
      });
    }
  }
  
  // Single-point failures (order-1 cut sets)
  const singlePoint = tree.cutSets?.filter(cs => cs.order === 1);
  if (singlePoint?.length > 0) {
    for (const cs of singlePoint) {
      const node = tree.allNodes.get(cs.events[0]);
      if (node) {
        recs.push({
          priority: 'CRITICAL',
          event: cs.events[0],
          label: node.label,
          recommendation: `Eliminate single-point failure: "${node.label}" — add parallel safety path`,
        });
      }
    }
  }
  
  // Safety-critical outputs without interlocks
  if (tree._model) {
    for (const output of (tree._model.io?.outputs || [])) {
      if (output.safety_critical) {
        const hasInterlock = (tree._model.interlocks || []).some(
          il => il.affected_outputs?.includes(output.symbolic)
        );
        if (!hasInterlock) {
          recs.push({
            priority: 'HIGH',
            event: `interlock_${output.symbolic}`,
            label: `${output.symbolic}`,
            recommendation: `Safety-critical output "${output.symbolic}" has no interlock — add hardware interlock`,
          });
        }
      }
    }
  }
  
  // Sort: CRITICAL first, then HIGH, then MEDIUM
  const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  recs.sort((a, b) => (priorityOrder[a.priority] || 9) - (priorityOrder[b.priority] || 9));
  
  return recs;
}

// ─── Serialize Tree for API ───

function serializeTree(tree) {
  return {
    topEvent: {
      id: tree.topEvent.id,
      label: tree.topEvent.label,
      gate: tree.topEvent.gate,
      children: tree.topEvent.children.map(c => serializeNode(c)),
    },
    cutSets: tree.cutSets,
    minimalCutSetCount: tree.cutSets?.length || 0,
    criticality: tree.criticality,
    recommendations: tree.recommendations,
    summary: {
      totalNodes: tree.allNodes.size,
      basicEvents: [...tree.allNodes.values()].filter(n => n.type === EVENT_TYPES.BASIC).length,
      intermediateEvents: [...tree.allNodes.values()].filter(n => n.type === EVENT_TYPES.INTERMEDIATE).length,
      cutSets: tree.cutSets?.length || 0,
      singlePointFailures: tree.cutSets?.filter(cs => cs.order === 1).length || 0,
      criticalRecommendations: tree.recommendations?.filter(r => r.priority === 'CRITICAL').length || 0,
    },
  };
}

function serializeNode(node) {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
    gate: node.gate,
    failureRate: node.failureRate,
    importance: node.importance,
    weightedImportance: node.weightedImportance,
    children: node.children.map(c => serializeNode(c)),
  };
}

// ─── Exports ───

module.exports = {
  GATE_TYPES,
  EVENT_TYPES,
  DEFAULT_FAILURE_RATES,
  FaultNode,
  buildFaultTree,
  computeCutSets,
  computeImportance,
  generateRecommendations,
  serializeTree,
  serializeNode,
};
