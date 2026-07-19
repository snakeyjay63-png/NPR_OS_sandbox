// ═══════════════════════════════════════════════════
// memory/git-hexa-memory.js — Git als Hexa Memory-laag
// ═══════════════════════════════════════════════════
// Session JSON → geëxtraheerde essentie → hexa-compressed entry
// Git commit = persistent memory slot
// ═══════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const MEMORY_DIR = process.env.NPR_SESSIONS_DIR ||
  path.join(require('os').homedir(), '.openclaw', 'workspace', 'NPR_OS_sandbox-memory');

// ─── Hexa Compressor ───

/**
 * Split text into hexa-blocks (6-char chunks + padding)
 * Returns structured blocks with digital root metadata
 */
function toHexaBlocks(text) {
  const BLOCK_SIZE = 6;
  const blocks = [];
  for (let i = 0; i < text.length; i += BLOCK_SIZE) {
    blocks.push(text.slice(i, i + BLOCK_SIZE));
  }
  return blocks;
}

function digitalRoot(n) {
  while (n > 9) n = Math.floor(n / 10) + (n % 10);
  return n;
}

/**
 * Compress a session into a hexa-structured memory entry.
 * Returns a compact object suitable for git-commit messaging.
 */
function compressSession(sessionState) {
  const { sessionId, turns, history, halted_at, halt_reason } = sessionState;

  // Extract user intents (first user messages)
  const userMessages = (history || []).filter(h => h.role === 'user');
  const intents = userMessages.map(m => {
    const truncated = (m.content || '').slice(0, 60);
    return truncated.replace(/[\n\r]/g, ' ');
  });

  // Extract assistant key responses (first 2)
  const assistantMessages = (history || []).filter(h => h.role === 'assistant').slice(0, 2);
  const responses = assistantMessages.map(m => {
    const truncated = (m.content || '').slice(0, 80);
    return truncated.replace(/[\n\r]/g, ' ');
  });

  // Compute digital root from session data
  const rootSeed = (sessionId.length + turns + (history || []).length);
  const root = digitalRoot(rootSeed) || 1;

  // Hexa blocks from session ID
  const hexaBlocks = toHexaBlocks(sessionId);

  // Slot/phase from route trace if available
  const routeSlots = (sessionState.route_trace || [])
    .filter(r => r.slot !== null)
    .map(r => `0x${r.slot.toString(16).padStart(2, '0')}`)
    .slice(0, 4);

  return {
    sessionId,
    turns,
    root,
    hexaBlocks,
    routeSlots: routeSlots.length ? routeSlots : ['0x00'],
    pattern: routeSlots.length > 1 ? 'hexa-trace' : 'single-slot',
    intents: intents.slice(0, 3),
    summary: responses[0] || '(no response)',
    halted_at,
    halt_reason,
    nprLogicValue: 1.0, // TODO: real logic analysis
    efficiency: 1.0,
    waste: [],
    timestamp: new Date(halted_at || Date.now()).toISOString(),
  };
}

// ─── Git Memory Operations ───

/**
 * Initialize git repo in memory dir if not already initialized
 */
function ensureGitRepo() {
  if (!fs.existsSync(path.join(MEMORY_DIR, '.git'))) {
    execSync('git init', { cwd: MEMORY_DIR, stdio: 'pipe' });
    execSync('git config user.name "npr-local"', { cwd: MEMORY_DIR, stdio: 'pipe' });
    execSync('git config user.email "npr@local"', { cwd: MEMORY_DIR, stdio: 'pipe' });
    console.log(`[git-hexa] Initialized git repo at ${MEMORY_DIR}`);
  }
}

/**
 * Write compressed memory entry and commit to git.
 * Returns commit hash on success.
 */
function commitSessionMemory(sessionId, sessionState) {
  try {
    ensureGitRepo();

    const compressed = compressSession(sessionState);

    // Write structured memory file
    const memoryFile = path.join(MEMORY_DIR, 'memory', `${sessionId}.hexa.json`);
    const memoryDir = path.join(MEMORY_DIR, 'memory');
    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }
    fs.writeFileSync(memoryFile, JSON.stringify(compressed, null, 2), 'utf8');

    // Update memory index
    const indexFile = path.join(MEMORY_DIR, 'memory', 'index.json');
    let index = [];
    if (fs.existsSync(indexFile)) {
      try { index = JSON.parse(fs.readFileSync(indexFile, 'utf8')); } catch { index = []; }
    }

    // Update or add entry
    const existingIdx = index.findIndex(e => e.sessionId === sessionId);
    const indexEntry = {
      sessionId: compressed.sessionId,
      root: compressed.root,
      turns: compressed.turns,
      timestamp: compressed.timestamp,
      summary: compressed.summary.slice(0, 80),
      routeSlots: compressed.routeSlots,
    };

    if (existingIdx >= 0) {
      index[existingIdx] = indexEntry;
    } else {
      index.push(indexEntry);
    }
    // Sort by timestamp descending
    index.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2), 'utf8');

    // Git add + commit
    execSync('git add -A', { cwd: MEMORY_DIR, stdio: 'pipe' });

    const commitMsg = [
      `[hexa:${compressed.root}] Session ${sessionId}`,
      `turns: ${compressed.turns} | pattern: ${compressed.pattern}`,
      `route: [${compressed.routeSlots.join(', ')}]`,
      `slots: 6+1`,
    ].join('\n');

    const hash = execSync('git commit -m "' + commitMsg.replace(/"/g, '\\"') + '"', {
      cwd: MEMORY_DIR,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    // git commit outputs: "[master <hash>] <msg>\n <files> changed..."
    // Extract hash from bracket line
    const bracketMatch = hash.match(/\[.*\s([0-9a-f]{7,40})\]/);
    const shortHash = bracketMatch ? bracketMatch[1].slice(0, 8) : 'unknown';
    console.log(`[git-hexa] Committed session ${sessionId} → ${shortHash}`);
    return { hash: shortHash, compressed };

  } catch (e) {
    console.error(`[git-hexa] Commit failed: ${e.message}`);
    return { hash: null, error: e.message };
  }
}

/**
 * Retrieve memory index (all sessions, ordered by recency)
 */
function getMemoryIndex() {
  const indexFile = path.join(MEMORY_DIR, 'memory', 'index.json');
  if (!fs.existsSync(indexFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  } catch {
    return [];
  }
}

/**
 * Search memory by digital root, session ID, or keyword
 */
function searchMemory(query) {
  const index = getMemoryIndex();
  if (!query) return index;

  const q = query.toLowerCase();
  return index.filter(e =>
    e.sessionId?.toLowerCase().includes(q) ||
    e.summary?.toLowerCase().includes(q) ||
    e.root?.toString().includes(q) ||
    e.routeSlots?.some(s => s.includes(q))
  );
}

/**
 * Get recent git log as memory timeline
 */
function getGitTimeline(limit = 20) {
  try {
    const out = execSync(
      `git log --oneline -${limit} --format="%h|%ai|%s"`,
      { cwd: MEMORY_DIR, encoding: 'utf8' }
    );
    return out.trim().split('\n').map(line => {
      const [hash, date, msg] = line.split('|');
      return { hash, date, msg };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = {
  compressSession,
  commitSessionMemory,
  getMemoryIndex,
  searchMemory,
  getGitTimeline,
  MEMORY_DIR,
};
