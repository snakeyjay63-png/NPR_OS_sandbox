// @net 10.09.0.0/24
// routes/memory-search.js — Memory search
// Equivalent: openclaw memory search

const fs = require('fs');
const path = require('path');

/**
 * Simple text search across memory directory.
 * Scans .md, .json, .txt files.
 * Returns matching lines with context.
 */
function searchMemory(query, options = {}) {
  const {
    memoryDir = process.env.NPR_MEMORY_DIR || path.join(process.env.HOME, '.openclaw', 'workspace', 'memory'),
    maxFiles = 100,
    maxResults = 50,
    context = 2, // lines before/after match
  } = options;

  const results = [];
  let filesScanned = 0;

  if (!fs.existsSync(memoryDir)) {
    return { results: [], filesScanned: 0, error: 'memory dir not found' };
  }

  const extFilter = /\.(md|json|txt|js)$/i;

  function scanDir(dir) {
    if (filesScanned >= maxFiles) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (filesScanned >= maxFiles) return;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules, .git
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          scanDir(fullPath);
        } else if (entry.isFile() && extFilter.test(entry.name)) {
          filesScanned++;
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            const lowerQuery = query.toLowerCase();

            for (let i = 0; i < lines.length && results.length < maxResults; i++) {
              if (lines[i].toLowerCase().includes(lowerQuery)) {
                const start = Math.max(0, i - context);
                const end = Math.min(lines.length, i + context + 1);
                results.push({
                  file: path.relative(memoryDir, fullPath),
                  line: i + 1,
                  match: lines[i].trim(),
                  context: lines.slice(start, end).map((l, idx) => ({
                    line: start + idx + 1,
                    text: l.trimEnd(),
                    highlight: idx === context,
                  })),
                });
              }
            }
          } catch (e) {
            // Skip unreadable files
          }
        }
      }
    } catch (e) {
      // Skip unreadable dirs
    }
  }

  scanDir(memoryDir);

  return { results, filesScanned };
}

/**
 * GET /memory/search?q=term&context=2&max=20
 */
function handler(req, res, ctx = {}) {
  const url = ctx.url || new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const params = new URLSearchParams(url.search);

  const query = params.get('q') || params.get('query') || '';
  if (!query) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'q parameter required' }));
    return;
  }

  const context = Math.min(parseInt(params.get('context')) || 2, 10);
  const maxResults = Math.min(parseInt(params.get('max')) || 50, 200);

  const result = searchMemory(query, { context, maxResults });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    query,
    count: result.results.length,
    filesScanned: result.filesScanned,
    results: result.results,
  }, null, 2));
}

/**
 * GET /memory/list — list memory files (recent first)
 */
function listHandler(req, res, ctx = {}) {
  const url = ctx.url || new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const params = new URLSearchParams(url.search);

  const memoryDir = params.get('dir') || path.join(process.env.HOME, '.openclaw', 'workspace', 'memory');
  const maxFiles = Math.min(parseInt(params.get('max')) || 20, 100);
  const extFilter = params.get('ext') ? `.${params.get('ext')}` : '';

  if (!fs.existsSync(memoryDir)) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'memory dir not found', dir: memoryDir }));
    return;
  }

  function listDir(dir) {
    const files = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          files.push(...listDir(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.txt') || entry.name.endsWith('.json'))) {
          const stat = fs.statSync(fullPath);
          files.push({
            path: path.relative(memoryDir, fullPath),
            size: stat.size,
            mtime: stat.mtime.toISOString(),
            ctime: stat.ctime.toISOString(),
          });
        }
      }
    } catch (e) { /* skip */ }
    return files;
  }

  let files = listDir(memoryDir);
  files.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
  files = files.slice(0, maxFiles);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ dir: memoryDir, files }, null, 2));
}

module.exports = { handler, listHandler, searchMemory };
