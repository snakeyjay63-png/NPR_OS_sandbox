'use strict';

/**
 * Memory Search — Full-text search for cross-session recall.
 *
 * Pure JS implementation with optional SQLite FTS5 backend.
 * If better-sqlite3 is available, uses FTS5. Otherwise falls back to
 * a BM25-inspired tokenizer + in-memory index.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

class Tokenizer {
  constructor() {
    this._stop = new Set([
      'de', 'het', 'een', 'een', 'in', 'op', 'van', 'voor', 'met', 'is',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'to', 'in',
      'for', 'on', 'with', 'at', 'by', 'from', 'that', 'this', 'it',
      'and', 'or', 'but', 'not', 'be', 'has', 'had', 'do', 'does',
    ]);
  }

  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u024F\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !this._stop.has(t));
  }

  // TF: term frequency (normalized)
  tf(tokens, term) {
    const count = tokens.filter((t) => t === term).length;
    return count / tokens.length;
  }
}

// ---------------------------------------------------------------------------
// BM25 Index (in-memory)
// ---------------------------------------------------------------------------

class BM25Index {
  constructor() {
    this.tokenizer = new Tokenizer();
    this.docs = new Map();       // id -> { tokens, source, filePath, title, content, updatedAt }
    this.idf = new Map();        // term -> idf value
    this._k1 = 1.2;
    this._b = 0.75;
    this._avgLen = 0;
  }

  _recomputeIdf() {
    this.idf.clear();
    const n = this.docs.size || 1;
    const termDocCount = new Map();

    for (const { tokens } of this.docs.values()) {
      const unique = new Set(tokens);
      for (const term of unique) {
        termDocCount.set(term, (termDocCount.get(term) || 0) + 1);
      }
    }

    const totalLen = Array.from(this.docs.values()).reduce((s, d) => s + d.tokens.length, 0);
    this._avgLen = totalLen / n;

    for (const [term, df] of termDocCount) {
      this.idf.set(term, Math.log((n - df + 0.5) / (df + 0.5) + 1));
    }
  }

  add(id, { source, filePath, title, content, updatedAt }) {
    const tokens = this.tokenizer.tokenize(content);
    this.docs.set(id, { tokens, source, filePath, title, content, updatedAt });
    this._recomputeIdf();
  }

  remove(id) {
    this.docs.delete(id);
    this._recomputeIdf();
  }

  search(query, { limit = 20, source: sourceFilter = null, recencyWeight = 0.1 } = {}) {
    const qTokens = this.tokenizer.tokenize(query);
    if (!qTokens.length) return [];

    const now = Date.now();
    const results = [];

    for (const [id, doc] of this.docs) {
      if (sourceFilter && doc.source !== sourceFilter) continue;

      let score = 0;
      for (const term of qTokens) {
        const tf = this.tokenizer.tf(doc.tokens, term);
        const idf = this.idf.get(term) || 0;
        const lenNorm = 1 - this._b + this._b * (doc.tokens.length / this._avgLen || 1);
        score += (tf * (this._k1 + 1) / (tf + this._k1 * lenNorm)) * idf;
      }

      // Recency boost: newer docs get slight advantage
      const ageDays = (now - (new Date(doc.updatedAt || now).getTime())) / 86400000;
      const recencyBoost = recencyWeight * Math.max(0, 30 - ageDays) / 30;
      score += recencyBoost;

      if (score > 0) {
        results.push({ id, score, doc });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  stats() {
    const breakdown = {};
    for (const doc of this.docs.values()) {
      breakdown[doc.source] = (breakdown[doc.source] || 0) + 1;
    }
    return {
      totalDocs: this.docs.size,
      totalTerms: this.idf.size,
      avgTokenLength: this._avgLen,
      sourceBreakdown: breakdown,
    };
  }
}

// ---------------------------------------------------------------------------
// Memory Search Engine
// ---------------------------------------------------------------------------

class MemorySearch {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data');
    this.workspaceDir = options.workspaceDir || path.join(__dirname, '..', '..', '..', '..');
    this.index = new BM25Index();
    this._nextId = 1;
    this._sqliteAvailable = false;

    // Try SQLite FTS5 if available
    try {
      const Database = require('better-sqlite3');
      this._db = new Database(path.join(this.dataDir, 'memory.db'));
      this._db.exec(`
        CREATE TABLE IF NOT EXISTS memory_docs(
          doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT,
          file_path TEXT,
          title TEXT,
          content TEXT,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(content, content_rowid=doc_id);
      `);
      this._sqliteAvailable = true;
      this._ftsInsert = this._db.prepare('INSERT INTO memory_fts(rowid, content) VALUES((SELECT doc_id FROM memory_docs ORDER BY doc_id DESC LIMIT 1), ?)');
      this._ftsSearch = this._db.prepare('SELECT * FROM memory_fts WHERE memory_fts MATCH ? ORDER BY rank LIMIT ?');
    } catch (_) {
      // No sqlite — use in-memory BM25
    }
  }

  // ---- Indexing ----

  /** Index a single file */
  indexFile(source, filePath, title) {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) return null;

    const content = fs.readFileSync(absPath, 'utf8');
    const stat = fs.statSync(absPath);
    const id = this._nextId++;

    const docData = {
      source,
      filePath: absPath,
      title: title || path.basename(absPath),
      content,
      updatedAt: stat.mtime.toISOString(),
    };

    if (this._sqliteAvailable) {
      this._db.prepare('INSERT INTO memory_docs(source, file_path, title, content, updated_at) VALUES(?,?,?,?,?)')
        .run(source, absPath, docData.title, content, docData.updatedAt);
    } else {
      this.index.add(id, docData);
    }

    return { id, ...docData };
  }

  /** Reindex all known sources */
  reindexAll() {
    this.index = new BM25Index();
    this._nextId = 1;

    // Index daily memory files
    const memoryDir = path.join(this.workspaceDir, 'memory');
    if (fs.existsSync(memoryDir)) {
      for (const f of fs.readdirSync(memoryDir)) {
        if (f.endsWith('.md')) {
          this.indexFile('daily', path.join(memoryDir, f), f.replace('.md', ''));
        }
      }
    }

    // Index MEMORY_claw.md
    const clawMd = path.join(this.workspaceDir, 'MEMORY_claw.md');
    if (fs.existsSync(clawMd)) {
      this.indexFile('memory_claw', clawMd, 'MEMORY_claw');
    }

    // Index SOUL.md, USER.md, IDENTITY.md
    for (const name of ['SOUL.md', 'USER.md', 'IDENTITY.md']) {
      const p = path.join(this.workspaceDir, name);
      if (fs.existsSync(p)) {
        this.indexFile('identity', p, name.replace('.md', ''));
      }
    }

    return this.stats();
  }

  // ---- Search ----

  /** Search across indexed documents */
  search(query, options = {}) {
    const { limit = 20, source } = options;

    if (this._sqliteAvailable) {
      // FTS5 search
      const rows = this._ftsSearch.get(query, limit);
      return rows;
    }

    // BM25 search
    return this.index.search(query, { limit, source });
  }

  /** Search with surrounding context lines */
  searchWithContext(query, { limit = 5, contextLines = 3 } = {}) {
    const results = this.search(query, { limit: limit * 2 }); // get more to trim
    return results.slice(0, limit).map(({ id, score, doc }) => {
      const lines = doc.content.split('\n');
      // Find matching lines
      const queryWords = query.toLowerCase().split(/\s+/);
      const matchIndices = [];
      lines.forEach((line, i) => {
        if (queryWords.some((w) => line.toLowerCase().includes(w))) {
          matchIndices.push(i);
        }
      });

      const contextLinesOut = [];
      for (const idx of matchIndices.slice(0, 3)) {
        const start = Math.max(0, idx - contextLines);
        const end = Math.min(lines.length, idx + contextLines + 1);
        contextLinesOut.push({
          line: idx + 1,
          before: lines.slice(start, idx).join('\n'),
          match: lines[idx],
          after: lines.slice(idx + 1, end).join('\n'),
        });
      }

      return {
        id,
        score,
        source: doc.source,
        title: doc.title,
        filePath: doc.filePath,
        contexts: contextLinesOut,
      };
    });
  }

  /** Delete a document from the index */
  deleteDocument(id) {
    if (this._sqliteAvailable) {
      this._db.prepare('DELETE FROM memory_docs WHERE doc_id = ?').run(id);
    } else {
      this.index.remove(id);
    }
  }

  // ---- Stats ----

  stats() {
    if (this._sqliteAvailable) {
      const total = this._db.prepare('SELECT COUNT(*) as c FROM memory_docs').get();
      const breakdown = this._db.prepare('SELECT source, COUNT(*) as c FROM memory_docs GROUP BY source').all();
      return {
        totalDocs: total.c,
        sourceBreakdown: Object.fromEntries(breakdown.map((r) => [r.source, r.c])),
        backend: 'sqlite-fts5',
      };
    }
    return { backend: 'bm25-memory', ...this.index.stats() };
  }

  // ---- Lifecycle ----

  close() {
    if (this._db) {
      this._db.close();
    }
  }
}

module.exports = { MemorySearch, BM25Index, Tokenizer };
