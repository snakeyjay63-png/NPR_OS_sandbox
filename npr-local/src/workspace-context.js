/**
 * Workspace Context — Python als context-broker
 *
 * Scant een directory, geeft gestructureerd overzicht:
 * - Recente wijzigingen (git + mtime)
 * - File index (type, grootte, extensie)
 * - Geowon memory lookup (optioneel)
 * - Content retrieval (zoek in bestanden)
 *
 * Resultaat = compacte context die in system prompt injecteert.
 * Blijft buiten llama's context window tot nodig.
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// @net 10.10.0.0/24
// Default workspace
const DEFAULT_WORKSPACE = '/home/claw/.openclaw/workspace/NPR_OS_sandbox';

/**
 * Scan workspace directory via Python helper
 * Returns structured JSON summary
 */
// @addr 10.10.0.1 | fd00:npr:0010:000::1 — workspace scan
function scanWorkspace(dir = DEFAULT_WORKSPACE) {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, '..', 'scripts', 'workspace-index.py');

    if (!fs.existsSync(script)) {
      // Fallback: basic Node.js scan
      resolve(basicScan(dir));
      return;
    }

    execFile('python3', [script, dir, '--git'], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[workspace-context] Python scan failed: ${stderr}`);
        resolve(basicScan(dir));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve(basicScan(dir));
      }
    });
  });
}

/**
 * Content retrieval — zoek relevante fragments in workspace bestanden
 * @param {string} query - Zoekterm
 * @param {string} dir - Workspace directory
 * @param {number} maxResults - Max fragmenten
 * @returns {Array} Array van {file, line, content} matches
 */
// @addr 10.10.0.2 | fd00:npr:0010:000::2 — content retrieval
function retrieveContent(query, dir = DEFAULT_WORKSPACE, maxResults = 5) {
  const results = [];
  const searchPatterns = query.split(/\s+/).filter(w => w.length > 3);

  if (!searchPatterns.length) return results;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() || results.length >= maxResults) break;

      const fullPath = path.join(dir, entry.name);
      const ext = path.extname(entry.name).toLowerCase();

      // Alleen tekstbestanden
      if (!['.md', '.json', '.js', '.py', '.txt', '.html', '.yml', '.yaml', '.cfg', '.toml'].includes(ext)) continue;

      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length && results.length < maxResults; i++) {
          const line = lines[i];
          if (searchPatterns.some(p => line.toLowerCase().includes(p.toLowerCase()))) {
            results.push({
              file: entry.name,
              line: i + 1,
              content: line.trim().slice(0, 200),
            });
          }
        }
      } catch {
        // skip binary/unreadable
      }
    }
  } catch (e) {
    console.error(`[workspace-context] Content retrieval failed: ${e.message}`);
  }

  return results.slice(0, maxResults);
}

/**
 * Lees specifieke bestand met context
 */
// @addr 10.10.0.3 | fd00:npr:0010:000::3 — file reader
// P0-2 fix: path traversal protection — reject paths escaping workspace
function resolveInsideWorkspace(requested, dir) {
  const root = path.resolve(dir || DEFAULT_WORKSPACE);
  const resolved = path.resolve(root, requested);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`Path escapes workspace: ${requested}`);
  }
  return resolved;
}

function readFileWithContext(filePath, dir = DEFAULT_WORKSPACE, contextLines = 3) {
  let fullPath;
  try {
    fullPath = resolveInsideWorkspace(filePath, dir);
  } catch(e) {
    return { error: e.message, path: filePath };
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    return {
      path: filePath,
      fullPath,
      lineCount: lines.length,
      size: content.length,
      preview: lines.slice(0, 10).join('\n'),
      content,
    };
  } catch (e) {
    return { path: filePath, error: e.message };
  }
}

/**
 * Fallback: basic Node.js filesystem scan
 */
// @addr 10.10.0.4 | fd00:npr:0010:000::4 — basic scan
function basicScan(dir) {
  const result = {
    path: dir,
    files: [],
    dirs: [],
    recentChanges: [],
    totalSize: 0,
    fileCount: 0,
    gitRoot: null,
  };

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        result.dirs.push(entry.name);
      } else {
        try {
          const stat = fs.statSync(fullPath);
          const ext = path.extname(entry.name);
          result.files.push({
            name: entry.name,
            size: stat.size,
            ext: ext,
            mtime: stat.mtime.toISOString(),
            mtimeAgo: timeAgo(stat.mtime),
          });
          result.totalSize += stat.size;
          result.fileCount++;
        } catch (e) {
          // skip
        }
      }
    }

    // Recent changes (last 24h)
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    result.recentChanges = result.files
      .filter(f => (now - new Date(f.mtime).getTime()) < dayMs)
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime))
      .slice(0, 10)
      .map(f => `${f.name} (${f.mtimeAgo})`);

  } catch (e) {
    result.error = e.message;
  }

  return result;
}

/**
 * Format time ago
 */
// @addr 10.10.0.5 | fd00:npr:0010:000::5 — time formatter
function timeAgo(date) {
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return 'net';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}u`;
  return `${days}d`;
}

/**
 * Content-aware context builder
 * Filtert op extensie + relevantie ipv blind alle bestanden tonen
 */
// @addr 10.10.0.6 | fd00:npr:0010:000::6 — context builder
function buildContextString(context, options = {}) {
  const { maxFiles = 20, maxTokens = 4000, priorityExts } = options;

  if (!context || context.error) {
    return `(workspace scan failed: ${context?.error || 'unknown'})`;
  }

  const extPriority = priorityExts || ['.md', '.json', '.js', '.py', '.txt', '.html', '.css'];
  const lines = [];
  let tokenEstimate = 0;

  lines.push(`## Workspace: ${context.path}`);
  lines.push(`Bestanden: ${context.fileCount} | Grootte: ${formatBytes(context.totalSize)} | Submappen: ${context.dirs.length}`);
  tokenEstimate += 30;

  if (context.recentChanges?.length) {
    lines.push(`\n### Recente wijzigingen (24h):`);
    context.recentChanges.slice(0, 8).forEach(r => {
      lines.push(`- ${r}`);
      tokenEstimate += r.length / 4;
    });
  }

  if (context.gitRoot) {
    lines.push(`\nGit root: ${context.gitRoot}`);
    if (context.gitStatus?.length) {
      lines.push('Git status:');
      context.gitStatus.slice(0, 5).forEach(s => {
        lines.push(`  ${s}`);
        tokenEstimate += s.length / 4;
      });
    }
  }

  // Priority-sorted files (content-aware)
  const sorted = context.files
    .map(f => ({
      ...f,
      priority: extPriority.indexOf(f.ext) >= 0 ? extPriority.indexOf(f.ext) : 99,
    }))
    .sort((a, b) => {
      // Priority exts first, then by recency
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(b.mtime) - new Date(a.mtime);
    })
    .slice(0, maxFiles);

  lines.push(`\n### Bestanden (prioriteit + recentie):`);
  sorted.forEach(f => {
    const sizeStr = formatBytes(f.size);
    const tag = f.priority < 99 ? ' ★' : '';
    lines.push(`- \`${f.name}\` (${sizeStr}, ${f.mtimeAgo})${tag}`);
    tokenEstimate += f.name.length / 4 + 5;
  });

  // Truncate if approaching token budget
  if (tokenEstimate > maxTokens) {
    const cutoff = Math.floor(lines.length * (maxTokens / tokenEstimate));
    lines.length = cutoff;
    lines.push('\n*(context afgekapt voor token-budget)*');
  }

  return lines.join('\n');
}

/**
 * Format bytes
 */
// @addr 10.10.0.7 | fd00:npr:0010:000::7 — byte formatter
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

module.exports = {
  scanWorkspace,
  basicScan,
  buildContextString,
  retrieveContent,
  readFileWithContext,
  DEFAULT_WORKSPACE,
};
