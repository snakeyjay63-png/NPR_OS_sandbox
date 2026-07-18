/**
 * init-once.cjs — INIT_ONCE Main-Sessie Initialisatie
 *
 * Eenmalige context-lading bij sessiestart.
 * Geen heartbeat. Geen recurring. Geen background agent.
 *
 * Route:
 *   boot main-sessie
 *   → lees exact 6 vaste bestanden
 *   → bouw Śūnya-context één keer
 *   → markeer context als ready
 *   → wacht stil op eerste gebruikersbericht
 *
 * @net 10.00.0.0/24
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ─── Vaste Contextbestanden ───

/**
 * De 6 basisbestanden die bij INIT_ONCE worden geladen.
 * Volgorde = prioriteit (SOUL > USER > IDENTITY > TOOLS > MEMORY > HEARTBEAT)
 */
const CONTEXT_FILES = [
  "SOUL.md",
  "USER.md",
  "IDENTITY.md",
  "TOOLS.md",
  "MEMORY.md",
  "HEARTBEAT.md",
];

/**
 * Default workspace directory (OpenClaw workspace root)
 */
const DEFAULT_WORKSPACE = "/home/claw/.openclaw/workspace";

// ─── State ───

/**
 * INIT_ONCE state — eenmaal geladen, niet meer opnieuw.
 */
const state = {
  initialized: false,
  files: [],
  context: null,
  timestamp: null,
  error: null,
};

// ─── Core ───

/**
 * Lees een enkel bestand (trunceren naar max bytes)
 * @param {string} filePath — pad naar bestand
 * @param {number} maxBytes — maximale bytes om te lezen
 * @returns {object} { path, size, content, truncated }
 */
function readOneFile(filePath, maxBytes = 8192) {
  try {
    const stat = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, "utf-8");
    const truncated = content.length > maxBytes;
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
      content: truncated ? content.slice(0, maxBytes) : content,
      truncated,
    };
  } catch (e) {
    return {
      path: filePath,
      name: path.basename(filePath),
      size: 0,
      content: "",
      error: e.message,
      missing: true,
    };
  }
}

/**
 * INIT_ONCE — laad de 6 vaste contextbestanden één keer
 * @param {string} [workspaceDir] — workspace root (default: DEFAULT_WORKSPACE)
 * @param {number} [maxBytesPerFile] — max bytes per bestand (default: 8192)
 * @returns {object} INIT_ONCE resultaat
 */
function initOnce(workspaceDir = DEFAULT_WORKSPACE, maxBytesPerFile = 8192) {
  // Voorkom herinitialisatie
  if (state.initialized) {
    return state.context;
  }

  const results = [];
  let totalBytes = 0;
  let loaded = 0;
  let missing = 0;

  for (const name of CONTEXT_FILES) {
    const filePath = path.join(workspaceDir, name);
    const result = readOneFile(filePath, maxBytesPerFile);
    results.push(result);
    totalBytes += result.content.length;

    if (result.missing) {
      missing++;
    } else {
      loaded++;
    }
  }

  // Bouw Śūnya-context
  const context = {
    initialized: true,
    timestamp: new Date().toISOString(),
    workspace: workspaceDir,
    files: results.map((r) => ({
      name: r.name,
      size: r.size,
      loaded: !r.missing,
      truncated: r.truncated || false,
      preview: r.content.slice(0, 120).replace(/\n/g, " ").trim(),
    })),
    summary: {
      total: CONTEXT_FILES.length,
      loaded,
      missing,
      totalBytes,
    },
    // Volledige content beschikbaar voor injectie
    content: results.filter((r) => !r.missing).map((r) => ({
      name: r.name,
      content: r.content,
    })),
  };

  // Bewaar state
  state.initialized = true;
  state.files = results;
  state.context = context;
  state.timestamp = context.timestamp;

  return context;
}

/**
 * Retourneer de Śūña-context als compacte string (voor system prompt injectie)
 * @returns {string} Context string
 */
function getContextString() {
  if (!state.initialized) {
    return "(INIT_ONCE: niet geïnitialiseerd)";
  }

  const lines = [];
  lines.push("## Śūnya-context geladen");
  lines.push(`Bestanden: ${state.context.summary.loaded}/${state.context.summary.total}`);
  lines.push(`Grootte: ${state.context.summary.totalBytes} bytes`);
  lines.push(`Tijdstip: ${state.context.timestamp}`);

  for (const f of state.context.files) {
    const tag = f.loaded ? "•" : "○";
    lines.push(`  ${tag} ${f.name} (${f.size}B)`);
  }

  return lines.join("\n");
}

/**
 * Retourneer de volledige content als één string (voor system prompt)
 * @returns {string} Volledige context
 */
function getFullContext() {
  if (!state.initialized) {
    initOnce();
  }

  if (!state.context || !state.context.content) {
    return "(geen context beschikbaar)";
  }

  const parts = [];
  for (const entry of state.context.content) {
    parts.push(`--- ${entry.name} ---`);
    parts.push(entry.content);
    parts.push("");
  }

  return parts.join("\n");
}

/**
 * Status check — is INIT_ONCE klaar?
 * @returns {object} Status
 */
function getStatus() {
  return {
    initialized: state.initialized,
    timestamp: state.timestamp,
    summary: state.context?.summary || null,
    files: state.context?.files || [],
  };
}

/**
 * Reset INIT_ONCE state (alleen voor testing/restart)
 */
function reset() {
  state.initialized = false;
  state.files = [];
  state.context = null;
  state.timestamp = null;
  state.error = null;
}

// ─── Exports ───

module.exports = {
  CONTEXT_FILES,
  DEFAULT_WORKSPACE,
  initOnce,
  getContextString,
  getFullContext,
  getStatus,
  reset,
};
