/**
 * Workspace Context — Python als context-broker
 *
 * Scant een directory, geeft gestructureerd overzicht:
 * - Recente wijzigingen (git + mtime)
 * - File index (type, grootte, extensie)
 * - Geowon memory lookup (optioneel)
 *
 * Resultaat = compacte context die in system prompt injecteert.
 * Blijft buiten llama's context window tot nodig.
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// Default workspace
const DEFAULT_WORKSPACE = '/home/claw/.openclaw/workspace/NPR_OS_sandbox';

/**
 * Scan workspace directory via Python helper
 * Returns structured JSON summary
 */
function scanWorkspace(dir = DEFAULT_WORKSPACE) {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, '..', 'scripts', 'workspace-index.py');

    if (!fs.existsSync(script)) {
      // Fallback: basic Node.js scan
      resolve(basicScan(dir));
      return;
    }

    execFile('python3', [script, dir], { timeout: 10000 }, (err, stdout, stderr) => {
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
 * Fallback: basic Node.js filesystem scan
 */
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
 * Build context string for system prompt injection
 */
function buildContextString(context, maxFiles = 20) {
  if (!context || context.error) {
    return `(workspace scan failed: ${context?.error || 'unknown'})`;
  }

  const lines = [];
  lines.push(`## Workspace: ${context.path}`);
  lines.push(`Bestanden: ${context.fileCount} | Grootte: ${formatBytes(context.totalSize)} | Submappen: ${context.dirs.length}`);

  if (context.recentChanges?.length) {
    lines.push(`\n### Recente wijzigingen (24h):`);
    context.recentChanges.slice(0, 8).forEach(r => lines.push(`- ${r}`));
  }

  if (context.gitRoot) {
    lines.push(`\nGit root: ${context.gitRoot}`);
    if (context.gitStatus?.length) {
      lines.push('Git status:');
      context.gitStatus.slice(0, 5).forEach(s => lines.push(`  ${s}`));
    }
  }

  // Recent files
  lines.push(`\n### Bestanden (recente ${Math.min(maxFiles, context.files.length)}):`);
  const sorted = context.files
    .sort((a, b) => new Date(b.mtime) - new Date(a.mtime))
    .slice(0, maxFiles);

  sorted.forEach(f => {
    const sizeStr = formatBytes(f.size);
    lines.push(`- \`${f.name}\` (${sizeStr}, ${f.mtimeAgo})`);
  });

  return lines.join('\n');
}

/**
 * Format bytes
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

module.exports = {
  scanWorkspace,
  basicScan,
  buildContextString,
  DEFAULT_WORKSPACE,
};
