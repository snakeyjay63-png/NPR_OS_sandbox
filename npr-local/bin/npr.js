#!/usr/bin/env node
// ═══════════════════════════════════════════════════
// bin/npr.js — NPR-Local CLI
// ═══════════════════════════════════════════════════
// HTTP-gateway first: CLI wrappt de HTTP endpoints
// Gebruik: npr <command> [options]
// ═══════════════════════════════════════════════════

const http = require('http');
const https = require('https');
const path = require('path');

const HOST = process.env.NPR_HOST || '::1';
const PORT = process.env.NPR_PORT || 5000;
const BASE = `http://[${HOST}]:${PORT}`;

// ─── HTTP Helper ─────────────────────────────────────────────────────

function req(method, pathStr, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathStr, BASE);
    // Strip brackets from IPv6 hostname for http.request
    const hostname = url.hostname.replace(/[\[\]]/g, '');
    const options = {
      hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };

    const r = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

// ─── Commands ────────────────────────────────────────────────────────

async function cmdChat(msg) {
  const res = await req('POST', '/agent/chat', { message: msg });
  console.log(JSON.stringify(res.data, null, 2));
}

async function cmdChatStream(msg) {
  // SSE streaming — raw output
  const url = new URL('/agent/chat-stream', BASE);
  const hostname = url.hostname.replace(/[\[\]]/g, '');
  const r = http.request({
    hostname,
    port: url.port,
    path: url.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, (res) => {
    res.setEncoding('utf8');
    res.on('data', (chunk) => process.stdout.write(chunk));
  });
  r.write(JSON.stringify({ message: msg }));
  r.end();
}

async function cmdStatus() {
  const res = await req('GET', '/status');
  console.log(JSON.stringify(res.data, null, 2));
}

async function cmdContext(phase) {
  const q = phase ? `?phase=${phase}` : '';
  const res = await req('GET', `/memory/context${q}`);
  console.log(JSON.stringify(res.data, null, 2));
}

async function cmdLogs(count = 50) {
  const res = await req('GET', `/agent/logs?limit=${count}`);
  console.log(JSON.stringify(res.data, null, 2));
}

async function cmdConfig(key, value) {
  if (value !== undefined) {
    const res = await req('POST', '/config', { [key]: value });
    console.log(JSON.stringify(res.data, null, 2));
  } else if (key) {
    const res = await req('GET', `/config?key=${key}`);
    console.log(JSON.stringify(res.data, null, 2));
  } else {
    const res = await req('GET', '/config');
    console.log(JSON.stringify(res.data, null, 2));
  }
}

async function cmdSearch(q) {
  const res = await req('GET', `/memory/search?q=${encodeURIComponent(q)}`);
  console.log(JSON.stringify(res.data, null, 2));
}

async function cmdDoctor() {
  const res = await req('GET', '/doctor');
  const d = res.data;
  const ok = d.checks?.filter(c => c.ok).length || 0;
  const total = d.checks?.length || 0;
  console.log(`Doctor: ${ok}/${total} OK`);
  if (d.checks) {
    for (const c of d.checks) {
      console.log(`  ${c.ok ? '✅' : '❌'} ${c.name}: ${c.message}`);
    }
  }
}

async function cmdTool(tool, args) {
  const res = await req('POST', '/tool/exec', { tool, args: args || [] });
  console.log(JSON.stringify(res.data, null, 2));
}

async function cmdIntrospect(q) {
  const res = await req('GET', `/introspect?q=${encodeURIComponent(q)}`);
  console.log(JSON.stringify(res.data, null, 2));
}

async function cmdMemory() {
  const res = await req('GET', '/warehouse');
  console.log(JSON.stringify(res.data, null, 2));
}

async function cmdWorkspace() {
  const res = await req('GET', '/agent/workspace');
  console.log(JSON.stringify(res.data, null, 2));
}

async function cmdScan() {
  const res = await req('GET', '/tool/system-scan');
  console.log(JSON.stringify(res.data, null, 2));
}

async function cmdBridge() {
  // Browser bridge info
  const res = await req('GET', '/bridge/api');
  console.log(JSON.stringify(res.data, null, 2));
}

async function cmdMaps() {
  const res = await req('GET', '/maps');
  console.log(JSON.stringify(res.data, null, 2));
}

// ─── CLI Parser ──────────────────────────────────────────────────────

const cmd = process.argv[2] || 'help';
const args = process.argv.slice(3);

(async () => {
  switch (cmd) {
    case 'chat':
      await cmdChat(args.join(' '));
      break;
    case 'stream':
    case 's':
      await cmdChatStream(args.join(' '));
      break;
    case 'status':
    case 'info':
      await cmdStatus();
      break;
    case 'context':
      await cmdContext(args[0]);
      break;
    case 'logs':
      await cmdLogs(args[0]);
      break;
    case 'config':
      await cmdConfig(args[0], args[1]);
      break;
    case 'search':
    case 'find':
      await cmdSearch(args.join(' '));
      break;
    case 'doctor':
    case 'health':
      await cmdDoctor();
      break;
    case 'tool':
      await cmdTool(args[0], args.slice(1));
      break;
    case 'introspect':
    case 'ask':
      await cmdIntrospect(args.join(' '));
      break;
    case 'memory':
    case 'warehouse':
      await cmdMemory();
      break;
    case 'workspace':
    case 'ws':
      await cmdWorkspace();
      break;
    case 'scan':
      await cmdScan();
      break;
    case 'bridge':
      await cmdBridge();
      break;
    case 'maps':
      await cmdMaps();
      break;
    default:
      console.log(`
NPR-Local CLI v0.0.1
Usage: npr <command> [options]

Commands:
  chat <msg>          Send message to agent (JSON response)
  stream <msg>        Send message with SSE streaming
  status              Server status + verify
  context [phase]     Load context (6N/12P/18R/24H)
  logs [n]            Last n agent logs
  config [k] [v]      Get/set config
  search <q>          Search memory
  doctor              Health checks
  tool <t> [args]     Execute tool
  introspect <q>      Ask gateway a question
  memory              List warehouse files
  workspace           Workspace context scan
  scan                System scan (ports, services, tools)
  bridge              Browser bridge info
  maps                Route maps

Server: ${BASE}
`);
  }
})().catch((err) => {
  console.error('Error:', err.message);
  console.error(`(Is NPR-Local running on ${BASE}?)`);
  process.exit(1);
});
