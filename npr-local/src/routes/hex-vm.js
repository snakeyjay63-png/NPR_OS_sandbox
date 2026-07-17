#!/usr/bin/env node
// routes/hex-vm.js — NPR Hex VM HTTP endpoints
//
// GET  /hex-vm/status        — VM info + opcode table
// GET  /hex-vm/opcode        — Full opcode reference
// POST /hex-vm/assemble      — Source text → bytecode
// POST /hex-vm/run           — Execute bytecode
// POST /hex-vm/execute       — Assemble + run in one step
// GET  /hex-vm/disassemble   — Bytecode hex → assembly listing

'use strict';

const {
  NPR_OPCODE,
  OPCODE_NAMES,
  INSTR_SIZE,
  SLOT_COUNT,
  REGS_PER_SLOT,
  MAX_INSTRUCTIONS,
  MAX_TRACE_ENTRIES,
  createInstruction,
  assemble,
  disassemble,
  run,
  snapshot,
  stateHash,
  instructionToHex,
  instructionToAssembly,
} = require('../field/npr-hex-vm.cjs');

// ─── Status ─────────────────────────────────────────────────────────────────

function handlerStatus(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    vm: 'npr-hex-vm',
    version: '0.1.0',
    instructionSize: `${INSTR_SIZE} bytes`,
    slots: SLOT_COUNT,
    regsPerSlot: REGS_PER_SLOT,
    maxInstructions: MAX_INSTRUCTIONS,
    maxTrace: MAX_TRACE_ENTRIES,
    opcodeCount: Object.keys(NPR_OPCODE).length,
    addressSpace: {
      registers: `${SLOT_COUNT}×${REGS_PER_SLOT} = ${SLOT_COUNT * REGS_PER_SLOT} bytes`,
      memory: `${(MAX_INSTRUCTIONS * INSTR_SIZE / 1024).toFixed(0)} KB pages`,
    },
  }));
}

// ─── Opcode Reference ───────────────────────────────────────────────────────

function handlerOpcode(req, res) {
  const opcodes = Object.entries(NPR_OPCODE).map(([name, code]) => ({
    name,
    code: `0x${code.toString(16).padStart(2, '0')}`,
    decimal: code,
    category: getOpcodeCategory(code),
    description: getOpcodeDescription(code),
  }));

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ opcodes, count: opcodes.length }));
}

function getOpcodeCategory(code) {
  if (code <= 0x07) return 'npr-core';
  if (code <= 0x11) return 'arithmetic';
  if (code <= 0x16) return 'control-flow';
  return 'meta';
}

function getOpcodeDescription(code) {
  const descs = {
    0x00: 'No operation',
    0x01: 'Load source value into target cell',
    0x02: 'Transfer value between cells',
    0x03: 'Resonate two cells (averaged with threshold)',
    0x04: 'Preserve R0 to higher register',
    0x05: 'Return cell value to trace',
    0x06: 'Transform cell value (scale/offset/shift/invert)',
    0x07: 'Release (clear) cell',
    0x08: 'Load immediate value into cell',
    0x09: 'Store cell to memory address',
    0x0a: 'Add src to tgt',
    0x0b: 'Subtract src from tgt',
    0x0c: 'Multiply src × tgt',
    0x0d: 'Divide tgt by src',
    0x0e: 'Bitwise AND',
    0x0f: 'Bitwise OR',
    0x10: 'Bitwise XOR',
    0x11: 'Compare (set flags)',
    0x12: 'Unconditional jump',
    0x13: 'Jump if zero',
    0x14: 'Jump if not zero',
    0x15: 'Call subroutine',
    0x16: 'Return from subroutine',
    0x17: 'Halt execution',
    0x18: 'Emit trace entry',
  };
  return descs[code] ?? 'Unknown';
}

// ─── Assemble ───────────────────────────────────────────────────────────────

function handlerAssemble(req, res) {
  try {
    const { source } = req.body || {};
    if (!source || typeof source !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing "source" (assembly text)' }));
    }

    const result = assemble(source);
    const disasm = disassemble(result.bytecode);
    const hexDump = Array.from(result.bytecode)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      instructionCount: result.instructionCount,
      bytecodeSize: result.bytecode.length,
      bytecodeHex: hexDump,
      labels: result.labels,
      disassembly: disasm,
    }));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ─── Run ────────────────────────────────────────────────────────────────────

function handlerRun(req, res) {
  try {
    const { bytecodeHex, maxCycles = 0x10000, initialPC = 0 } = req.body || {};

    if (!bytecodeHex || typeof bytecodeHex !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing "bytecodeHex" (hex string)' }));
    }

    const cleanHex = bytecodeHex.replace(/[^0-9a-fA-F]/g, '');
    if (cleanHex.length % 2 !== 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Bytecode hex length must be even' }));
    }

    const bytecode = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytecode[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
    }

    const result = run(bytecode, { maxCycles, initialPC });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      summary: result.summary,
      snapshot: snapshot(result.state),
      trace: result.trace,
      stateHash: stateHash(result.state),
    }));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ─── Execute (assemble + run) ───────────────────────────────────────────────

function handlerExecute(req, res) {
  try {
    const { source, maxCycles = 0x10000 } = req.body || {};
    if (!source || typeof source !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing "source" (assembly text)' }));
    }

    const asmResult = assemble(source);
    const runResult = run(asmResult.bytecode, { maxCycles });
    const disasm = disassemble(asmResult.bytecode);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      assembly: {
        instructionCount: asmResult.instructionCount,
        bytecodeSize: asmResult.bytecode.length,
        disassembly: disasm,
      },
      execution: {
        summary: runResult.summary,
        snapshot: snapshot(runResult.state),
        trace: runResult.trace,
        stateHash: stateHash(runResult.state),
      },
    }));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ─── Disassemble ────────────────────────────────────────────────────────────

function handlerDisassemble(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const hex = url.searchParams.get('hex');

  if (!hex || typeof hex !== 'string') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Missing "hex" query parameter' }));
  }

  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  if (cleanHex.length % (INSTR_SIZE * 2) !== 0) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      error: `Hex length must be multiple of ${INSTR_SIZE * 2} (${INSTR_SIZE} bytes × 2 hex chars)`,
    }));
  }

  const bytecode = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytecode[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
  }

  try {
    const listing = disassemble(bytecode);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      instructionCount: bytecode.length / INSTR_SIZE,
      listing,
    }));
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ─── Router (NPR-style) ────────────────────────────────────────────────────

const ROUTES = {
  '/hex-vm/status': handlerStatus,
  '/hex-vm/opcode': handlerOpcode,
  '/hex-vm/assemble': handlerAssemble,
  '/hex-vm/run': handlerRun,
  '/hex-vm/execute': handlerExecute,
  '/hex-vm/disassemble': handlerDisassemble,
};

function handler(req, res, ctx) {
  const { pathname } = ctx;
  const routeHandler = ROUTES[pathname];
  if (routeHandler) {
    return routeHandler(req, res);
  }

  // Fallback: disassemble on query param
  if (pathname === '/hex-vm' && new URL(req.url, `http://${req.headers.host}`).searchParams.has('hex')) {
    return handlerDisassemble(req, res);
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'not found',
    path: pathname,
    available: Object.keys(ROUTES),
  }));
}

module.exports = {
  handler,
  handlerStatus,
  handlerOpcode,
  handlerAssemble,
  handlerRun,
  handlerExecute,
  handlerDisassemble,
};
