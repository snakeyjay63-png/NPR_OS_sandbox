// @net 10.00.0.1/24
// net/index.js — NPR-Net Entry Point
//
// Bootstrap het hele NPR-netwerk:
// 1. Gateway start op poort 5000
// 2. Services registreren en starten
// 3. DNS + registry endpoints
// 4. Netwerk topology zichtbaar via /dns, /registry, /net

const { NPRGateway } = require('./gateway');
const { NPRService } = require('./service');
const registry = require('./registry');
const dns = require('./dns');

// ─── Boot ───

async function boot(opts = {}) {
  const port = opts.port || 5000;
  const services = opts.services || [];

  // 1. Gateway (centrale router)
  const gateway = new NPRGateway({ port });
  await gateway.start();
  console.log(`[npr-net] gateway → :${port}`);

  // 2. Services starten
  const started = [];
  for (const svc of services) {
    try {
      await svc.start();
      started.push(svc.name);
      console.log(`[npr-net] ${svc.name} → :${svc.port} (slot ${svc.slot})`);
    } catch (e) {
      console.error(`[npr-net] ${svc.name} FAIL: ${e.message}`);
    }
  }

  // 3. DNS + Registry endpoints op gateway
  gateway.get('/dns', gateway.handleDNS.bind(gateway));
  gateway.get('/registry', gateway.handleRegistry.bind(gateway));
  gateway.get('/net', gateway.handleNet.bind(gateway));

  return { gateway, services: started };
}

// ─── Status ───

function status() {
  return {
    gateway: 'running',
    services: registry.list(),
    dns: dns.list(),
  };
}

module.exports = {
  boot,
  status,
  NPRGateway,
  NPRService,
  registry,
  dns,
};
