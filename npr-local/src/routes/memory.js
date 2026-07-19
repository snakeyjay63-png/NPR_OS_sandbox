// @net 10.06.0.0/24
// ═══════════════════════════════════════════════════
// routes/memory.js — Memory Management Endpoints
// ═══════════════════════════════════════════════════
// Daily memory, auto-promote, memory search
// ═══════════════════════════════════════════════════

const daily = require('../memory/daily');
const autoPromote = require('../memory/auto-promote');
const gitHexa = require('../memory/git-hexa-memory');

// ─── Daily Memory Endpoints ───

/**
 * GET /memory/daily[:dateStr]
 * Read daily memory file(s)
 */
function getDaily(req, res) {
  const dateStr = (req.params && req.params.dateStr) || null;

  if (dateStr) {
    const content = daily.readDaily(dateStr);
    if (!content) {
      return res.json({ error: 'No daily file found', date: dateStr });
    }
    return res.json({ date: dateStr, content });
  }

  // Recent dailies (today + yesterday)
  const recent = daily.readRecentDailies();
  res.json({
    todayDate: recent.todayDate,
    yesterdayDate: recent.yesterdayDate,
    today: recent.today || '(empty)',
    yesterday: recent.yesterday || '(empty)',
  });
}

/**
 * POST /memory/daily
 * Write entry to daily memory
 * Body: { type, title, content, tags? }
 */
function postDaily(req, res) {
  const { type, title, content, tags, date } = req.body || {};

  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  const result = daily.writeDailyEntry({ type, title, content, tags }, date);
  res.json({
    ok: true,
    date: result.date,
    path: result.path,
    appended: result.appended,
  });
}

/**
 * POST /memory/daily/batch
 * Batch write entries
 */
function postDailyBatch(req, res) {
  const { entries, date } = req.body || {};

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'entries array required' });
  }

  const result = daily.writeDailyBatch(entries, date);
  res.json({ ok: true, ...result });
}

// ─── Memory Search ───

/**
 * GET /memory/search?query=...&days=30
 * Search across daily files
 */
function searchDaily(req, res) {
  const { query, days } = req.query || {};

  if (!query) {
    return res.status(400).json({ error: 'query parameter required' });
  }

  const results = daily.searchDailies(query, parseInt(days) || 30);
  res.json({ query, results, count: results.length });
}

// ─── Auto-Promote ───

/**
 * GET /memory/promote/candidates
 * List promotion candidates
 */
function getPromoteCandidates(req, res) {
  const { days } = req.query || {};
  const candidates = autoPromote.getCandidates(parseInt(days) || 14);
  res.json({ candidates, count: candidates.length });
}

/**
 * POST /memory/promote
 * Run auto-promote cycle
 * Body: { daysBack?, minCount?, maxPromote? }
 */
function postPromote(req, res) {
  const options = req.body || {}; // Already safe
  const result = autoPromote.runPromoteCycle(options);
  res.json({ ok: true, ...result });
}

// ─── Git Hexa Memory ───

/**
 * GET /memory/git/index
 * Get git memory index
 */
function getGitIndex(req, res) {
  const index = gitHexa.getMemoryIndex();
  res.json({ index, count: index.length });
}

/**
 * GET /memory/git/timeline?limit=20
 * Get git timeline
 */
function getGitTimeline(req, res) {
  const limit = parseInt((req.query || {}).limit) || 20;
  const timeline = gitHexa.getGitTimeline(limit);
  res.json({ timeline, count: timeline.length });
}

/**
 * GET /memory/git/search?q=...
 * Search git memory
 */
function searchGitMemory(req, res) {
  const { q } = req.query || {};
  if (!q) {
    return res.status(400).json({ error: 'q parameter required' });
  }
  const results = gitHexa.searchMemory(q);
  res.json({ query: q, results, count: results.length });
}

// ─── Daily Stats ───

/**
 * GET /memory/stats
 * Get daily memory stats
 */
function getDailyStats(req, res) {
  const { date } = req.query || {};
  const stats = daily.getDailyStats(date);
  if (!stats) {
    return res.json({ error: 'No daily file found', date });
  }
  res.json(stats);
}

module.exports = {
  getDaily,
  postDaily,
  postDailyBatch,
  searchDaily,
  getPromoteCandidates,
  postPromote,
  getGitIndex,
  getGitTimeline,
  searchGitMemory,
  getDailyStats,
};
