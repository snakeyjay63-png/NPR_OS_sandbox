// @net 10.08.1.0/24
// ═══════════════════════════════════════════════
// language-fields/plc/parser/st-parser.cjs
// ═══════════════════════════════════════════════
//
// Structured Text → Canonieke PLC-representatie
//
// Parsert basic ST: assignments, IF/ELSE, CASE, WHILE, FOR
// Timers, counters, boolean algebra
//
// ═══════════════════════════════════════════════

const {
  createEmptyPLC,
  validatePLC,
  PLC_TYPES,
} = require('../canonical/representation.cjs');

// ─── ST Tokenizer ───

const ST_KEYWORDS = new Set([
  'PROGRAM', 'END_PROGRAM',
  'FUNCTION', 'END_FUNCTION',
  'FUNCTION_BLOCK', 'END_FUNCTION_BLOCK',
  'VAR', 'END_VAR',
  'VAR_INPUT', 'VAR_OUTPUT', 'VAR_IN_OUT',
  'VAR_TEMP', 'VAR_GLOBAL',
  'VAR_EXTERNAL', 'VAR_ACCESS',
  'VAR_CONFIG', 'VAR_RETAIN', 'VAR_NON_RETAIN',
  'CONST', 'RETAIN', 'NON_RETAIN',
  'IF', 'THEN', 'ELSE', 'ELSIF', 'END_IF',
  'CASE', 'OF', 'END_CASE',
  'FOR', 'TO', 'BY', 'DO', 'END_FOR',
  'WHILE', 'END_WHILE',
  'REPEAT', 'UNTIL', 'END_REPEAT',
  'LOOP', 'END_LOOP',
  'EXIT', 'CONTINUE',
  'NOT', 'AND', 'OR', 'XOR', 'MOD', 'DIV',
  'TRUE', 'FALSE', 'NULL',
  'TON', 'TOF', 'TP',
  'CTU', 'CTD', 'CTUD',
]);

const ST_OPERATORS = [
  ':=', '=', '<>', '<', '>', '<=', '>=',
  '+', '-', '*', '/',
  '(', ')', '[', ']',
  ',', ';', '.', ':',
];

function tokenizeST(code) {
  const tokens = [];
  let pos = 0;
  
  while (pos < code.length) {
    // Skip whitespace
    if (/\s/.test(code[pos])) {
      pos++;
      continue;
    }
    
    // Skip comments (// and (* *))
    if (code[pos] === '/' && code[pos + 1] === '/') {
      while (pos < code.length && code[pos] !== '\n') pos++;
      continue;
    }
    if (code[pos] === '(' && code[pos + 1] === '*') {
      pos += 2;
      while (pos < code.length - 1 && !(code[pos] === '*' && code[pos + 1] === ')')) pos++;
      pos += 2;
      continue;
    }
    
    // String literal
    if (code[pos] === '"') {
      let str = '';
      pos++;
      while (pos < code.length && code[pos] !== '"') {
        if (code[pos] === '"') {
          str += '"';
          pos++;
        } else {
          str += code[pos];
          pos++;
        }
      }
      pos++; // closing quote
      tokens.push({ type: 'STRING', value: str, pos: pos });
      continue;
    }
    
    // Number (integer, real, time)
    if (/[0-9]/.test(code[pos])) {
      let num = '';
      while (pos < code.length && /[0-9.]/.test(code[pos])) {
        num += code[pos];
        pos++;
      }
      
      // Check for time suffix
      if (/[DHTMS]/.test(code[pos])) {
        let suffix = '';
        while (pos < code.length && /[DHTMS]/.test(code[pos])) {
          suffix += code[pos];
          pos++;
        }
        tokens.push({ type: 'TIME', value: num + suffix, pos: pos });
      } else {
        const value = parseFloat(num);
        tokens.push({
          type: num.includes('.') ? 'REAL' : 'INT',
          value: value,
          pos: pos,
        });
      }
      continue;
    }
    
    // Identifier or keyword
    if (/[a-zA-Z_]/.test(code[pos])) {
      let ident = '';
      while (pos < code.length && /[a-zA-Z0-9_]/.test(code[pos])) {
        ident += code[pos];
        pos++;
      }
      
      if (ST_KEYWORDS.has(ident.toUpperCase())) {
        tokens.push({ type: 'KEYWORD', value: ident.toUpperCase(), pos: pos });
      } else if (ident.toUpperCase() === 'TRUE' || ident.toUpperCase() === 'FALSE') {
        tokens.push({ type: 'BOOL', value: ident.toUpperCase() === 'TRUE', pos: pos });
      } else {
        tokens.push({ type: 'IDENT', value: ident, pos: pos });
      }
      continue;
    }
    
    // Operators
    for (const op of ST_OPERATORS) {
      if (code.substr(pos, op.length) === op) {
        tokens.push({ type: 'OP', value: op, pos: pos });
        pos += op.length;
        break;
      }
    }
    
    if (pos < code.length) {
      pos++; // skip unknown character
    }
  }
  
  return tokens;
}

// ─── Simple ST Parser ───

function parseST(code, options = {}) {
  const model = createEmptyPLC({
    id: options.plcId || 'PLC-ST-001',
    safetyRated: options.safetyRated || false,
  });
  
  model.provenance.source_file = options.sourceFile || null;
  model.provenance.original_language = 'ST';
  
  const tokens = tokenizeST(code);
  
  // Parse VAR sections
  parseVarSections(tokens, model);
  
  // Parse statements
  parseStatements(tokens, model);
  
  // Validate
  const validation = validatePLC(model);
  model.provenance.validation_status = validation.valid ? 'valid' : 'errors';
  model.provenance.validation_errors = validation.errors;
  
  return {
    plcId: model.id,
    model,
    validation,
    tokens: options.debug ? tokens : undefined,
  };
}

// ─── Parse VAR Sections ───

function parseVarSections(tokens, model) {
  let i = 0;
  
  while (i < tokens.length) {
    if (tokens[i].type === 'KEYWORD' && /VAR/.test(tokens[i].value)) {
      const varType = tokens[i].value;
      i++;
      
      // Parse variables until END_VAR
      while (i < tokens.length && !(tokens[i].type === 'KEYWORD' && tokens[i].value === 'END_VAR')) {
        if (tokens[i].type === 'IDENT') {
          const name = tokens[i].value;
          i++;
          
          // Check for array or type
          let type = 'BOOL';
          if (i < tokens.length && tokens[i].type === 'OP' && tokens[i].value === ':') {
            i++;
            if (i < tokens.length) {
              if (tokens[i].type === 'IDENT') {
                type = tokens[i].value.toUpperCase();
                i++;
              }
            }
          }
          
          // Add to I/O or state based on VAR type
          if (varType.includes('INPUT')) {
            model.io.inputs.push({
              symbolic: name,
              address: `I:${name}`,
              type: type === 'BOOL' ? 'digital' : 'analog',
              plc_type: type,
              safety_critical: false,
            });
          } else if (varType.includes('OUTPUT')) {
            model.io.outputs.push({
              symbolic: name,
              address: `Q:${name}`,
              type: type === 'BOOL' ? 'digital' : 'analog',
              plc_type: type,
              fail_state: 'de-energized',
              safety_critical: false,
            });
          } else {
            model.state.push({
              symbolic: name,
              address: `DB:${name}`,
              type: type.toLowerCase(),
              plc_type: type,
              retained: varType.includes('RETAIN'),
            });
          }
        }
        i++;
      }
      i++; // skip END_VAR
    } else {
      i++;
    }
  }
}

// ─── Parse Statements ───

function parseStatements(tokens, model) {
  let networkId = 1;
  let i = 0;
  
  while (i < tokens.length) {
    // Find assignment statements
    if (tokens[i].type === 'IDENT' && i + 2 < tokens.length && 
        tokens[i + 1].type === 'OP' && tokens[i + 1].value === ':=') {
      
      const output = tokens[i].value;
      i += 2; // skip IDENT + :=
      
      // Parse expression
      const { text, conditions, dependencies, endIndex } = parseExpression(tokens, i);
      i = endIndex;
      
      // Create network
      const network = {
        id: `N${String(networkId++).padStart(3, '0')}`,
        comment: `Assignment: ${output}`,
        source_language: 'ST',
        source_code: `${output} := ${text}`,
        logic: {
          type: 'coil',
          output: output,
          conditions,
          dependencies,
          interlocks: [],
        },
        safety_critical: false,
      };
      
      model.networks.push(network);
      
      // Skip semicolon
      if (i < tokens.length && tokens[i].type === 'OP' && tokens[i].value === ';') {
        i++;
      }
    }
    // Find IF statements
    else if (tokens[i].type === 'KEYWORD' && tokens[i].value === 'IF') {
      const { network, endIndex } = parseIfStatement(tokens, i, `N${String(networkId++).padStart(3, '0')}`);
      model.networks.push(network);
      i = endIndex;
    }
    // Skip other tokens
    else {
      i++;
    }
  }
}

// ─── Parse Expression ───

function parseExpression(tokens, start) {
  const conditions = [];
  const dependencies = [];
  let text = '';
  let i = start;
  
  while (i < tokens.length) {
    const token = tokens[i];
    
    // End of statement
    if (token.type === 'OP' && token.value === ';') {
      break;
    }
    
    // Identifier (input or state reference)
    if (token.type === 'IDENT') {
      const name = token.value;
      
      // Check if it's a timer/counter function
      if (i + 1 < tokens.length && tokens[i + 1].type === 'OP' && tokens[i + 1].value === '(') {
        // Function call
        const funcCall = parseFunctionCall(tokens, i);
        dependencies.push({
          type: funcCall.type,
          id: funcCall.name,
        });
        text += funcCall.text;
        i = funcCall.endIndex;
        continue;
      }
      
      // Check for NOT prefix
      if (i > start && tokens[i - 1]?.type === 'KEYWORD' && tokens[i - 1]?.value === 'NOT') {
        conditions.push({
          type: 'contact',
          input: name,
          state: 'NC', // Normally Closed
        });
        // 'NOT ' already added to text by NOT handler below
      } else {
        conditions.push({
          type: 'contact',
          input: name,
          state: 'NO', // Normally Open
        });
      }
      text += name;
    }
    
    // Boolean operators
    if (token.type === 'KEYWORD' && ['AND', 'OR', 'XOR'].includes(token.value)) {
      text += ` ${token.value} `;
    }
    
    // NOT
    if (token.type === 'KEYWORD' && token.value === 'NOT') {
      text += 'NOT ';
    }
    
    // Boolean literals
    if (token.type === 'BOOL') {
      text += token.value ? 'TRUE' : 'FALSE';
    }
    
    // Numbers
    if (token.type === 'INT' || token.type === 'REAL' || token.type === 'TIME') {
      text += token.value;
    }
    
    // Operators
    if (token.type === 'OP' && ['=', '<>', '<', '>', '<=', '>='].includes(token.value)) {
      text += ` ${token.value} `;
    }
    
    i++;
  }
  
  return {
    text: text.trim(),
    conditions,
    dependencies,
    endIndex: i,
  };
}

// ─── Parse Function Call ───

function parseFunctionCall(tokens, start) {
  const name = tokens[start].value;
  let i = start + 1;
  
  // Skip opening paren
  if (i < tokens.length && tokens[i].type === 'OP' && tokens[i].value === '(') {
    i++;
  }
  
  // Parse arguments until closing paren
  const args = [];
  let depth = 1;
  while (i < tokens.length && depth > 0) {
    if (tokens[i].type === 'OP' && tokens[i].value === '(') depth++;
    if (tokens[i].type === 'OP' && tokens[i].value === ')') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
    if (tokens[i].type === 'OP' && tokens[i].value === ';') {
      i++;
      continue;
    }
    args.push(tokens[i].value);
    i++;
  }
  
  // Determine function type
  let type = 'unknown';
  if (['TON', 'TOF', 'TP'].includes(name)) {
    type = 'timer';
  } else if (['CTU', 'CTD', 'CTUD'].includes(name)) {
    type = 'counter';
  }
  
  return {
    name,
    type,
    args,
    text: `${name}(${args.join('; ')})`,
    endIndex: i,
  };
}

// ─── Parse IF Statement ───

function parseIfStatement(tokens, start, networkId) {
  let i = start + 1; // skip IF
  
  // Parse condition
  const { expression, endIndex } = parseExpression(tokens, i);
  i = endIndex;
  
  // Skip THEN
  if (i < tokens.length && tokens[i].type === 'KEYWORD' && tokens[i].value === 'THEN') {
    i++;
  }
  
  // Parse body until END_IF
  const body = [];
  let depth = 1;
  while (i < tokens.length && depth > 0) {
    if (tokens[i].type === 'KEYWORD' && tokens[i].value === 'IF') depth++;
    if (tokens[i].type === 'KEYWORD' && tokens[i].value === 'END_IF') {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
    body.push(tokens[i]);
    i++;
  }
  
  return {
    network: {
      id: networkId,
      comment: `IF: ${expression.text}`,
      source_language: 'ST',
      source_code: `IF ${expression.text} THEN ... END_IF`,
      logic: {
        type: 'conditional',
        condition: expression.text,
        conditions: expression.conditions,
        dependencies: expression.dependencies,
        interlocks: [],
        body: body.map(t => t.value).join(' '),
      },
      safety_critical: false,
    },
    endIndex: i,
  };
}

// ─── Exports ───

module.exports = {
  tokenizeST,
  parseST,
};
