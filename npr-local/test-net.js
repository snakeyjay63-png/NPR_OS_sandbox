#!/usr/bin/env node
// test-net.js — Test NPR-Net stack
//
// Usage: node test-net.js

const { NPRGateway, NPRService, registry, dns } = require('./src/net');
const BROWSER = require('./src/net/browser');

async function main() {
  console.log('═══ NPR-Net Test ═══\n');

  // ─── 1. DNS Test ───
  console.log('1. DNS Resolution:');
  const names = ['browser', 'chat', 'memory', 'agent', 'echo', 'doctor', 'config'];
  for (const name of names) {
    const r = dns.resolve(name);
    console.log(`   ${name.padEnd(10)} → slot ${String(r.slot).padStart(2)}  ${r.ip.padEnd(14)} :${r.port}`);
  }
  console.log();

  // ─── 2. Service Registration ───
  console.log('2. Service Registry:');
  const services = [
    BROWSER,
    new NPRService('chat', {
      description: 'Chat + agent loop',
      capabilities: ['chat', 'agent', 'stream'],
    }),
    new NPRService('memory', {
      description: 'Memory context + search',
      capabilities: ['memory', 'search', 'context'],
    }),
    new NPRService('doctor', {
      description: 'Health checks',
      capabilities: ['health', 'diagnostics'],
    }),
    new NPRService('echo', {
      description: 'Echo tool',
      capabilities: ['echo', 'test'],
    }),
  ];

  // Add handlers
  services[0].get('/agent/chat', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ echo: 'chat service', slot: services[0].slot }));
  });

  services[1].get('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ echo: 'memory service', slot: services[1].slot }));
  });

  for (const svc of services) {
    console.log(`   ${svc.name.padEnd(10)} → slot ${String(svc.slot).padStart(2)}  ${svc.resolved.ip.padEnd(14)} :${svc.port}`);
  }
  console.log();

  // ─── 3. Boot Gateway + Services ───
  console.log('3. Boot:');
  const GW_PORT = 5199;
  const { gateway, services: started } = await require('./src/net').boot({
    port: GW_PORT,
    services,
  });

  console.log(`   Gateway: :${GW_PORT}`);
  console.log(`   Services: ${started.join(', ')}`);
  console.log();

  // ─── 4. Test Endpoints ───
  console.log('4. Endpoint Tests:');
  const http = require('http');

  const tests = [
    { path: '/dns?name=chat', label: 'DNS resolve' },
    { path: '/registry', label: 'Registry' },
    { path: '/net', label: 'Network topology' },
    { path: `/dns?name=echo`, label: 'DNS echo' },
  ];

  for (const test of tests) {
    try {
      const result = await fetch(`http://127.0.0.1:${GW_PORT}${test.path}`);
      console.log(`   ${test.label.padEnd(20)} → ${result.ok ? '✓' : '✗'}`);
    } catch (e) {
      console.log(`   ${test.label.padEnd(20)} → ✗ (${e.message})`);
    }
  }

  console.log('\n═══ Test complete ═══');
  console.log(`\nDNS page: http://127.0.0.1:${GW_PORT}/public/dns.html`);
  console.log(`Registry: http://127.0.0.1:${GW_PORT}/registry`);
  console.log(`Network:  http://127.0.0.1:${GW_PORT}/net`);
  console.log(`\nPress Ctrl+C to stop`);

  // Keep alive
  await new Promise(() => {});
}

main().catch(console.error);
