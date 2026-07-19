// @net 10.08.1.1/24
// ═══════════════════════════════════════════════
// language-fields/plc/parser/ladder-parser.cjs
// ═══════════════════════════════════════════════
//
// Ladder Logic → Canoniek model → Structured Text
//
// Tekst-DSL voor ladder (grafisch is niet typbaar):
//   rung R001 "Motor start"
//     |-- [ NO Start_PB ] -- [ NC Stop_PB ] -- ( ) Motor_On |
//   rung R002 "Motor latch"
//     |-- [ NO Motor_On ] --+
//     |                     |-- [ NC Stop_PB ] -- ( ) Motor_On |
//     |-- [ NO Start_PB ] --+
//
// Contacten:
//   [ NO X ]   — Normally Open (X TRUE → circuit closed)
//   [ NC X ]   — Normally Closed (X FALSE → circuit closed)
//   [ > X 10 ] — Greater-than compare
//   [ < X 10 ] — Less-than compare
//   [ = X 10 ] — Equal compare
//
// Spirals (outputs):
//   ( ) Y       — Coil (output assign)
//   ( / ) Y     — Negated coil
//   (S) Y       — Set coil (latch)
//   (R) Y       — Reset coil (unlatch)
//
// Timers/Counters:
//   | TON T1; PT=5s; EN=Start |
//   | CTU C1; PV=10; CU=Pulse |
//
// ═══════════════════════════════════════════════

const { createEmptyPLC, validatePLC } = require('../canonical/representation.cjs');

// ─── Tokenizer ───

function tokenizeLadder(code) {
  const tokens = [];
  const lines = code.split('\n');
  
  for (let ln = 0; ln < lines.length; ln++) {
    let line = lines[ln].trim();
    if (!line || line.startsWith('//')) continue;
    
    // Rung header: "rung R001" or "rung R001 "comment""
    const rungMatch = line.match(/^rung\s+(\S+)(?:\s+(.+))?$/i);
    if (rungMatch) {
      let comment = rungMatch[2] || '';
      // Strip quotes if present
      comment = comment.replace(/^"|"$/g, '');
      tokens.push({
        type: 'RUNG',
        id: rungMatch[1],
        comment,
        line: ln,
      });
      continue;
    }
    
    // Branch line: |-- ... --+
    // Contact: [ NO X ] | [ NC X ]
    const contacts = line.match(/\[\s*(NO|NC|>|<|=|>=|<=|<>)\s+([^\]]+)\]\s*/gi);
    if (contacts) {
      for (const c of contacts) {
        const m = c.match(/\[\s*(NO|NC|>|<|=|>=|<=|<>)\s+(.+?)\]\s*/i);
        if (m) {
          tokens.push({
            type: 'CONTACT',
            contactType: m[1].toUpperCase(),
            operand: m[2].trim(),
            line: ln,
          });
        }
      }
    }
    
    // Coil: ( ) Y | ( / ) Y | (S) Y | (R) Y
    const coilMatch = line.match(/\(\s*(\/|S|R)?\s*\)\s*([A-Za-z_][A-Za-z0-9_]*)/i);
    if (coilMatch) {
      tokens.push({
        type: 'COIL',
        coilType: coilMatch[1]?.toUpperCase() || 'NORM', // NORM, NEG, SET, RESET
        output: coilMatch[2],
        line: ln,
      });
    }
    
    // Timer: | TON T1; PT=5s; EN=Start |
    const timerMatch = line.match(/\|\s*(TON|TOF|TP)\s+(\S+)\s*;\s*(.+?)\s*\|/i);
    if (timerMatch) {
      const args = {};
      timerMatch[3].split(';').forEach(p => {
        const [k, v] = p.trim().split('=');
        if (k) args[k.trim()] = v?.trim();
      });
      tokens.push({
        type: 'TIMER',
        timerType: timerMatch[1].toUpperCase(),
        instance: timerMatch[2],
        args,
        line: ln,
      });
    }
    
    // Counter: | CTU C1; PV=10; CU=Pulse |
    const counterMatch = line.match(/\|\s*(CTU|CTD|CTUD)\s+(\S+)\s*;\s*(.+?)\s*\|/i);
    if (counterMatch) {
      const args = {};
      counterMatch[3].split(';').forEach(p => {
        const [k, v] = p.trim().split('=');
        if (k) args[k.trim()] = v?.trim();
      });
      tokens.push({
        type: 'COUNTER',
        counterType: counterMatch[1].toUpperCase(),
        instance: counterMatch[2],
        args,
        line: ln,
      });
    }
  }
  
  return tokens;
}

// ─── AST Builder ───

function buildAST(tokens) {
  const rungs = [];
  let currentRung = null;
  
  for (const token of tokens) {
    if (token.type === 'RUNG') {
      if (currentRung) rungs.push(currentRung);
      currentRung = {
        id: token.id,
        comment: token.comment,
        branches: [],
      };
    } else if (currentRung) {
      // Group contacts into branches until coil
      if (token.type === 'CONTACT') {
        // Add to last branch or create new
        if (currentRung.branches.length === 0) {
          currentRung.branches.push({ contacts: [], coil: null });
        }
        currentRung.branches[currentRung.branches.length - 1].contacts.push(token);
      } else if (token.type === 'COIL') {
        if (currentRung.branches.length === 0) {
          currentRung.branches.push({ contacts: [], coil: null });
        }
        currentRung.branches[currentRung.branches.length - 1].coil = token;
      } else if (token.type === 'TIMER' || token.type === 'COUNTER') {
        // Inline as special contact + state
        if (currentRung.branches.length === 0) {
          currentRung.branches.push({ contacts: [], coil: null });
        }
        currentRung.branches[currentRung.branches.length - 1].contacts.push(token);
      }
    }
  }
  
  if (currentRung) rungs.push(currentRung);
  return { rungs };
}

// ─── Ladder → Canoniek PLC Model ───

function ladderToModel(ast, options = {}) {
  const model = createEmptyPLC({
    id: options.plcId || 'PLC-LAD-001',
    safetyRated: options.safetyRated || false,
  });
  
  model.provenance.source_file = options.sourceFile || null;
  model.provenance.original_language = 'LAD';
  
  for (const rung of ast.rungs) {
    for (const branch of rung.branches) {
      const network = {
        id: rung.id,
        comment: rung.comment || `Ladder rung ${rung.id}`,
        source_language: 'LAD',
        logic: {
          type: 'rung',
          branches: [],
          output: null,
          conditions: [],
          dependencies: [],
          interlocks: [],
        },
        safety_critical: false,
      };
      
      // Build conditions from contacts
      for (const contact of branch.contacts) {
        if (contact.type === 'CONTACT') {
          network.logic.conditions.push({
            type: 'contact',
            input: contact.operand,
            state: contact.contactType, // NO, NC, >, <, =, >=, <=, <>
          });
        } else if (contact.type === 'TIMER') {
          // Register timer
          const timer = {
            id: contact.instance,
            type: contact.timerType,
            preset: contact.args.PT || '0s',
            enable: contact.args.EN || 'TRUE',
            in: contact.args.IN || contact.args.EN || 'TRUE',
            pt: contact.args.PT || '0s',
            q: `${contact.instance}.Q`,
            et: `${contact.instance}.ET`,
          };
          model.timers.push(timer);
          network.logic.dependencies.push({
            type: 'timer',
            id: contact.instance,
          });
        } else if (contact.type === 'COUNTER') {
          // Register counter
          const counter = {
            id: contact.instance,
            type: contact.counterType,
            preset: contact.args.PV || '0',
            cu: contact.args.CU || 'FALSE',
            cd: contact.args.CD || 'FALSE',
            rv: `${contact.instance}.RV`,
            q: `${contact.instance}.Q`,
            preset: contact.args.PV || '0',
          };
          model.counters.push(counter);
          network.logic.dependencies.push({
            type: 'counter',
            id: contact.instance,
          });
        }
      }
      
      // Coil → output
      if (branch.coil) {
        const outputSym = branch.coil.output;
        network.logic.output = outputSym;
        network.logic.type = branch.coil.coilType === 'NORM' ? 'coil' :
                              branch.coil.coilType === 'NEG' ? 'negated_coil' :
                              branch.coil.coilType === 'SET' ? 'set_coil' :
                              'reset_coil';
        
        // Register output in I/O
        const existingOut = model.io.outputs.find(o => o.symbolic === outputSym);
        if (!existingOut) {
          model.io.outputs.push({
            symbolic: outputSym,
            address: `Q:${outputSym}`,
            type: 'digital',
            plc_type: 'BOOL',
            fail_state: 'de-energized',
            safety_critical: false,
          });
        }
      }
      
      model.networks.push(network);
    }
  }
  
  const validation = validatePLC(model);
  model.provenance.validation_status = validation.valid ? 'valid' : 'errors';
  model.provenance.validation_errors = validation.errors;
  
  return model;
}

// ─── Canoniek Model → Structured Text ───

function modelToST(model) {
  const lines = [];
  lines.push('// ═══════════════════════════════════════');
  lines.push(`// Auto-generated ST from ${model.provenance.original_language || 'PLC model'}`);
  lines.push(`// Controller: ${model.controller.id}`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push('// ═══════════════════════════════════════');
  lines.push('');
  
  // VAR_INPUT
  if (model.io.inputs.length > 0) {
    lines.push('VAR_INPUT');
    for (const inp of model.io.inputs) {
      const type = inp.plc_type || 'BOOL';
      lines.push(`  ${inp.symbolic} : ${type};`);
    }
    lines.push('END_VAR');
    lines.push('');
  }
  
  // VAR_OUTPUT
  if (model.io.outputs.length > 0) {
    lines.push('VAR_OUTPUT');
    for (const out of model.io.outputs) {
      const type = out.plc_type || 'BOOL';
      lines.push(`  ${out.symbolic} : ${type};`);
    }
    lines.push('END_VAR');
    lines.push('');
  }
  
  // VAR (internal state)
  const hasTimers = model.timers?.length > 0;
  const hasCounters = model.counters?.length > 0;
  const hasState = model.state?.length > 0;
  
  if (hasTimers || hasCounters || hasState) {
    lines.push('VAR');
    if (hasState) {
      for (const s of model.state) {
        const type = s.plc_type || 'BOOL';
        lines.push(`  ${s.symbolic} : ${type};`);
      }
    }
    if (hasTimers) {
      for (const t of model.timers) {
        const typeName = t.type || 'TON';
        lines.push(`  ${t.id} : ${typeName};`);
      }
    }
    if (hasCounters) {
      for (const c of model.counters) {
        const typeName = c.type || 'CTU';
        lines.push(`  ${c.id} : ${typeName};`);
      }
    }
    lines.push('END_VAR');
    lines.push('');
  }
  
  // Body — one block per network
  for (const network of model.networks) {
    const st = networkToSTBlock(network, model);
    if (st) {
      lines.push(`// ${network.comment || network.id}`);
      lines.push(st);
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

// ─── Network → ST Block ───

function networkToSTBlock(network, model) {
  const logic = network.logic;
  if (!logic) return '';
  
  // Simple coil assignment
  if (logic.type === 'coil' || logic.type === 'negated_coil') {
    return assignmentFromConditions(logic.output, logic.conditions, logic.type);
  }
  
  // Set/Reset coil
  if (logic.type === 'set_coil') {
    const condExpr = conditionsToExpression(logic.conditions);
    return `IF ${condExpr} THEN\n  ${logic.output} := TRUE;\nEND_IF;`;
  }
  
  if (logic.type === 'reset_coil') {
    const condExpr = conditionsToExpression(logic.conditions);
    return `IF ${condExpr} THEN\n  ${logic.output} := FALSE;\nEND_IF;`;
  }
  
  // Conditional (IF)
  if (logic.type === 'conditional') {
    const condExpr = conditionsToExpression(logic.conditions);
    return `IF ${condExpr} THEN\n  // ${network.comment}\nEND_IF;`;
  }
  
  // Generic rung with multiple branches
  if (logic.type === 'rung') {
    const branches = [];
    for (const branch of (logic.branches || [])) {
      const branchCond = conditionsToExpression(branch.conditions || logic.conditions);
      if (logic.output) {
        branches.push(`  ${logic.output} := ${branchCond};`);
      }
    }
    return branches.join('\n') || `// ${network.id}: no output assigned`;
  }
  
  return `// ${network.id}: unsupported logic type (${logic.type})`;
}

// ─── Conditions → ST Expression ───

function conditionsToExpression(conditions) {
  if (!conditions || conditions.length === 0) return 'TRUE';
  
  const parts = [];
  for (const cond of conditions) {
    switch (cond.state?.toUpperCase()) {
      case 'NO':
        parts.push(cond.input);
        break;
      case 'NC':
        parts.push(`NOT ${cond.input}`);
        break;
      case '>':
        parts.push(`${cond.input} > ${cond.value || 0}`);
        break;
      case '<':
        parts.push(`${cond.input} < ${cond.value || 0}`);
        break;
      case '>=':
        parts.push(`${cond.input} >= ${cond.value || 0}`);
        break;
      case '<=':
        parts.push(`${cond.input} <= ${cond.value || 0}`);
        break;
      case '=':
        parts.push(`${cond.input} = ${cond.value || 0}`);
        break;
      case '<>':
        parts.push(`${cond.input} <> ${cond.value || 0}`);
        break;
      default:
        parts.push(cond.input);
    }
  }
  
  // Implicit AND between contacts in series
  return parts.join(' AND ');
}

function assignmentFromConditions(output, conditions, type) {
  const expr = conditionsToExpression(conditions);
  if (type === 'negated_coil') {
    return `${output} := NOT (${expr});`;
  }
  return `${output} := ${expr};`;
}

// ─── Main Entry: Parse Ladder → Model → ST ───

function parseLadder(code, options = {}) {
  const tokens = tokenizeLadder(code);
  const ast = buildAST(tokens);
  const model = ladderToModel(ast, options);
  const st = modelToST(model);
  
  const validation = validatePLC(model);
  
  return {
    plcId: model.controller.id,
    model,
    st,
    validation,
    ast: options.debug ? ast : undefined,
    tokens: options.debug ? tokens : undefined,
  };
}

// ─── Exports ───

module.exports = {
  tokenizeLadder,
  buildAST,
  ladderToModel,
  modelToST,
  networkToSTBlock,
  conditionsToExpression,
  parseLadder,
};
