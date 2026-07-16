// ═══════════════════════════════════════════════════
// memory/context.js — Dynamic Context via Routing
// ═══════════════════════════════════════════════════
// Context = read-head, niet warehouse.
// Niet: "context vol → comprimeren"
// Wel: "context = routing → laadt wat nodig per fase"
// ═══════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Context per fase: wat is relevant?
const PHASE_CONTEXT = {
  '6N': { // Noise - ruwe data
    label: 'Noise',
    load: ['SOUL.md'], // Alleen kern-identiteit
    skip: ['MEMORY_claw.md', 'HEARTBEAT.md'], // Te zwaar
    maxChars: 2000,
  },
  '12P': { // Pattern - patroon herkennen
    label: 'Pattern',
    load: ['SOUL.md', 'USER.md'], // Identiteit + gebruiker
    skip: ['MEMORY_claw.md'], // Nog niet nodig
    maxChars: 5000,
  },
  '18R': { // Return - terugkeer, dieper
    label: 'Return',
    load: ['SOUL.md', 'USER.md', 'HEARTBEAT.md'], // + recent
    skip: [],
    maxChars: 10000,
  },
  '24H': { // Hexa - volledige integratie
    label: 'Hexa',
    load: ['SOUL.md', 'USER.md', 'MEMORY_claw.md', 'HEARTBEAT.md'],
    skip: [],
    maxChars: 20000,
  },
};

// Load context files for a phase
function loadContext(phase, workspaceDir) {
  const config = PHASE_CONTEXT[phase] || PHASE_CONTEXT['6N'];
  let context = '';
  let totalChars = 0;

  for (const file of config.load) {
    const filePath = path.join(workspaceDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Truncate if needed
      const chunk = content.slice(0, config.maxChars - totalChars);
      context += `## ${file}\n${chunk}\n\n`;
      totalChars += chunk.length;
    }
  }

  return {
    phase,
    label: config.label,
    files: config.load.filter(f => fs.existsSync(path.join(workspaceDir, f))),
    chars: totalChars,
    context,
  };
}

// Dynamic context based on route
function getContextForRoute(slot, workspaceDir) {
  const phase = getPhaseFromSlot(slot);
  return loadContext(phase, workspaceDir);
}

// Helper: slot → phase
function getPhaseFromSlot(slot) {
  if (slot < 16) return '6N';
  if (slot < 32) return '12P';
  if (slot < 48) return '18R';
  return '24H';
}

// Warehouse: alle bestaande context files
function listWarehouse(workspaceDir) {
  const files = [];
  const candidates = [
    'SOUL.md', 'USER.md', 'MEMORY.md', 'MEMORY_claw.md',
    'HEARTBEAT.md', 'IDENTITY.md', 'TOOLS.md', 'AGENTS.md',
  ];

  for (const f of candidates) {
    const p = path.join(workspaceDir, f);
    if (fs.existsSync(p)) {
      files.push({
        name: f,
        size: fs.statSync(p).size,
        path: p,
      });
    }
  }

  return files;
}

module.exports = {
  PHASE_CONTEXT,
  loadContext,
  getContextForRoute,
  listWarehouse,
  getPhaseFromSlot,
};
