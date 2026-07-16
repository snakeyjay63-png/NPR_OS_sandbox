// @net 10.04.0.0/24
// ═══════════════════════════════════════════════════
// memory/list.js — Memory Search & Index
// ═══════════════════════════════════════════════════
// Bronpatroon: OpenClaw memory-host-sdk (MIT)
// Origineel: packages/memory-host-sdk/src/host/query-expansion.ts
//
// Patronen geïmporteerd:
// - Keyword extraction from conversational queries
// - Multi-language stop words (EN + NL)
// - Token validation (min length, no pure numbers)
//
// Herschreven naar CommonJS JS, NPR Local context.
// Geen SQLite/FTS — puur file-based search.
// ═══════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { listMemoryFiles, readMemoryFile, normalizeRelPath } = require('./read-file.js');

// ─── Stop Words ───────────────────────────────────────────────────────

const STOP_WORDS_EN = new Set([
  // Articles/determiners
  'a', 'an', 'the', 'this', 'that', 'these', 'those',
  // Pronouns
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it', 'they', 'them',
  // Verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'can', 'may', 'might',
  // Prepositions
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'over',
  // Conjunctions
  'and', 'or', 'but', 'if', 'then', 'because', 'as', 'while',
  'when', 'where', 'what', 'which', 'who', 'how', 'why',
  // Time references
  'yesterday', 'today', 'tomorrow', 'earlier', 'later', 'recently', 'ago', 'now',
  // Vague
  'thing', 'things', 'stuff', 'something', 'anything', 'everything', 'nothing',
  // Request
  'please', 'help', 'find', 'show', 'get', 'tell', 'give',
]);

const STOP_WORDS_NL = new Set([
  // Lidwoorden
  'de', 'het', 'een', 'enige',
  // Voornaamwoorden
  'ik', 'me', 'mij', 'mijn', 'wij', 'ons', 'jij', 'je', 'jou', 'jouwe',
  'hij', 'hem', 'zijn', 'zij', 'haar', 'hun', 'het',
  // Werkwoorden
  'is', 'zijn', 'was', 'waren', 'heeft', 'hebben', 'had', 'hadden',
  'doet', 'doen', 'kan', 'kunt', 'zal', 'zullen', 'moet', 'moeten',
  'wil', 'willen', 'mag', 'kunnen', 'wordt', 'worden',
  // Voegwoorden
  'en', 'of', 'maar', 'als', 'dat', 'dan', 'omdat', 'want', 'terwijl',
  // Voorzetsels
  'in', 'op', 'aan', 'tot', 'voor', 'van', 'met', 'bij', 'vanuit',
  'door', 'tijdens', 'voordat', 'erna', 'tussen', 'onder', 'boven',
  // Tijdsverwijzingen
  'gisteren', 'vandaag', 'morgen', 'eerder', 'later', 'recent', 'nu',
  // Vraagwoorden
  'wat', 'wie', 'waar', 'wanneer', 'hoe', 'waarom', 'welke',
  // Vervagend
  'ding', 'dingen', 'iets', 'niets', 'alles',
]);

const STOP_WORDS = new Set([...STOP_WORDS_EN, ...STOP_WORDS_NL]);

// ─── Tokenization ─────────────────────────────────────────────────────

/**
 * Check if a token is a meaningful keyword (not stop word, not noise).
 */
function isValidKeyword(token) {
  if (!token || token.length === 0) return false;
  // Skip very short words (likely stop words or fragments)
  if (/^[a-zA-Z]+$/.test(token) && token.length < 3) return false;
  // Skip pure numbers
  if (/^\d+$/.test(token)) return false;
  // Skip pure punctuation
  if (/^[\p{P}\p{S}]+$/u.test(token)) return false;
  return true;
}

/**
 * Simple tokenizer — split on whitespace and punctuation.
 * Returns lowercase tokens.
 */
function tokenize(text) {
  // Normalize: lowercase, replace common punctuation
  const normalized = text.toLowerCase()
    .replace(/[^\w\s\u00C0-\u024F]/g, ' ')  // Keep accented chars
    .replace(/\s+/g, ' ')
    .trim();

  return normalized.split(' ').filter(Boolean);
}

/**
 * Extract meaningful keywords from a conversational query.
 *
 * Examples:
 *   "that thing we discussed about the API" → ["discussed", "api"]
 *   "wat was het plan voor de server" → ["plan", "server"]
 */
function extractKeywords(query) {
  const tokens = tokenize(query);
  const keywords = [];
  const seen = new Set();

  for (const token of tokens) {
    if (STOP_WORDS.has(token)) continue;
    if (!isValidKeyword(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    keywords.push(token);
  }

  return keywords;
}

// ─── File Search ──────────────────────────────────────────────────────

/**
 * Search memory files for keywords.
 *
 * @param {Object} params
 * @param {string} params.workspaceDir - Workspace directory
 * @param {string} params.query - Search query (conversational or keywords)
 * @param {number} [params.maxResults=10] - Max results to return
 * @param {number} [params.contextLines=2] - Lines of context per match
 * @returns {Array} Results: [{ path, line, text, score }]
 */
function searchMemory(params) {
  const { workspaceDir, query, maxResults = 10, contextLines = 2 } = params;

  const keywords = extractKeywords(query);
  if (keywords.length === 0) {
    return [];
  }

  const files = listMemoryFiles(workspaceDir);
  const results = [];

  for (const absPath of files) {
    const relPath = path.relative(workspaceDir, absPath).replace(/\\/g, '/');
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineLower = line.toLowerCase();

        // Count keyword matches
        let score = 0;
        for (const kw of keywords) {
          if (lineLower.includes(kw)) {
            score++;
          }
        }

        if (score > 0) {
          // Get context lines
          const start = Math.max(0, i - contextLines);
          const end = Math.min(lines.length, i + 1 + contextLines);
          const context = lines.slice(start, end).join('\n');

          results.push({
            path: relPath,
            line: i + 1, // 1-indexed
            score,
            keywords: keywords.filter(kw => lineLower.includes(kw)),
            context,
          });
        }
      }
    } catch {}
  }

  // Sort by score (descending), then by path
  results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  return results.slice(0, maxResults);
}

/**
 * List memory files with metadata (size, mtime, line count).
 */
function listMemoryWithMeta(workspaceDir) {
  const files = listMemoryFiles(workspaceDir);
  const result = [];

  for (const absPath of files) {
    try {
      const stat = fs.statSync(absPath);
      const relPath = path.relative(workspaceDir, absPath).replace(/\\/g, '/');
      const content = fs.readFileSync(absPath, 'utf-8');
      const lineCount = content.split('\n').length;

      result.push({
        path: relPath,
        size: stat.size,
        mtime: stat.mtimeMs,
        lines: lineCount,
      });
    } catch {}
  }

  // Sort: most recently modified first
  result.sort((a, b) => b.mtime - a.mtime);

  return result;
}

/**
 * Get a summary of memory state.
 */
function memorySummary(workspaceDir) {
  const files = listMemoryWithMeta(workspaceDir);
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);

  // Count by type
  const rootMemory = files.filter(f => f.path === 'MEMORY.md');
  const daily = files.filter(f => f.path.startsWith('memory/') && f.path.includes('.md'));

  return {
    fileCount: files.length,
    totalBytes,
    totalLines,
    rootMemory: rootMemory.length > 0 ? rootMemory[0] : null,
    dailyCount: daily.length,
    latestDaily: daily.length > 0 ? daily[0] : null,
  };
}

module.exports = {
  STOP_WORDS,
  extractKeywords,
  tokenize,
  isValidKeyword,
  searchMemory,
  listMemoryWithMeta,
  memorySummary,
};
