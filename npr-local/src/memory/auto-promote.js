// @net 10.04.0.0/24
// ═══════════════════════════════════════════════════
// memory/auto-promote.js — Daily → Deep Memory Promotion
// ═══════════════════════════════════════════════════
// Promotes stable patterns from daily files to MEMORY_claw.md
// Rules: repeated across 3+ days, or explicitly marked as important
// ═══════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = process.env.NPR_WORKSPACE_DIR ||
  path.join(require('os').homedir(), '.openclaw', 'workspace');

const MEMORY_CLAW_PATH = path.join(WORKSPACE_DIR, 'MEMORY_claw.md');

// ─── Pattern Detection ───

/**
 * Detect repeated topics across daily files (candidate for promotion)
 * @param {number} daysBack - Days to scan
 * @returns {Array<object>} repeated patterns
 */
function detectRepeatedPatterns(daysBack = 14) {
  const topicCounts = new Map(); // topic → { count, dates, lastEntry }

  const { getDailyPath } = require('./daily');

  for (let i = 0; i < daysBack; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
    const filePath = getDailyPath(dateStr);

    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract topics from headings and content
    const lines = content.split('\n');
    for (const line of lines) {
      // Match ## or ### headings
      const headingMatch = line.match(/^#{2,3}\s+(.+)/);
      if (headingMatch) {
        const topic = headingMatch[1].trim().toLowerCase();
        // Skip noise
        if (topic.length < 5 || topic.includes('[') || topic.includes('##')) continue;

        if (!topicCounts.has(topic)) {
          topicCounts.set(topic, { count: 0, dates: [], lastEntry: line });
        }
        const entry = topicCounts.get(topic);
        entry.count++;
        entry.dates.push(dateStr);
        entry.lastEntry = line;
      }
    }
  }

  // Return topics appearing 3+ times
  return Array.from(topicCounts.entries())
    .filter(([_, v]) => v.count >= 3)
    .map(([topic, v]) => ({
      topic,
      count: v.count,
      dates: [...new Set(v.dates)].sort().reverse(),
      lastEntry: v.lastEntry,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Extract key decisions from daily content
 * @param {string} content - Daily file content
 * @returns {Array<string>} decision-like entries
 */
function extractDecisions(content) {
  const decisions = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const lower = line.toLowerCase().trim();

    // Decision markers
    if (
      lower.includes('besluit') ||
      lower.includes('decision') ||
      lower.includes('gekozen') ||
      lower.includes('choose') ||
      lower.includes('kies') ||
      lower.includes('→ ') ||
      lower.includes(': ')
    ) {
      decisions.push(line.trim());
    }
  }

  return decisions;
}

// ─── Promotion Logic ───

/**
 * Check if a topic is already in MEMORY_claw.md
 * @param {string} topic - Topic name
 * @returns {boolean}
 */
function isAlreadyPromoted(topic) {
  if (!fs.existsSync(MEMORY_CLAW_PATH)) return false;
  const content = fs.readFileSync(MEMORY_CLAW_PATH, 'utf-8');
  return content.toLowerCase().includes(topic.toLowerCase());
}

/**
 * Promote a set of topics to MEMORY_claw.md
 * @param {Array<object>} topics - Topics to promote
 * @returns {object} promotion result
 */
function promoteToMemoryClaw(topics) {
  const promoted = [];
  const skipped = [];

  // Ensure MEMORY_claw.md exists
  if (!fs.existsSync(MEMORY_CLAW_PATH)) {
    const header = `# MEMORY_claw.md — Deep Memory\n\nLessons, decisions, architecture, verified insights.\n\n`;
    fs.writeFileSync(MEMORY_CLAW_PATH, header, 'utf-8');
  }

  for (const topic of topics) {
    if (isAlreadyPromoted(topic.topic)) {
      skipped.push(topic.topic);
      continue;
    }

    // Append to MEMORY_claw.md
    const entry = [
      `## ${topic.topic}`,
      '',
      `Detected: ${topic.count} mentions across ${topic.dates.length} days`,
      `First seen: ${topic.dates.at(-1)}`,
      `Last seen: ${topic.dates[0]}`,
      '',
      `> ${topic.lastEntry.replace(/^#+\s*/, '')}`,
      '',
    ].join('\n');

    fs.appendFileSync(MEMORY_CLAW_PATH, '\n' + entry + '\n', 'utf-8');
    promoted.push(topic.topic);
  }

  return { promoted, skipped };
}

/**
 * Run full auto-promote cycle
 * @param {object} options - { daysBack, minCount, maxPromote }
 * @returns {object} summary
 */
function runPromoteCycle(options = {}) {
  const {
    daysBack = 14,
    minCount = 3,
    maxPromote = 5,
  } = options;

  // Detect repeated patterns
  const patterns = detectRepeatedPatterns(daysBack)
    .filter(p => p.count >= minCount);

  // Limit promotions per cycle
  const toPromote = patterns.slice(0, maxPromote);

  if (toPromote.length === 0) {
    return { promoted: [], skipped: [], message: 'No patterns to promote' };
  }

  const result = promoteToMemoryClaw(toPromote);
  return {
    promoted: result.promoted,
    skipped: result.skipped,
    totalPatterns: patterns.length,
    message: `Promoted ${result.promoted.length} topics to MEMORY_claw.md`,
  };
}

/**
 * Extract and return promotion candidates without modifying files
 * @param {number} daysBack
 * @returns {Array<object>} candidates
 */
function getCandidates(daysBack = 14) {
  const patterns = detectRepeatedPatterns(daysBack)
    .filter(p => p.count >= 3);

  return patterns.map(p => ({
    topic: p.topic,
    count: p.count,
    days: p.dates.length,
    promoted: isAlreadyPromoted(p.topic),
    lastEntry: p.lastEntry,
  }));
}

module.exports = {
  detectRepeatedPatterns,
  extractDecisions,
  promoteToMemoryClaw,
  runPromoteCycle,
  getCandidates,
  isAlreadyPromoted,
};
