// @net 10.08.0.0/24
// ═══════════════════════════════════════════════
// language-fields/plc/canonical/representation.cjs
// ═══════════════════════════════════════════════
//
// Canonieke PLC-representatie + validator
//
// Alle PLC-talen mapperen naar deze structuur.
// Dit is het ENIGE model dat npr-local begrijpt.
//
// ═══════════════════════════════════════════════

// ─── Data Types ───

const PLC_TYPES = {
  // Digital
  BOOL: { bits: 1, range: [false, true] },
  
  // Integer
  BYTE: { bits: 8, range: [0, 255] },
  WORD: { bits: 16, range: [0, 65535] },
  DWORD: { bits: 32, range: [0, 4294967295] },
  LWORD: { bits: 64, range: [0, '18446744073709551615'] },
  
  INT: { bits: 16, range: [-32768, 32767] },
  DINT: { bits: 32, range: [-2147483648, 2147483647] },
  LINT: { bits: 64, range: [-9223372036854775808, 9223372036854775807] },
  
  UINT: { bits: 16, range: [0, 65535] },
  UDINT: { bits: 32, range: [0, 4294967295] },
  ULINT: { bits: 64, range: [0, '18446744073709551615'] },
  
  // Real
  REAL: { bits: 32, range: ['-3.4E+38', '3.4E+38'] },
  LREAL: { bits: 64, range: ['-1.8E+308', '1.8E+308'] },
  
  // String
  STRING: { bits: -1, range: ['', ''] }, // variable length
  
  // Time
  TIME: { bits: 32, range: ['-24D', '24D'] },
  TON: { bits: 64, range: [0, '999H'] },
  TOF: { bits: 64, range: [0, '999H'] },
  TP: { bits: 64, range: [0, '999H'] },
  
  // Counter
  CTU: { bits: 32, range: [0, 9999] },
  CTD: { bits: 32, range: [0, 9999] },
  CTUD: { bits: 32, range: [0, 9999] },
};

// ─── Safety Categories (EN 62061) ───

const SAFETY_CATEGORIES = {
  CAT1: { name: 'Basic', description: 'Single channel, no monitoring' },
  CAT2: { name: 'Monitored', description: 'Single channel, with monitoring' },
  CAT3: { name: 'Fault-tolerant', description: 'Multi-channel, limited fault tolerance' },
  CAT4: { name: 'High fault-tolerant', description: 'Multi-channel, high fault tolerance' },
};

// ─── Timer Types ───

const TIMER_TYPES = {
  TON: { name: 'On-Delay', description: 'Starts timing when IN goes TRUE' },
  TOF: { name: 'Off-Delay', description: 'Starts timing when IN goes FALSE' },
  TP: { name: 'Pulse', description: 'Generates pulse of PT duration' },
};

// ─── Counter Types ───

const COUNTER_TYPES = {
  CTU: { name: 'Count Up', description: 'Counts up on CU pulse' },
  CTD: { name: 'Count Down', description: 'Counts down on CD pulse' },
  CTUD: { name: 'Count Up/Down', description: 'Counts up/down on CU/CD' },
};

// ─── Create Empty PLC Model ───

function createEmptyPLC(options = {}) {
  return {
    controller: {
      id: options.id || 'PLC-001',
      vendor: options.vendor || 'generic',
      model: options.model || 'unknown',
      firmware: null,
      scan_time_ms: options.scanTimeMs || 5,
      safety_rated: options.safetyRated || false,
    },
    
    io: {
      inputs: [],
      outputs: [],
    },
    
    tasks: [],
    networks: [],
    timers: [],
    counters: [],
    interlocks: [],
    alarms: [],
    transitions: [],
    state: [],
    
    scan_cycle: {
      input_scan_ms: 1,
      program_exec_ms: 3,
      output_update_ms: 1,
      total_cycle_ms: 5,
      jitter_ms: 0.5,
    },
    
    provenance: {
      source_file: null,
      imported_at: new Date().toISOString(),
      parser_version: '0.0.1',
      original_language: null,
      validation_status: 'empty',
      validation_errors: [],
    },
  };
}

// ─── Validate PLC Model ───

function validatePLC(model) {
  const errors = [];
  const warnings = [];
  
  // Required fields
  if (!model.controller) {
    errors.push('Missing controller object');
  }
  if (!model.io) {
    errors.push('Missing io object');
  }
  if (!model.provenance) {
    errors.push('Missing provenance object');
  }
  
  // Controller validation
  if (model.controller) {
    if (!model.controller.id) {
      errors.push('Controller missing id');
    }
    if (model.controller.safety_rated && model.controller.scan_time_ms > 10) {
      warnings.push('Safety-rated controller has high scan time (>10ms)');
    }
  }
  
  // I/O validation
  if (model.io) {
    const inputMap = new Map();
    const outputMap = new Map();
    
    // Check for duplicate addresses
    for (const input of (model.io.inputs || [])) {
      if (inputMap.has(input.address)) {
        errors.push(`Duplicate input address: ${input.address}`);
      }
      inputMap.set(input.address, input);
      
      if (!input.symbolic) errors.push(`Input ${input.address} missing symbolic name`);
      if (!input.type) errors.push(`Input ${input.address} missing type`);
      if (input.type && !['digital', 'analog'].includes(input.type)) {
        errors.push(`Input ${input.address} invalid type: ${input.type}`);
      }
    }
    
    for (const output of (model.io.outputs || [])) {
      if (outputMap.has(output.address)) {
        errors.push(`Duplicate output address: ${output.address}`);
      }
      outputMap.set(output.address, output);
      
      if (!output.symbolic) errors.push(`Output ${output.address} missing symbolic name`);
      if (!output.type) errors.push(`Output ${output.address} missing type`);
      if (output.type && !['digital', 'analog'].includes(output.type)) {
        errors.push(`Output ${output.address} invalid type: ${output.type}`);
      }
      if (!output.fail_state) {
        warnings.push(`Output ${output.address} missing fail_state (safety risk)`);
      }
    }
    
    // Check for I/O address conflicts
    for (const [addr, input] of inputMap) {
      if (outputMap.has(addr)) {
        errors.push(`Address conflict: ${addr} used as both input and output`);
      }
    }
  }
  
  // Network validation
  if (model.networks) {
    const outputWriters = new Map();
    
    for (const network of model.networks) {
      if (!network.id) errors.push('Network missing id');
      if (!network.logic) errors.push(`Network ${network.id} missing logic`);
      
      // Track which outputs are written by which networks
      if (network.logic?.output) {
        const output = network.logic.output;
        if (!outputWriters.has(output)) {
          outputWriters.set(output, []);
        }
        outputWriters.get(output).push(network.id);
      }
    }
    
    // Warn about multiple writers
    for (const [output, writers] of outputWriters) {
      if (writers.length > 1) {
        warnings.push(`Output ${output} written by multiple networks: ${writers.join(', ')}`);
      }
    }
  }
  
  // Safety interlock validation
  if (model.interlocks) {
    for (const interlock of model.interlocks) {
      if (!interlock.id) errors.push('Interlock missing id');
      if (!interlock.condition) errors.push(`Interlock ${interlock.id} missing condition`);
      if (!interlock.affected_outputs) {
        errors.push(`Interlock ${interlock.id} missing affected_outputs`);
      }
      if (interlock.safety_critical && interlock.type === 'software') {
        warnings.push(`Safety-critical interlock ${interlock.id} is software-only (consider hardwired)`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    warnings: warnings.length === 0,
    errors,
    warnings,
  };
}

// ─── Trace Output to Inputs ───

function traceOutput(model, outputSymbolic) {
  const trace = {
    output: outputSymbolic,
    writers: [],
    conditions: [],
    timers: [],
    counters: [],
    interlocks: [],
    physicalInputs: [],
    safetyChecks: [],
  };
  
  // Find all networks that write this output
  for (const network of (model.networks || [])) {
    if (network.logic?.output === outputSymbolic) {
      trace.writers.push(network.id);
      
      // Collect conditions
      for (const condition of (network.logic.conditions || [])) {
        trace.conditions.push({
          network: network.id,
          type: condition.type,
          input: condition.input,
          state: condition.state,
        });
      }
      
      // Collect timer/counter dependencies
      for (const dep of (network.logic.dependencies || [])) {
        if (dep.type === 'timer') {
          const timer = model.timers?.find(t => t.id === dep.id);
          if (timer) trace.timers.push(timer);
        }
        if (dep.type === 'counter') {
          const counter = model.counters?.find(c => c.id === dep.id);
          if (counter) trace.counters.push(counter);
        }
      }
      
      // Collect interlocks
      for (const interlockId of (network.logic.interlocks || [])) {
        const interlock = model.interlocks?.find(i => i.id === interlockId);
        if (interlock) {
          trace.interlocks.push(interlock);
          if (interlock.safety_critical) {
            trace.safetyChecks.push(interlock);
          }
        }
      }
    }
  }
  
  // Find physical inputs
  for (const condition of trace.conditions) {
    const input = model.io?.inputs?.find(i => i.symbolic === condition.input || i.address === condition.input);
    if (input && input.physical) {
      trace.physicalInputs.push(input);
    }
  }
  
  return trace;
}

// ─── Detect Dead Logic ───

function detectDeadLogic(model) {
  const dead = [];
  
  // Find outputs that are never written
  const writtenOutputs = new Set();
  for (const network of (model.networks || [])) {
    if (network.logic?.output) {
      writtenOutputs.add(network.logic.output);
    }
  }
  
  for (const output of (model.io.outputs || [])) {
    if (!writtenOutputs.has(output.symbolic)) {
      dead.push({
        type: 'unwritten_output',
        id: output.symbolic,
        address: output.address,
        message: `Output ${output.symbolic} (${output.address}) is never written by any network`,
      });
    }
  }
  
  // Find timers that are never triggered
  const triggeredTimers = new Set();
  for (const network of (model.networks || [])) {
    for (const dep of (network.logic.dependencies || [])) {
      if (dep.type === 'timer') triggeredTimers.add(dep.id);
    }
  }
  
  for (const timer of (model.timers || [])) {
    if (!triggeredTimers.has(timer.id)) {
      dead.push({
        type: 'untriggered_timer',
        id: timer.id,
        message: `Timer ${timer.id} is never triggered by any network`,
      });
    }
  }
  
  return dead;
}

// ─── Detect Conflicting Coils ───

function detectConflictingCoils(model) {
  const conflicts = [];
  
  const outputWriters = new Map();
  for (const network of (model.networks || [])) {
    if (network.logic?.output) {
      const output = network.logic.output;
      if (!outputWriters.has(output)) {
        outputWriters.set(output, []);
      }
      outputWriters.get(output).push(network);
    }
  }
  
  for (const [output, writers] of outputWriters) {
    if (writers.length > 1) {
      // Check if they can conflict (same task/scan cycle)
      const tasks = new Set();
      for (const writer of writers) {
        for (const task of (model.tasks || [])) {
          if (task.networks?.includes(writer.id)) {
            tasks.add(task.id);
          }
        }
      }
      
      if (tasks.size === 1) {
        // Same task = definite conflict
        conflicts.push({
          type: 'same_task_conflict',
          output,
          writers: writers.map(w => w.id),
          task: [...tasks][0],
          severity: 'error',
          message: `Output ${output} written by multiple networks in same task`,
        });
      } else {
        // Different tasks = potential conflict
        conflicts.push({
          type: 'cross_task_conflict',
          output,
          writers: writers.map(w => w.id),
          tasks: [...tasks],
          severity: 'warning',
          message: `Output ${output} written by networks in different tasks`,
        });
      }
    }
  }
  
  return conflicts;
}

// ─── Exports ───

module.exports = {
  PLC_TYPES,
  SAFETY_CATEGORIES,
  TIMER_TYPES,
  COUNTER_TYPES,
  createEmptyPLC,
  validatePLC,
  traceOutput,
  detectDeadLogic,
  detectConflictingCoils,
};
