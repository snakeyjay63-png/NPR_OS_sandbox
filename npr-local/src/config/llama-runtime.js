// src/config/llama-runtime.js
// Canonical llama-server runtime config
// Single source of truth for supervisor + proxy

'use strict';

const path = require('path');

const DEFAULT_MODEL = process.env.LLAMA_MODEL ||
  path.join(__dirname, '..', '..', '..', '.openclaw', 'models', 'Qwen3.6-27B-Q4_K_M.gguf');

module.exports = {
  // Binary
  executable: process.env.LLAMA_BIN || 'llama-server',
  cwd: path.join(__dirname, '..', '..'),

  // Network
  host: '127.0.0.1',
  port: parseInt(process.env.LLAMA_PORT || '8765', 10),

  // Model
  model: DEFAULT_MODEL,
  contextSize: parseInt(process.env.LLAMA_CTX || '65536', 10),
  parallelSlots: parseInt(process.env.LLAMA_PARALLEL || '1', 10),

  // GPU — canonical single field
  // ngl_hex: "0x4F" → 79 layers (RTX 4090 ~max)
  nglHex: process.env.LLAMA_NGL_HEX || '0x4F',
  ngl: parseInt(process.env.LLAMA_NGL || '79', 10),

  // Start policy: "manual" | "auto" | "ensure"
  startPolicy: process.env.LLAMA_START_POLICY || 'manual',

  // Recovery backoff (exponential)
  recovery: {
    initialDelayMs: 2000,
    maximumDelayMs: 60000,
    maximumRestartsPerHour: 10,
  },

  // Extra CLI args (array)
  extraArgs: (process.env.LLAMA_EXTRA_ARGS || '').split(' ').filter(Boolean),

  // Process env overrides
  env: {
    ...(process.env.LLAMA_THREADS ? { LLAMA_THREADS: process.env.LLAMA_THREADS } : {}),
    ...(process.env.LLAMA_FLASH_ATTENTION ? { LLAMA_FLASH_ATTENTION: process.env.LLAMA_FLASH_ATTENTION } : {}),
  },
};
