#!/usr/bin/env node
// config/llama-runtime.js — Single source of truth for llama.cpp runtime
// Both terminal starter and gateway supervisor import this file.

const path = require('node:path');
const { env } = require('node:process');

const home = env.HOME || '/home/claw';

const llamaRuntime = Object.freeze({
  // Binary
  executable: env.LLAMA_SERVER_BIN || '/usr/local/bin/llama-server',

  // Model
  model: env.LLAMA_MODEL_PATH || path.join(home, 'models', 'npr-local.gguf'),

  // Network
  host: '127.0.0.1',
  port: parseInt(env.LLAMA_PORT, 10) || 8765,

  // Context — matches 64K hypervisor (64 blocks × 1024 tokens)
  contextSize: parseInt(env.LLAMA_CTX_SIZE, 10) || 65536,

  // Parallel inference slots
  parallelSlots: parseInt(env.LLAMA_PARALLEL, 10) || 4,

  // Working directory for process spawn
  cwd: path.join(__dirname, '..'),

  // Extra arguments (merged at spawn time)
  // Default: --slots (slot monitoring) --metrics (Prometheus runtime) --jinja (chat templates)
  //           --no-ui-mcp-proxy (no CORS proxy unless MCP needed)
  // NO --tools: capabilities remain under npr-local / Tool-00
  extraArgs: [
    '--slots',
    '--metrics',
    '--jinja',
    '--no-ui-mcp-proxy',
    ...(env.LLAMA_EXTRA_ARGS || '').split(' ').filter(Boolean),
  ],

  // Environment overrides for child process
  env: Object.fromEntries(
    Object.entries(env).filter(([k]) =>
      k.startsWith('LLAMA_') || k.startsWith('GPT_') || k.startsWith('HSA_') || k.startsWith('ROCR_')
    ),
  ),

  // Recovery policy
  recovery: Object.freeze({
    enabled: env.LLAMA_RECOVERY !== 'false',
    initialDelayMs: 2000,
    maximumDelayMs: 60000,
    maximumRestartsPerHour: 10,
  }),

  // Start policy: manual | on-gateway-start | on-first-request | always-recover
  startPolicy: env.LLAMA_START_POLICY || 'on-first-request',
});

module.exports = llamaRuntime;
