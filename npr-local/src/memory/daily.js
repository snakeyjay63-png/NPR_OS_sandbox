// @net 10.04.0.0/24
// ═══════════════════════════════════════════════════
// memory/daily.js — Daily Memory Files
// ═══════════════════════════════════════════════════
// memory/YYYY-MM-DD.md — raw daily notes
// Auto-created on first write, appended on subsequent writes
// ═══════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = process.env.NPR_WORKSPACE_DIR ||
  path.join(require('os').homedir(), '.openclaw', 'workspace');

const MEMORY_DIR = path.join(WORKSPACE_DIR, 'memory');

// ─── Date Helpers ───

/**
 * Get date string YYYY-MM-DD for a timezone
 * @param {string} tz - IANA timezone (default: Europe/Amsterdam)
 * @returns {string} YYYY-MM-DD
 */
function getDateString(tz = 'Europe/Amsterdam') {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

/**
 * Get path to daily memory file
 * @param {string} dateStr - Optional YYYY-MM-DD (default: today)
 * @returns {string} file path
 */
function getDailyPath(dateStr) {
  dateStr = dateStr || getDateString();
  return path.join(MEMORY_DIR, `${dateStr}.md`);
}

// ─── Daily File Operations ───

/**
 * Ensure memory directory exists
 */
function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
}

/**
 * Read today's daily memory file
 * @param {string} dateStr - Optional YYYY-MM-DD
 * @returns {string} file contents or empty string
 */
function readDaily(dateStr) {
  const filePath = getDailyPath(dateStr);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Write an entry to today's daily memory file
 * @param {object} entry - { type, title, content, tags? }
 * @param {string} dateStr - Optional YYYY-MM-DD
 * @returns {object} { date, path, appended }
 */
function writeDailyEntry(entry, dateStr) {
  ensureMemoryDir();
  const filePath = getDailyPath(dateStr);
  const date = dateStr || getDateString();
  const now = new Date().toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour12: false });

  // Format entry as markdown
  const lines = [];
  const typeLabel = (entry.type || 'note').toUpperCase();
  const tagsStr = entry.tags && entry.tags.length ? ` [${entry.tags.join(',')}]` : '';

  lines.push(`## [${now}] ${typeLabel}${tagsStr}`);
  if (entry.title) lines.push(`### ${entry.title}`);
  lines.push('');
  lines.push((entry.content || '').trim());
  lines.push('');

  const entryText = lines.join('\n') + '\n';

  // Append or create
  let appended = false;
  if (fs.existsSync(filePath)) {
    fs.appendFileSync(filePath, entryText, 'utf-8');
    appended = true;
  } else {
    // Create with header
    const header = `# Daily Memory — ${date}\n\n`;
    fs.writeFileSync(filePath, header + entryText, 'utf-8');
  }

  return { date, path: filePath, appended };
}

/**
 * Batch write multiple entries to daily file
 * @param {Array<object>} entries - Array of entry objects
 * @param {string} dateStr - Optional YYYY-MM-DD
 * @returns {object} summary
 */
function writeDailyBatch(entries, dateStr) {
  const results = [];
  for (const entry of entries) {
    results.push(writeDailyEntry(entry, dateStr));
  }
  return { count: results.length, date: dateStr || getDateString() };
}

/**
 * Read today and yesterday's daily files (session bootstrap)
 * @returns {object} { today, yesterday, todayDate, yesterdayDate }
 */
function readRecentDailies() {
  const tz = 'Europe/Amsterdam';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toLocaleDateString('en-CA', { timeZone: tz });

  return {
    todayDate: today,
    yesterdayDate: yesterday,
    today: readDaily(today),
    yesterday: readDaily(yesterday),
  };
}

/**
 * Search across daily files for keywords
 * @param {string} query - Search query
 * @param {number} daysBack - Days to search (default: 30)
 * @returns {Array<object>} matching entries
 */
function searchDailies(query, daysBack = 30) {
  const results = [];
  const q = query.toLowerCase();

  for (let i = 0; i < daysBack; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
    const filePath = getDailyPath(dateStr);

    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.toLowerCase().includes(q)) {
      // Extract matching sections
      const sections = content.split('\n## ');
      for (const section of sections) {
        if (section.toLowerCase().includes(q)) {
          const lines = section.split('\n');
          results.push({
            date: dateStr,
            title: lines[0]?.trim() || '',
            preview: section.slice(0, 200).trim(),
            full: section.trim(),
          });
        }
      }
    }
  }

  return results;
}

/**
 * Get daily file stats (line count, size, last modified)
 * @param {string} dateStr - Optional YYYY-MM-DD
 * @returns {object|null}
 */
function getDailyStats(dateStr) {
  const filePath = getDailyPath(dateStr);
  if (!fs.existsSync(filePath)) return null;

  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').length;

  return {
    date: dateStr || getDateString(),
    path: filePath,
    size: stat.size,
    lines,
    created: stat.birthtime.toISOString(),
    modified: stat.mtime.toISOString(),
  };
}

module.exports = {
  MEMORY_DIR,
  getDateString,
  getDailyPath,
  readDaily,
  writeDailyEntry,
  writeDailyBatch,
  readRecentDailies,
  searchDailies,
  getDailyStats,
};
