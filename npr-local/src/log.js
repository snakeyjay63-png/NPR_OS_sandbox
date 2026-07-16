// @net 10.01.1.0/24
// src/log.js — Structured file logging
//
// Levels: error, warn, info, debug
// Output: console + file (JSON structured)
// Rotation: 10MB max, keep 5 files

const fs = require('fs');
const path = require('path');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', 'logs');
const MAX_SIZE = parseInt(process.env.LOG_MAX_SIZE) || 10 * 1024 * 1024; // 10MB
const MAX_FILES = parseInt(process.env.LOG_MAX_FILES) || 5;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.info;

// Ensure log directory exists
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}

function getLogPath() {
  const d = new Date();
  const dateStr = d.toISOString().split('T')[0];
  return path.join(LOG_DIR, `npr-${dateStr}.log`);
}

// Rotate if needed
function rotateIfNeeded(logPath) {
  try {
    const stat = fs.statSync(logPath);
    if (stat.size < MAX_SIZE) return;
  } catch { return; } // file doesn't exist yet

  // Rotate: .log → .log.1 → .log.2 ...
  for (let i = MAX_FILES - 1; i >= 1; i--) {
    const old = logPath + '.' + i;
    const newer = logPath + '.' + (i - 1);
    try { fs.renameSync(newer, old); } catch {}
  }
  try { fs.renameSync(logPath, logPath + '.0'); } catch {}
}

function writeEntry(level, msg, meta) {
  const entry = {
    ts: new Date().toISOString(),
    lvl: level,
    msg,
    pid: process.pid,
    ...meta,
  };
  const line = JSON.stringify(entry) + '\n';

  // Console (colorized for readability)
  const colors = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[90m', reset: '\x1b[0m' };
  const color = colors[level] || '';
  console.log(`${color}[${level.toUpperCase()}]${colors.reset} ${msg}`);

  // File
  try {
    const logPath = getLogPath();
    rotateIfNeeded(logPath);
    fs.appendFileSync(logPath, line);
  } catch (e) {
    // Silent fail — logging shouldn't crash the app
    console.error('[log-error] Could not write to file:', e.message);
  }
}

module.exports = {
  error: (msg, meta) => { if (LEVELS.error <= currentLevel) writeEntry('error', msg, meta); },
  warn: (msg, meta) => { if (LEVELS.warn <= currentLevel) writeEntry('warn', msg, meta); },
  info: (msg, meta) => { if (LEVELS.info <= currentLevel) writeEntry('info', msg, meta); },
  debug: (msg, meta) => { if (LEVELS.debug <= currentLevel) writeEntry('debug', msg, meta); },
};
