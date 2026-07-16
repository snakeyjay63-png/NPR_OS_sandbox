// @net 10.13.0.0/24
// routes/gateway-introspect.js — Gateway Self-Introspection
// ═══════════════════════════════════════════════════════
//
// Los het gat op: je kunt GEEN vragen stellen aan de gateway
// over instellingen, architectuur, status, routes, etc.
//
// Vraag de gateway hoe hij werkt.
// ═══════════════════════════════════════════════════════

const path = require('path');
const os = require('os');
const fs = require('fs');
const { manifest, phaseInfo } = require('./core');
const { runtimeConfig } = require('./config-route');
const BrowserBridge = require('../net/browser-bridge');

// ─── Gateway Self-Knowledge ───

const SELF_KNOWLEDGE = {
  identity: {
    name: 'NPR-Local',
    version: '0.0.1',
    description: 'Single-agent local runtime met NPR 64-slot routing',
    origin: '0.0.0.0',
  },
  architecture: {
    type: 'single-agent',
    model: 'local LLM via llama.cpp',
    routing: 'NPR 64-slot engine (6-bit, digital root)',
    contextBreath: '4-rollen systeem (Vogel/Haas/Aap/Olifant)',
    bridge: 'Browser = actieve systeemlaag via WebAPI',
  },
  layers: [
    { name: 'field', desc: 'NPR engine, keyboard mapping, digital root' },
    { name: 'agent', desc: 'Agent loop, context breath, tool calls' },
    { name: 'memory', desc: 'Context, list, read-file, warehouse' },
    { name: 'routes', desc: 'HTTP endpoints, 64-slot registry' },
    { name: 'net', desc: 'NPR-Net, DNS, IPv4 mapping, browser bridge' },
    { name: 'interface', desc: 'Gateway, TTY, SSE streaming' },
  ],
  capabilities: {
    routing: 'NPR 64-slot met digital root fase detectie',
    contextBreath: '4-rollen routing met 6-bit levels (0-63)',
    memory: 'Workspace context scanning + warehouse',
    browser: '64 WebAPI routes via browser-bridge',
    tty: 'Terminal bridge met raw stdin + NPR per toets',
    tmux: 'tmux launcher met split layout',
  },
};

// ─── Question Router ───

function answerQuestion(q) {
  const lower = q.toLowerCase().trim();
  
  // ── Identity questions ──
  if (match(lower, ['wie ben je', 'what are you', 'wie is', 'wat ben je', 'identity', 'naam'])) {
    return SELF_KNOWLEDGE.identity;
  }
  
  if (match(lower, ['versie', 'version', 'welke versie', 'wat voor versie'])) {
    return { version: SELF_KNOWLEDGE.identity.version, name: SELF_KNOWLEDGE.identity.name };
  }
  
  // ── Architecture questions ──
  if (match(lower, ['architectuur', 'architecture', 'hoe werkt', 'how does it work', 'bouw', 'structuur'])) {
    return {
      ...SELF_KNOWLEDGE.architecture,
      layers: SELF_KNOWLEDGE.layers,
    };
  }
  
  if (match(lower, ['lagen', 'layers', 'laag', 'layer'])) {
    return SELF_KNOWLEDGE.layers;
  }
  
  // ── Routing questions ──
  if (match(lower, ['routing', 'route', 'slots', '6-bit', 'zes-bit', 'digitale root', 'digital root'])) {
    return {
      system: 'NPR 64-slot engine',
      encoding: '6-bit (0-63)',
      routing: 'Digital root → slot = (dr * 7) % 64',
      phases: require('../field/npr').PHASES,
      bridge: '64 browser routes via browser-bridge',
    };
  }
  
  // ── Config questions ──
  if (match(lower, ['config', 'instellingen', 'settings', 'configuratie', 'hoe is ingesteld'])) {
    return {
      config: runtimeConfig,
      note: 'Volledige runtime configuratie',
    };
  }
  
  if (match(lower, ['model', 'llm', 'ai', 'welk model'])) {
    return {
      model: runtimeConfig.model,
      architecture: SELF_KNOWLEDGE.architecture.model,
    };
  }
  
  if (match(lower, ['poort', 'port', 'host', 'waar luister', 'waar draait'])) {
    return {
      server: runtimeConfig.server,
      uptime: require('../interface/gateway').uptime ? require('../interface/gateway').uptime() : 'active',
    };
  }
  
  // ── Route questions ──
  if (match(lower, ['routes', 'endpoints', 'wat kan je', 'what can you', 'mogelijkheden', 'capabilities'])) {
    return {
      routes: manifest(),
      capabilities: SELF_KNOWLEDGE.capabilities,
      browserRoutes: BrowserBridge.map,
    };
  }
  
  // ── Memory questions ──
  if (match(lower, ['geheugen', 'memory', 'workspace', 'opslag', 'waar slaat'])) {
    return {
      memory: runtimeConfig.memory,
      workspace: runtimeConfig.memory.workspace,
      type: 'file-based context scanning + warehouse',
    };
  }
  
  // ── Status questions ──
  if (match(lower, ['status', 'health', 'draait', 'werkend', 'hoe gaat', 'how are'])) {
    return {
      status: 'live',
      uptime: require('../interface/gateway').uptime ? require('../interface/gateway').uptime() : 'active',
      routes: manifest().length,
      model: runtimeConfig.model.name,
    };
  }
  
  // ── Browser questions ──
  if (match(lower, ['browser', 'firefox', 'webapi', 'web api', 'bridge'])) {
    return {
      concept: 'Browser = actieve systeemlaag, niet passieve viewer',
      routes: BrowserBridge.map,
      categories: ['basis', 'storage', 'hardware', 'sensor', 'network', 'display', 'system', 'meta'],
      note: '64 routes via 6-bit encoding. Slot 0 = basis/null.',
    };
  }
  
  // ── Context Breath questions ──
  if (match(lower, ['context', 'breath', 'adem', 'rollen', 'vogel', 'haas', 'aap', 'olifant'])) {
    return {
      system: 'Context Breath — 4-rollen routing',
      roles: ['Vogel', 'Haas', 'Aap', 'Olifant'],
      levels: '6-bit (0-63)',
      note: 'Rollen bepalen hoe input wordt verwerkt in agent loop',
    };
  }
  
  // ── Help ──
  if (match(lower, ['help', 'hulp', 'wat vragen', 'what ask', 'vragen'])) {
    return {
      type: 'question-list',
      description: 'Vragen die je kunt stellen aan de gateway:',
      questions: [
        'Wie ben je?',
        'Welke versie?',
        'Hoe werkt de architectuur?',
        'Wat zijn de lagen?',
        'Hoe werkt routing?',
        'Wat zijn de instellingen?',
        'Welk model gebruik je?',
        'Op welke poort draai je?',
        'Wat zijn de routes?',
        'Waar sla je op?',
        'Hoe is de status?',
        'Hoe werkt de browser bridge?',
        'Wat is context breath?',
      ],
    };
  }
  
  // ── Fallback: config path lookup ──
  const configPath = lower.replace('config', '').replace('instelling', '').trim();
  if (configPath) {
    const val = require('./config-route').getAtPath(runtimeConfig, configPath);
    if (val !== undefined) {
      return { path: configPath, value: val };
    }
  }
  
  return {
    type: 'unknown',
    question: q,
    hint: 'Geef "help" voor lijst van mogelijke vragen.',
    available: Object.keys(SELF_KNOWLEDGE),
  };
}

// ─── Keyword Matcher ───

function match(text, keywords) {
  return keywords.some(k => text.includes(k));
}

// ─── Handler ───

function handler(req, res, ctx = {}) {
  const url = ctx.url || new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const params = new URLSearchParams(url.search);
  const q = params.get('q') || params.get('question') || '';
  
  if (req.method === 'GET' && q) {
    const answer = answerQuestion(q);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(answer, null, 2));
  } else if (req.method === 'GET') {
    // No question → show help
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      type: 'gateway-introspection',
      description: 'Stel vragen aan de gateway over zichzelf',
      usage: 'GET /introspect?q=<vraag>',
      examples: [
        '/introspect?q=wie ben je',
        '/introspect?q=hoe werkt routing',
        '/introspect?q=wat zijn de instellingen',
        '/introspect?q=welk model',
        '/introspect?q=help',
      ],
      identity: SELF_KNOWLEDGE.identity,
    }, null, 2));
  } else if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const q = data.q || data.question || '';
        const answer = answerQuestion(q);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(answer, null, 2));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'method not allowed' }));
  }
}

module.exports = { handler, answerQuestion, SELF_KNOWLEDGE };
