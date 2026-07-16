// @net 10.04.0.0/24
// ═══════════════════════════════════════════════════
// memory/read-file.js — Secure Memory File Reader
// ═══════════════════════════════════════════════════
// Bronpatroon: OpenClaw memory-host-sdk (MIT)
// Origineel: packages/memory-host-sdk/src/host/read-file.ts
//
// Patronen geïmporteerd:
// - Path validatie (.md only, memory/ of MEMORY.md)
// - Line-based truncatie met continuation notice
// - Char budget enforcement
// - Paginatie (from/lines/nextFrom)
//
// Herschreven naar CommonJS JS, NPR Local context.
// ═══════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

/** Default lines when no range specified. */
const DEFAULT_LINES = 120;
/** Default max character budget. */
const DEFAULT_MAX_CHARS = 12_000;

/**
 * Canonical root memory filename.
 * MEMORY.md = deep layer router (see MEMORY.md in workspace).
 */
const CANONICAL_ROOT_MEMORY = 'MEMORY.md';

/**
 * Normalize a relative path: strip leading dots/slashes, forward slashes only.
 */
function normalizeRelPath(value) {
  return value.trim().replace(/^[./]+/, '').replace(/\\/g, '/');
}

/**
 * Check if a relative path is an allowed memory path.
 * Allowed: MEMORY.md (root), memory/*, dreams.md
 */
function isMemoryPath(relPath) {
  const normalized = normalizeRelPath(relPath);
  if (!normalized) return false;
  if (normalized === CANONICAL_ROOT_MEMORY) return true;
  if (normalized.toLowerCase() === 'dreams.md') return true;
  return normalized.startsWith('memory/');
}

/**
 * Build the continuation notice appended to truncated memory excerpts.
 */
function buildContinuationNotice(nextFrom, suggestReadFallback) {
  const base = typeof nextFrom === 'number'
    ? `[More content available. Use from=${nextFrom} to continue.]`
    : '[More content available. Requested excerpt exceeded the default maxChars budget.]';
  const fallback = suggestReadFallback
    ? ' If you need the full raw line, use read on the source file.'
    : '';
  return `\n${base.slice(0, -1)}${fallback}]`;
}

/**
 * Fit line slices to the response character budget while preserving line boundaries.
 */
function fitLinesToCharBudget(params) {
  const { lines, maxChars } = params;
  if (lines.length === 0) {
    return { text: '', includedLines: 0, hardTruncatedSingleLine: false };
  }

  let includedLines = lines.length;
  let text = lines.join('\n');
  while (includedLines > 1 && text.length > maxChars) {
    includedLines -= 1;
    text = lines.slice(0, includedLines).join('\n');
  }

  if (text.length <= maxChars) {
    return { text, includedLines, hardTruncatedSingleLine: false };
  }

  return {
    text: text.slice(0, maxChars),
    includedLines: 1,
    hardTruncatedSingleLine: true,
  };
}

/**
 * Normalize optional numeric config to a positive integer fallback.
 */
function normalizePositiveInteger(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : fallback;
}

/**
 * Build a memory read result from an already-selected line slice.
 */
function buildMemoryReadResultFromSlice(params) {
  const {
    selectedLines, relPath, startLine,
    moreSourceLinesRemain, maxChars, suggestReadFallback,
  } = params;

  const start = normalizePositiveInteger(startLine, 1);
  const fitted = fitLinesToCharBudget({
    lines: selectedLines,
    maxChars: normalizePositiveInteger(maxChars, DEFAULT_MAX_CHARS),
  });

  const moreRemain = moreSourceLinesRemain ?? false;
  const charCapTruncated =
    fitted.hardTruncatedSingleLine || fitted.includedLines < selectedLines.length;
  const nextFrom =
    !fitted.hardTruncatedSingleLine &&
    (moreRemain || fitted.includedLines < selectedLines.length)
      ? start + fitted.includedLines
      : undefined;
  const truncated = charCapTruncated || moreRemain;

  const text = truncated && fitted.text
    ? `${fitted.text}${buildContinuationNotice(nextFrom, fitted.hardTruncatedSingleLine && suggestReadFallback)}`
    : fitted.text;

  return {
    text,
    path: relPath,
    from: start,
    lines: fitted.includedLines,
    ...(truncated ? { truncated: true } : {}),
    ...(typeof nextFrom === 'number' ? { nextFrom } : {}),
  };
}

/**
 * Build a memory read result from raw file content and caller range options.
 *
 * This is the core function — reads a file, splits to lines, applies range
 * (from/lines), enforces char budget, returns result with pagination info.
 */
function buildMemoryReadResult(params) {
  const { content, relPath, from, lines, defaultLines, maxChars, suggestReadFallback } = params;
  const fileLines = content.split('\n');
  const start = normalizePositiveInteger(from, 1);
  const requestedCount = normalizePositiveInteger(
    lines ?? defaultLines,
    DEFAULT_LINES,
  );
  const selectedLines = fileLines.slice(start - 1, start - 1 + requestedCount);
  const moreSourceLinesRemain = (start - 1 + selectedLines.length) < fileLines.length;

  return buildMemoryReadResultFromSlice({
    selectedLines,
    relPath,
    startLine: start,
    moreSourceLinesRemain,
    maxChars,
    suggestReadFallback,
  });
}

/**
 * Read a validated memory markdown file from workspace.
 *
 * Security:
 * - Only .md files allowed
 * - Only MEMORY.md (root) or memory/* paths
 * - Path traversal (..) rejected
 * - Symlinks rejected
 *
 * @param {Object} params
 * @param {string} params.workspaceDir - Absolute workspace directory
 * @param {string} params.relPath - Relative or absolute path to read
 * @param {number} [params.from] - 1-indexed start line (default: 1)
 * @param {number} [params.lines] - Max lines to return (default: 120)
 * @param {number} [params.defaultLines] - Override default lines
 * @param {number} [params.maxChars] - Override char budget
 * @returns {Object} MemoryReadResult
 */
function readMemoryFile(params) {
  const { workspaceDir, relPath, from, lines, defaultLines, maxChars } = params;

  const rawPath = relPath.trim();
  if (!rawPath) {
    throw new Error('path required');
  }

  // Resolve to absolute path
  const absPath = path.isAbsolute(rawPath)
    ? path.resolve(rawPath)
    : path.resolve(workspaceDir, rawPath);

  // Compute relative path for validation
  const resolvedRel = path.relative(workspaceDir, absPath).replace(/\\/g, '/');
  const inWorkspace = resolvedRel.length > 0 && !resolvedRel.startsWith('..') && !path.isAbsolute(resolvedRel);

  // Validate: must be memory path
  if (!inWorkspace || !isMemoryPath(resolvedRel)) {
    throw new Error('path required'); // Generic to avoid path leakage
  }

  // Validate: must be .md
  if (!absPath.endsWith('.md')) {
    throw new Error('path required');
  }

  // Symlink check
  let stat;
  try {
    stat = fs.lstatSync(absPath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { text: '', path: resolvedRel };
    }
    throw err;
  }

  if (stat.isSymbolicLink()) {
    throw new Error('path required'); // Reject symlinks
  }

  if (!stat.isFile()) {
    throw new Error('path required');
  }

  // Read content
  const content = fs.readFileSync(absPath, 'utf-8');

  return buildMemoryReadResult({
    content,
    relPath: resolvedRel,
    from,
    lines,
    defaultLines,
    maxChars,
    suggestReadFallback: true,
  });
}

/**
 * List all memory files in workspace (memory/ directory + MEMORY.md).
 */
function listMemoryFiles(workspaceDir) {
  const result = [];

  // Root MEMORY.md
  const rootMemory = path.join(workspaceDir, CANONICAL_ROOT_MEMORY);
  try {
    const stat = fs.lstatSync(rootMemory);
    if (stat.isFile() && !stat.isSymbolicLink()) {
      result.push(rootMemory);
    }
  } catch {}

  // memory/ directory
  const memoryDir = path.join(workspaceDir, 'memory');
  try {
    const dirStat = fs.lstatSync(memoryDir);
    if (dirStat.isDirectory() && !dirStat.isSymbolicLink()) {
      const entries = fs.readdirSync(memoryDir, { recursive: true });
      for (const entry of entries) {
        const fullPath = path.join(memoryDir, entry);
        try {
          const stat = fs.lstatSync(fullPath);
          if (stat.isFile() && !stat.isSymbolicLink() && entry.endsWith('.md')) {
            result.push(fullPath);
          }
        } catch {}
      }
    }
  } catch {}

  return result;
}

module.exports = {
  DEFAULT_LINES,
  DEFAULT_MAX_CHARS,
  CANONICAL_ROOT_MEMORY,
  isMemoryPath,
  normalizeRelPath,
  buildMemoryReadResult,
  buildMemoryReadResultFromSlice,
  readMemoryFile,
  listMemoryFiles,
};
