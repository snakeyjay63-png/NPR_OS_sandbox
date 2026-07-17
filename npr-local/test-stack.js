#!/usr/bin/env node
// test-stack.js — zelf-testend stack verificatie
// Lees eigen code, scan poorten, test endpoints, rapporteert feedback

const { readFileSync } = require('fs');

const NPR_PORT = process.env.NPR_PORT || '17000';
const GEOWON_PORT = process.env.GEOWON_PORT || '17004';
const CONFIG_PORT = process.env.NPR_CONFIG_PORT || '17010';

const checks = [];
let pass = 0, fail = 0, warn = 0;

function ok(msg) { pass++; checks.push({ ok: true, msg }); console.log(`  ✅ ${msg}`); }
function fail_fn(msg) { fail++; checks.push({ ok: false, msg }); console.log(`  ❌ ${msg}`); }
function warn_fn(msg) { warn++; checks.push({ ok: null, msg }); console.log(`  ⚠️  ${msg}`); }

async function get(url, label) {
  try {
    const res = await fetch(url);
    if (res.ok) { ok(`${label} → ${res.status}`); return res; }
    fail_fn(`${label} → ${res.status}`);
  } catch (e) {
    fail_fn(`${label} → ${e.message}`);
  }
}

async function post(url, body, label) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) { ok(`${label} → ${res.status}`); return res; }
    fail_fn(`${label} → ${res.status}`);
  } catch (e) {
    fail_fn(`${label} → ${e.message}`);
  }
}

(async () => {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║  NPR Local Stack Self-Test           ║');
  console.log('╚═══════════════════════════════════════╝\n');

  // ── 1. Poort consistentie scan ──
  console.log('1. Poort consistentie (chat.html vs boot.js vs index.js)');
  const chatHtml = readFileSync('./public/chat.html', 'utf8');
  const bootJs = readFileSync('./boot.js', 'utf8');
  const indexJs = readFileSync('./src/index.js', 'utf8');

  const chatPorts = chatHtml.match(/:\d{4}/g) || [];
  const bootPorts = bootJs.match(/:\d{4}/g) || [];
  const indexPort = indexJs.match(/PORT.*\|\| (\d+)/);

  console.log('   chat.html poorten:', [...new Set(chatPorts)].join(', '));
  console.log('   boot.js poorten:', [...new Set(bootPorts)].join(', '));
  console.log('   index.js PORT:', indexPort ? indexPort[1] : 'niet gevonden');

  // Check of chat.html poorten matchen met boot.js
  const chatSet = new Set(chatPorts);
  const bootSet = new Set(bootPorts);
  let mismatch = false;
  for (const p of chatSet) {
    if (!bootSet.has(p)) {
      warn_fn(`chat.html ${p} niet in boot.js`);
      mismatch = true;
    }
  }
  if (!mismatch) ok('chat.html ↔ boot.js poorten matchen');

  // ── 2. Live endpoints ──
  console.log('\n2. Live endpoints');
  await get(`http://[::1]:${NPR_PORT}/health`, 'npr-local /health');
  await get(`http://[::1]:${NPR_PORT}/status`, 'npr-local /status');
  await get(`http://[::1]:${NPR_PORT}/capabilities`, 'npr-local /capabilities');
  await get(`http://[::1]:${GEOWON_PORT}/sessions`, 'geowon /sessions');
  await get(`http://[::1]:${CONFIG_PORT}/chat.html`, 'config-llama /chat.html');
  // config-llama serveert alleen static files, geen /config endpoint
  // (config-llama = UI wrapper, geen API)

  // ── 3. Chat test ──
  console.log('\n3. Chat endpoint');
  const chatRes = await post(`http://[::1]:${NPR_PORT}/agent/chat`, {
    message: 'Zeg "stack live" in drie woorden of minder.',
    model: 'local'
  }, 'POST /agent/chat');

  if (chatRes) {
    const data = await chatRes.json();
    const reply = data?.response || data?.choices?.[0]?.message?.content || '(geen reply)';
    console.log(`   Reply: "${reply.trim().slice(0, 80)}"`);
    if (reply.length > 5) ok('Chat reply ontvangen');
    else warn_fn('Chat reply zeer kort');
  }

  // ── 4. Streaming test ──
  console.log('\n4. Streaming endpoint');
  try {
    const streamRes = await fetch(`http://[::1]:${NPR_PORT}/agent/chat-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Zeg "streaming werkt" in één zin.'
      })
    });
    if (streamRes.ok && streamRes.headers.get('content-type')?.includes('text/event-stream')) {
      ok('SSE streaming endpoint actief');
    } else {
      warn_fn('Streaming endpoint reageert maar geen SSE');
    }
  } catch (e) {
    fail_fn(`Streaming test → ${e.message}`);
  }

  // ── 5. Geowon session ──
  console.log('\n5. Geowon session storage');
  const testId = `test-${Date.now()}`;
  const gwRes = await post(`http://[::1]:${GEOWON_PORT}/session/${testId}`, {
    history: [
      { role: 'user', content: 'self-test' },
      { role: 'assistant', content: 'stack-ok' }
    ]
  }, `POST /session/${testId.slice(0, 12)}...`);

  if (gwRes) {
    const getRes = await get(`http://[::1]:${GEOWON_PORT}/session/${testId}`, `GET /session/${testId.slice(0, 12)}...`);
    if (getRes) {
      const sess = await getRes.json();
      if (sess?.history?.length >= 2) ok('Session write + read OK');
      else warn_fn('Session data incompleet');
    }
  }

  // ── 6. Llama-server ──
  console.log('\n6. Llama-server');
  await get('http://127.0.0.1:8765/v1/models', 'llama-server /v1/models');

  // ── Samenvatting ──
  console.log('\n╔═══════════════════════════════════════╗');
  console.log(`║  Resultaat: ${pass} ✅  ${fail} ❌  ${warn} ⚠️                    ║`);
  console.log('╚═══════════════════════════════════════╝');

  if (fail > 0) {
    console.log('\n  Falen:');
    for (const c of checks) if (!c.ok) console.log(`    • ${c.msg}`);
  }
  if (warn > 0) {
    console.log('\n  Waarschuwingen:');
    for (const c of checks) if (c.ok === null) console.log(`    • ${c.msg}`);
  }

  // ── Feedback ──
  console.log('\n📋 Feedback:');
  if (fail === 0 && warn === 0) {
    console.log('   Stack is gezond. Alles draait op juiste poorten.');
  } else if (fail === 0) {
    console.log('   Stack functioneel met waarschuwingen. Zie hierboven.');
  } else {
    console.log('   Stack heeft problemen. Fix de ❌ items bovenaan.');
  }

  console.log('');
  process.exit(fail > 0 ? 1 : 0);
})();
