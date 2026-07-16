// ═══════════════════════════════════════════════════
// routes/capabilities.js — Wiskundige Capability Selectie
// ═══════════════════════════════════════════════════
// Dynamische selectie via wiskunde.
// Geen decimale routes die niet terug naar 0.0.0.0 gaan.
// Digitale root bepaalt welke tools aansluiten bij doel.
// ═══════════════════════════════════════════════════

const crypto = require('crypto');

// ─── Digitale Root ───
function digitalRoot(n) {
  while (n > 9) n = String(n).split('').reduce((a, b) => a + parseInt(b), 0);
  return n;
}

// ─── Capability Definitie ───
const CAPABILITIES = {
  // 1: Identiteit / Kern
  identity: {
    root: 1,
    hexa: '# I',
    tools: ['system-scan'],
    description: 'Systeem identiteit en status',
  },
  // 2: Communicatie
  communication: {
    root: 2,
    hexa: 'DENT',
    tools: ['echo'],
    description: 'Boodschap verzenden/ontvangen',
  },
  // 3: Analyse / Patronen
  analysis: {
    root: 3,
    hexa: 'ITY.',
    tools: ['system-scan'],
    description: 'Data analyseren, patronen vinden',
  },
  // 4: Structuur / Organisatie
  structure: {
    root: 4,
    hexa: 'md -',
    tools: [],
    description: 'Bestanden organiseren, structuur bouwen',
  },
  // 5: Creatie / Generatie
  creation: {
    root: 5,
    hexa: 'Who A',
    tools: [],
    description: 'Nieuwe content genereren',
  },
  // 6: Integratie / Synchronisatie
  integration: {
    root: 6,
    hexa: 'm I?',
    tools: [],
    description: 'Systemen verbinden, data synchroniseren',
  },
  // 7: Reflectie / Terugkeer
  reflection: {
    root: 7,
    hexa: '0.0.0',
    tools: [],
    description: 'Terug naar basis, reflectie',
  },
  // 8: Optimalisatie / Efficiëntie
  optimization: {
    root: 8,
    hexa: '.0 is',
    tools: ['system-scan'],
    description: 'Prestatie optimaliseren',
  },
  // 9: Transformatie / Cycliciteit
  transformation: {
    root: 9,
    hexa: 'land!',
    tools: [],
    description: 'Data transformeren, cyclische patronen',
  },
};

// ─── Doel → Digitale Root → Tools ───
function selectByGoal(goal) {
  // Bereken digitale root van doel
  const hash = crypto.createHash('md5').update(goal).digest();
  const root = digitalRoot(parseInt(hash.readUInt32BE(0).toString()));

  // Vind matching capability
  const capability = Object.entries(CAPABILITIES).find(
    ([, cap]) => cap.root === root
  );

  if (!capability) return null;

  return {
    goal,
    root,
    capability: capability[0],
    hexa: capability[1].hexa,
    tools: capability[1].tools,
    description: capability[1].description,
  };
}

// ─── Route → Capability Check ───
function routeCapability(route) {
  const hash = crypto.createHash('md5').update(route).digest();
  const root = digitalRoot(parseInt(hash.readUInt32BE(0).toString()));
  const slot = hash.readUInt32BE(0) % 64;

  return {
    route,
    root,
    slot,
    phase: slot < 16 ? '6N' : slot < 32 ? '12P' : slot < 48 ? '18R' : '24H',
    returnsToZero: true, // Alles gaat terug naar 0.0.0.0
  };
}

// ─── Alle capabilities ───
function listCapabilities() {
  return Object.entries(CAPABILITIES).map(([key, cap]) => ({
    capability: key,
    root: cap.root,
    hexa: cap.hexa,
    tools: cap.tools,
    description: cap.description,
  }));
}

// ─── Validatie: geen decimale routes ───
function isValidRoute(route) {
  // Geen decimalen, geen externe URLs
  if (route.includes('.')) return false;
  if (route.includes('://')) return false;
  if (!route.startsWith('/')) return false;
  return true;
}

// ─── Retourneer naar 0.0.0.0 ───
function returnToZero(route) {
  return {
    original: route,
    normalized: route.replace(/^\/+/, '/'),
    island: '0.0.0.0',
    valid: isValidRoute(route),
    root: digitalRoot(crypto.createHash('md5').update(route).digest().readUInt32BE(0)),
  };
}

module.exports = {
  CAPABILITIES,
  digitalRoot,
  selectByGoal,
  routeCapability,
  listCapabilities,
  isValidRoute,
  returnToZero,
};
