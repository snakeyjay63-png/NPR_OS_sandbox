#!/usr/bin/env node
// npr-hex-vm.cjs — NPR Hex Assembly Virtual Machine
//
// Vaste 8-byte instructieset, 64-slot registermodel, sandboxed executor.
// Geen eval, geen native code. Volledig inspecteerbaar.
//
// Instructie-formaat (8 bytes):
//   [opcode] [flags] [src-cell] [tgt-cell] [val-A] [val-B] [state] [checksum]
//
// Opcodes: NPR declaratieve cyclus (SOURCE → FLOW → RESONATE → PRESERVE → RETURN)

'use strict';

const { createHash } = require('crypto');

// ─── Opcodes ────────────────────────────────────────────────────────────────

const NPR_OPCODE = Object.freeze({
  NOP:       0x00,
  SOURCE:    0x01,
  FLOW:      0x02,
  RESONATE:  0x03,
  PRESERVE:  0x04,
  RETURN:    0x05,
  TRANSFORM: 0x06,
  RELEASE:   0x07,
  LOAD:      0x08,
  STORE:     0x09,
  ADD:       0x0a,
  SUB:       0x0b,
  MUL:       0x0c,
  DIV:       0x0d,
  AND:       0x0e,
  OR:        0x0f,
  XOR:       0x10,
  CMP:       0x11,
  JUMP:      0x12,
  JZ:        0x13,
  JNZ:       0x14,
  CALL:      0x15,
  RET:       0x16,
  HALT:      0x17,
  TRACE:     0x18,
});

const OPCODE_NAMES = {};
for (const [name, code] of Object.entries(NPR_OPCODE)) {
  OPCODE_NAMES[code] = name;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const INSTR_SIZE = 8;
const SLOT_COUNT = 64;
const REGS_PER_SLOT = 16;
const MAX_INSTRUCTIONS = 0x1000;
const MAX_TRACE_ENTRIES = 0x1000;
const MAX_MEM_PAGES = 4;
const MEM_PAGE_SIZE = 0x1000;

// ─── Instruction Builder ────────────────────────────────────────────────────

function createInstruction({
  opcode,
  flags = 0x00,
  src = 0x00,
  tgt = 0x00,
  valA = 0x00,
  valB = 0x00,
  state = 0x00,
  checksum = null,
}) {
  const cs = checksum !== null ? checksum : computeChecksum(opcode, flags, src, tgt, valA, valB, state);
  return new Uint8Array([opcode, flags, src, tgt, valA, valB, state, cs]);
}

function computeChecksum(opcode, flags, src, tgt, valA, valB, state) {
  return (opcode + flags + src + tgt + valA + valB + state) & 0xff;
}

function parseInstruction(bytes, offset = 0) {
  if (bytes.length < offset + INSTR_SIZE) {
    throw new RangeError(`Incomplete instruction at offset ${offset}`);
  }
  const opcode = bytes[offset];
  const flags = bytes[offset + 1];
  const src = bytes[offset + 2];
  const tgt = bytes[offset + 3];
  const valA = bytes[offset + 4];
  const valB = bytes[offset + 5];
  const state = bytes[offset + 6];
  const checksum = bytes[offset + 7];

  if (computeChecksum(opcode, flags, src, tgt, valA, valB, state) !== checksum) {
    throw new Error(`Checksum mismatch at PC=${offset / INSTR_SIZE}: expected ${computeChecksum(opcode, flags, src, tgt, valA, valB, state)}, got ${checksum}`);
  }

  return { opcode, flags, src, tgt, valA, valB, state, pc: offset / INSTR_SIZE };
}

function instructionToHex(instr) {
  return Array.from(instr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function instructionToAssembly(instr) {
  const { opcode, flags, src, tgt, valA, valB, state, pc } = parseInstruction(instr);
  const name = OPCODE_NAMES[opcode] ?? `UNK_0x${opcode.toString(16)}`;
  const operands = [];
  if (src) operands.push(`[0x${src.toString(16)}]`);
  if (tgt) operands.push(`[0x${tgt.toString(16)}]`);
  if (valA) operands.push(`0x${valA.toString(16)}`);
  if (valB) operands.push(`0x${valB.toString(16)}`);
  return `0x${pc.toString(16).padStart(4, '0')}: ${name.padEnd(10)} ${operands.join(', ') || '—'}`;
}

// ─── VM State ───────────────────────────────────────────────────────────────

function createVMState() {
  // 64 slots × 16 registers each
  const registers = new Uint8Array(SLOT_COUNT * REGS_PER_SLOT);

  // Data memory: 4 pages of 0x1000 bytes
  const memory = new Uint8Array(MAX_MEM_PAGES * MEM_PAGE_SIZE);

  // Program counter
  let pc = 0;

  // Flags register (Z, N, C, V)
  const flagsReg = { z: 0, n: 0, c: 0, v: 0 };

  // Call stack (return addresses)
  const callStack = [];

  // Execution trace
  const trace = [];

  // Halt flag
  let halted = false;

  // Instruction count
  let cycles = 0;

  return { registers, memory, pc, flagsReg, callStack, trace, halted, cycles };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getReg(state, slot, reg) {
  return state.registers[slot * REGS_PER_SLOT + reg];
}

function setReg(state, slot, reg, value) {
  state.registers[slot * REGS_PER_SLOT + reg] = value & 0xff;
}

function reg0(state, slot) { return getReg(state, slot, 0); }
function setReg0(state, slot, v) { setReg(state, slot, 0, v); }

// ─── Executor ───────────────────────────────────────────────────────────────

function executeInstruction(state, bytecode, logTrace = true) {
  const { pc, halted } = state;
  if (halted) return { halted: true, pc, cycles: state.cycles };

  const offset = pc * INSTR_SIZE;
  const instrBytes = bytecode.slice(offset, offset + INSTR_SIZE);

  if (instrBytes.length < INSTR_SIZE) {
    state.halted = true;
    if (logTrace) logEntry(state, 'HALT', { reason: 'end-of-code' });
    return { halted: true, pc, cycles: state.cycles };
  }

  const instr = parseInstruction(instrBytes, 0);
  state.pc++;
  state.cycles++;

  const { opcode, flags, src, tgt, valA, valB, state: instrState } = instr;

  switch (opcode) {
    case NPR_OPCODE.NOP:
      break;

    // ── NPR Core Opcodes ──

    case NPR_OPCODE.SOURCE:
      // Load source value into target cell R0
      setReg0(state, tgt, valA);
      if (logTrace) logEntry(state, 'SOURCE', { cell: tgt, value: valA });
      break;

    case NPR_OPCODE.FLOW:
      // Transfer: tgt R0 = src R0, optionally add valA
      {
        const val = getReg(state, src, 0);
        setReg0(state, tgt, val + (flags & 0x01 ? valA : 0));
        if (logTrace) logEntry(state, 'FLOW', { from: src, to: tgt, value: getReg(state, tgt, 0) });
      }
      break;

    case NPR_OPCODE.RESONATE:
      // tgt R0 = (src R0 + tgt R0) / 2, threshold valA
      {
        const s = getReg(state, src, 0);
        const t = getReg(state, tgt, 0);
        const avg = Math.floor((s + t) / 2);
        setReg0(state, tgt, avg >= valA ? avg : valA);
        if (logTrace) logEntry(state, 'RESONATE', { src, tgt, result: getReg(state, tgt, 0) });
      }
      break;

    case NPR_OPCODE.PRESERVE:
      // Copy src R0 to src R[valA] (preserve in higher register)
      {
        const val = getReg(state, src, 0);
        setReg(state, src, valA & 0xf, val);
        if (logTrace) logEntry(state, 'PRESERVE', { cell: src, reg: valA & 0xf, value: val });
      }
      break;

    case NPR_OPCODE.RETURN:
      // Output: copy cell R0 to trace
      {
        const val = getReg(state, tgt, 0);
        if (logTrace) logEntry(state, 'RETURN', { cell: tgt, value: val });
      }
      break;

    case NPR_OPCODE.TRANSFORM:
      // tgt R0 = transform(src R0, valA, op)
      {
        const val = getReg(state, src, 0);
        let result;
        switch (flags & 0x0f) {
          case 0x01: result = (val * valA) & 0xff; break; // scale
          case 0x02: result = (val + valA) & 0xff; break; // offset
          case 0x03: result = ((val >> valA) & 0xff); break; // shift
          case 0x04: result = (~val) & 0xff; break; // invert
          default: result = val;
        }
        setReg0(state, tgt, result);
        if (logTrace) logEntry(state, 'TRANSFORM', { from: src, to: tgt, op: flags & 0x0f, result });
      }
      break;

    case NPR_OPCODE.RELEASE:
      // Clear cell R0
      setReg0(state, tgt, 0x00);
      if (logTrace) logEntry(state, 'RELEASE', { cell: tgt });
      break;

    // ── Arithmetic ──

    case NPR_OPCODE.LOAD:
      setReg0(state, tgt, valA);
      if (logTrace) logEntry(state, 'LOAD', { cell: tgt, value: valA });
      break;

    case NPR_OPCODE.STORE:
      // Store src R0 to memory at addr (valA << 8) | valB
      {
        const addr = (valA << 8) | valB;
        const val = getReg(state, src, 0);
        if (addr < memory.length) {
          state.memory[addr] = val;
          if (logTrace) logEntry(state, 'STORE', { cell: src, addr: `0x${addr.toString(16)}`, value: val });
        }
      }
      break;

    case NPR_OPCODE.ADD: {
      const a = getReg(state, src, 0);
      const b = getReg(state, tgt, 0);
      const sum = a + b;
      state.flagsReg.c = sum > 0xff ? 1 : 0;
      state.flagsReg.z = (sum & 0xff) === 0 ? 1 : 0;
      state.flagsReg.n = (sum & 0x80) ? 1 : 0;
      setReg0(state, tgt, sum & 0xff);
      if (logTrace) logEntry(state, 'ADD', { a, b, result: sum & 0xff, carry: state.flagsReg.c });
      break;
    }

    case NPR_OPCODE.SUB: {
      const a = getReg(state, tgt, 0);
      const b = getReg(state, src, 0);
      const diff = a - b;
      state.flagsReg.c = diff < 0 ? 1 : 0;
      state.flagsReg.z = (diff & 0xff) === 0 ? 1 : 0;
      state.flagsReg.n = (diff & 0x80) ? 1 : 0;
      setReg0(state, tgt, diff & 0xff);
      if (logTrace) logEntry(state, 'SUB', { a, b, result: diff & 0xff, borrow: state.flagsReg.c });
      break;
    }

    case NPR_OPCODE.MUL: {
      const a = getReg(state, src, 0);
      const b = getReg(state, tgt, 0);
      const product = (a * b) & 0xff;
      state.flagsReg.c = (a * b) > 0xff ? 1 : 0;
      state.flagsReg.z = product === 0 ? 1 : 0;
      setReg0(state, tgt, product);
      if (logTrace) logEntry(state, 'MUL', { a, b, result: product });
      break;
    }

    case NPR_OPCODE.DIV: {
      const a = getReg(state, tgt, 0);
      const b = getReg(state, src, 0);
      if (b === 0) {
        state.flagsReg.z = 1;
        if (logTrace) logEntry(state, 'DIV', { error: 'division-by-zero' });
      } else {
        const quotient = Math.floor(a / b);
        state.flagsReg.z = quotient === 0 ? 1 : 0;
        setReg0(state, tgt, quotient);
        if (logTrace) logEntry(state, 'DIV', { dividend: a, divisor: b, result: quotient });
      }
      break;
    }

    case NPR_OPCODE.AND:
      setReg0(state, tgt, getReg(state, src, 0) & getReg(state, tgt, 0));
      state.flagsReg.z = getReg(state, tgt, 0) === 0 ? 1 : 0;
      if (logTrace) logEntry(state, 'AND', { result: getReg(state, tgt, 0) });
      break;

    case NPR_OPCODE.OR:
      setReg0(state, tgt, getReg(state, src, 0) | getReg(state, tgt, 0));
      state.flagsReg.z = getReg(state, tgt, 0) === 0 ? 1 : 0;
      if (logTrace) logEntry(state, 'OR', { result: getReg(state, tgt, 0) });
      break;

    case NPR_OPCODE.XOR:
      setReg0(state, tgt, getReg(state, src, 0) ^ getReg(state, tgt, 0));
      state.flagsReg.z = getReg(state, tgt, 0) === 0 ? 1 : 0;
      if (logTrace) logEntry(state, 'XOR', { result: getReg(state, tgt, 0) });
      break;

    case NPR_OPCODE.CMP: {
      const a = getReg(state, tgt, 0);
      const b = getReg(state, src, 0);
      state.flagsReg.z = a === b ? 1 : 0;
      state.flagsReg.n = a < b ? 1 : 0;
      state.flagsReg.c = a < b ? 1 : 0;
      if (logTrace) logEntry(state, 'CMP', { a, b, z: state.flagsReg.z, n: state.flagsReg.n });
      break;
    }

    // ── Control Flow ──

    case NPR_OPCODE.JUMP:
      state.pc = valA * 256 + valB;
      if (logTrace) logEntry(state, 'JUMP', { to: state.pc });
      break;

    case NPR_OPCODE.JZ:
      if (state.flagsReg.z) {
        state.pc = valA * 256 + valB;
        if (logTrace) logEntry(state, 'JZ', { taken: true, to: state.pc });
      } else {
        if (logTrace) logEntry(state, 'JZ', { taken: false });
      }
      break;

    case NPR_OPCODE.JNZ:
      if (!state.flagsReg.z) {
        state.pc = valA * 256 + valB;
        if (logTrace) logEntry(state, 'JNZ', { taken: true, to: state.pc });
      } else {
        if (logTrace) logEntry(state, 'JNZ', { taken: false });
      }
      break;

    case NPR_OPCODE.CALL:
      state.callStack.push(state.pc);
      state.pc = valA * 256 + valB;
      if (logTrace) logEntry(state, 'CALL', { returnAddr: state.callStack.length - 1, to: state.pc });
      break;

    case NPR_OPCODE.RET:
      if (state.callStack.length > 0) {
        state.pc = state.callStack.pop();
        if (logTrace) logEntry(state, 'RET', { to: state.pc });
      } else {
        state.halted = true;
        if (logTrace) logEntry(state, 'RET', { error: 'empty-call-stack' });
      }
      break;

    case NPR_OPCODE.HALT:
      state.halted = true;
      if (logTrace) logEntry(state, 'HALT', {});
      break;

    case NPR_OPCODE.TRACE:
      if (logTrace) logEntry(state, 'TRACE', { cell: src, reg: valA & 0xf, value: getReg(state, src, valA & 0xf) });
      break;

    default:
      if (logTrace) logEntry(state, 'UNKNOWN', { opcode: `0x${opcode.toString(16)}` });
      break;
  }

  // Trace limit
  if (state.trace.length > MAX_TRACE_ENTRIES) {
    state.trace.shift();
  }

  return { halted: state.halted, pc: state.pc, cycles: state.cycles };
}

function logEntry(state, op, data) {
  state.trace.push({ pc: state.pc, op, cycle: state.cycles, ...data });
}

// ─── Runner ─────────────────────────────────────────────────────────────────

function run(bytecode, options = {}) {
  const {
    maxCycles = 0x10000,
    logTrace = true,
    initialPC = 0,
  } = options;

  const state = createVMState();
  state.pc = initialPC;

  // Validate bytecode length
  if (bytecode.length % INSTR_SIZE !== 0) {
    throw new Error(`Bytecode length ${bytecode.length} is not a multiple of ${INSTR_SIZE}`);
  }

  if (bytecode.length > MAX_INSTRUCTIONS * INSTR_SIZE) {
    throw new Error(`Bytecode exceeds maximum: ${bytecode.length} > ${MAX_INSTRUCTIONS * INSTR_SIZE}`);
  }

  const results = [];
  while (!state.halted && state.cycles < maxCycles) {
    const result = executeInstruction(state, bytecode, logTrace);
    results.push(result);
    if (result.halted || result.cycles >= maxCycles) break;
  }

  return {
    state,
    finalPC: state.pc,
    cycles: state.cycles,
    halted: state.halted,
    trace: state.trace,
    summary: {
      instructions: bytecode.length / INSTR_SIZE,
      cycles: state.cycles,
      traceEntries: state.trace.length,
      halted: state.halted,
      reason: state.halted ? 'normal' : `max-cycles (${maxCycles})`,
    },
  };
}

// ─── Assembly Parser (text → bytecode) ──────────────────────────────────────

function assemble(source) {
  const lines = source.split('\n');
  const instructions = [];
  const labels = {};
  let pc = 0;

  // First pass: collect labels
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;

    // Label
    const labelMatch = line.match(/^(\w+):\s*$/);
    if (labelMatch) {
      labels[labelMatch[1]] = pc;
      continue;
    }

    pc++;
  }

  // Second pass: parse instructions
  pc = 0;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;

    if (line.match(/^\w+:\s*$/)) { pc++; continue; }

    const parts = line.split(/\s+/);
    const mnemonic = parts[0].toUpperCase();
    const operands = parts.slice(1).filter(Boolean);

    const instr = parseAssemblyLine(mnemonic, operands, labels, pc);
    if (instr) instructions.push(instr);
    pc++;
  }

  // Pack into bytecode
  const bytecode = new Uint8Array(instructions.length * INSTR_SIZE);
  for (let i = 0; i < instructions.length; i++) {
    const instr = instructions[i];
    for (let b = 0; b < INSTR_SIZE; b++) {
      bytecode[i * INSTR_SIZE + b] = instr[b];
    }
  }

  return { bytecode, instructionCount: instructions.length, labels };
}

function parseHex(val) {
  if (typeof val === 'string') {
    // Register shorthand: r0-r15 → 0-15
    const regMatch = val.match(/^r(\d+)$/i);
    if (regMatch) return parseInt(regMatch[1], 10);
    if (val.startsWith('0x') || val.startsWith('0X')) return parseInt(val, 16);
    if (val.startsWith('0b') || val.startsWith('0B')) return parseInt(val.slice(2), 2);
  }
  return parseInt(String(val), 10);
}

function resolveLabel(name, labels, defaultVal) {
  if (labels[name] !== undefined) return labels[name];
  return defaultVal ?? 0;
}

function parseAssemblyLine(mnemonic, operands, labels, pc) {
  const opcode = NPR_OPCODE[mnemonic];
  if (opcode === undefined) return null;

  const instr = [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  instr[0] = opcode;

  // Operand parsing per opcode
  switch (mnemonic) {
    case 'NOP':
    case 'HALT':
      break;

    case 'SOURCE':
      instr[3] = parseHex(operands[0] ?? 0);  // tgt
      instr[4] = parseHex(operands[1] ?? 0);  // valA
      break;

    case 'FLOW':
      instr[2] = parseHex(operands[0] ?? 0);  // src
      instr[3] = parseHex(operands[1] ?? 0);  // tgt
      if (operands[2]) instr[1] = 0x01;       // flags: add mode
      if (operands[3]) instr[4] = parseHex(operands[2]); // valA for add
      break;

    case 'RESONATE':
      instr[2] = parseHex(operands[0] ?? 0);  // src
      instr[3] = parseHex(operands[1] ?? 0);  // tgt
      instr[4] = parseHex(operands[2] ?? 0);  // threshold
      break;

    case 'PRESERVE':
      instr[2] = parseHex(operands[0] ?? 0);  // src
      instr[4] = parseHex(operands[1] ?? 0);  // reg
      break;

    case 'RETURN':
      instr[3] = parseHex(operands[0] ?? 0);  // tgt
      break;

    case 'TRANSFORM':
      instr[2] = parseHex(operands[0] ?? 0);  // src
      instr[3] = parseHex(operands[1] ?? 0);  // tgt
      instr[1] = parseHex(operands[2] ?? 0);  // op
      instr[4] = parseHex(operands[3] ?? 0);  // valA
      break;

    case 'RELEASE':
      instr[3] = parseHex(operands[0] ?? 0);  // tgt
      break;

    case 'LOAD':
      instr[3] = parseHex(operands[0] ?? 0);  // tgt
      instr[4] = parseHex(operands[1] ?? 0);  // valA
      break;

    case 'STORE':
      instr[2] = parseHex(operands[0] ?? 0);  // src
      instr[4] = parseHex(operands[1] ?? 0);  // addr high
      instr[5] = parseHex(operands[2] ?? 0);  // addr low
      break;

    case 'ADD':
    case 'SUB':
    case 'MUL':
    case 'DIV':
    case 'AND':
    case 'OR':
    case 'XOR':
      instr[2] = parseHex(operands[0] ?? 0);  // src
      instr[3] = parseHex(operands[1] ?? 0);  // tgt
      break;

    case 'CMP':
      instr[2] = parseHex(operands[0] ?? 0);  // src
      instr[3] = parseHex(operands[1] ?? 0);  // tgt
      break;

    case 'JUMP': {
      const target = operands[0]?.startsWith('LABEL_') || isNaN(parseInt(operands[0] ?? ''))
        ? resolveLabel(operands[0], labels, 0)
        : parseHex(operands[0] ?? 0);
      instr[4] = (target >> 8) & 0xff;
      instr[5] = target & 0xff;
      break;
    }

    case 'JZ':
    case 'JNZ': {
      const target = operands[0]?.startsWith('LABEL_') || isNaN(parseInt(operands[0] ?? ''))
        ? resolveLabel(operands[0], labels, 0)
        : parseHex(operands[0] ?? 0);
      instr[4] = (target >> 8) & 0xff;
      instr[5] = target & 0xff;
      break;
    }

    case 'CALL': {
      const target = operands[0]?.startsWith('LABEL_') || isNaN(parseInt(operands[0] ?? ''))
        ? resolveLabel(operands[0], labels, 0)
        : parseHex(operands[0] ?? 0);
      instr[4] = (target >> 8) & 0xff;
      instr[5] = target & 0xff;
      break;
    }

    case 'RET':
      break;

    case 'TRACE':
      instr[2] = parseHex(operands[0] ?? 0);  // cell
      instr[4] = parseHex(operands[1] ?? 0);  // reg
      break;

    default:
      break;
  }

  // Compute checksum after all operands are set
  instr[7] = computeChecksum(instr[0], instr[1], instr[2], instr[3], instr[4], instr[5], instr[6]);
  return instr;
}

// ─── Disassembler ───────────────────────────────────────────────────────────

function disassemble(bytecode) {
  const lines = [];
  const count = bytecode.length / INSTR_SIZE;
  for (let i = 0; i < count; i++) {
    const instr = bytecode.slice(i * INSTR_SIZE, (i + 1) * INSTR_SIZE);
    lines.push(instructionToAssembly(instr));
  }
  return lines.join('\n');
}

// ─── Snapshot / Serialization ───────────────────────────────────────────────

function snapshot(state) {
  return {
    pc: state.pc,
    cycles: state.cycles,
    halted: state.halted,
    flags: { ...state.flagsReg },
    callStackDepth: state.callStack.length,
    registers: Array.from(state.registers.slice(0, SLOT_COUNT * REGS_PER_SLOT)),
    memoryDirty: getMemoryRegions(state.memory),
    traceLength: state.trace.length,
  };
}

function getMemoryRegions(memory) {
  const regions = [];
  let start = null;
  for (let i = 0; i < memory.length; i++) {
    if (memory[i] !== 0) {
      if (start === null) start = i;
    } else if (start !== null) {
      regions.push({ start, end: i, size: i - start });
      start = null;
    }
  }
  if (start !== null) {
    regions.push({ start, end: memory.length, size: memory.length - start });
  }
  return regions;
}

function stateHash(state) {
  const hasher = createHash('sha256');
  hasher.update(state.registers);
  hasher.update(state.memory);
  hasher.update(Buffer.from([state.pc, state.pc >> 8]));
  return hasher.digest('hex');
}

// ─── Module Exports ─────────────────────────────────────────────────────────

module.exports = {
  // Constants
  NPR_OPCODE,
  OPCODE_NAMES,
  INSTR_SIZE,
  SLOT_COUNT,
  REGS_PER_SLOT,
  MAX_INSTRUCTIONS,
  MAX_TRACE_ENTRIES,

  // Instruction
  createInstruction,
  parseInstruction,
  instructionToHex,
  instructionToAssembly,

  // VM
  createVMState,
  executeInstruction,
  run,

  // Assembly
  assemble,
  disassemble,

  // Snapshot
  snapshot,
  stateHash,
};
