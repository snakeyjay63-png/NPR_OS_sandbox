// Context Compression Engine — Dynamic Śūnya
//
// Concept: context is a breathing field.
// Old blocks condense into śūnya (empty space).
// New blocks expand into available room.
//
// Adapt from Hermes: /compress → NPR śūnya philosophy.
// Compression is not deletion — it is condensation.
// Like water to vapor to nothing visible, but still present.
//
// Patanjali 1.5 extension — viveka of context:
//   Distinguish anchor from noise,
//   keep what must remain, release what can be compressed,
//   let śūnya hold what the field still needs.
//
// Modes:
//   summarize — LLM summarizes old messages (requires model call)
//   truncate  — deterministic truncation by age/token count
//   compress  — hybrid: summarize recent, truncate old, keep anchors
//
// Anchor blocks (never compressed):
//   - System prompt / SOUL.md directives
//   - User identity (USER.md)
//   - Active tool call results
//   - Explicit user instructions

const { ContextBreath, ROLES } = require('./context-breathe');

// ─── Defaults ───

const DEFAULT_CONFIG = {
  mode: 'compress',          // summarize | truncate | compress
  maxTokens: 32000,          // target token budget after compression
  maxTurns: 50,              // max turns before compression triggers
  anchorPatterns: [
    /^JE BENT/,              // system prompt directives (Dutch)
    /^YOU ARE/,              // system prompt directives (English)
    /SOUL\.md/i,             // SOUL.md references
    /USER\.md/i,             // USER.md references
    /npr-os/i,               // NPR-OS identity
    /context breath/i,       // breathing engine references
    /tool_call_result/i,     // active tool results
    /role:.*(vogel|haas|aap|olifant)/i, // role assignments
  ],
  keepRecent: 10,            // always keep last N messages untouched
  llmEndpoint: null,         // optional: endpoint for summarize mode
  llmModel: null,            // optional: model for summarize mode
  llmApiKey: null,           // optional: API key for summarize mode
  tokenEstimate: 'rough',    // rough | precise — how to estimate tokens
};

// ─── Token Estimation ───
// Lightweight token counter (no external dependency for rough mode).

class TokenEstimator {
  /**
   * Rough estimate: ~4 chars ≈ 1 token for Latin-script text.
   * More accurate for English/Dutch. Less so for CJK/emoji-heavy.
   */
  static rough(text) {
    if (!text || typeof text !== 'string') return 0;
    // Count characters, adjust for whitespace/emoji
    const chars = text.length;
    // Rough heuristic: average token is ~4 chars
    return Math.max(1, Math.ceil(chars / 4));
  }

  /**
   * Slightly more precise: split on word boundaries, account for
   * code blocks (denser tokens) and natural language.
   */
  static precise(text) {
    if (!text || typeof text !== 'string') return 0;
    let tokens = 0;
    // Split into code blocks and natural text
    const parts = text.split(/(```[\s\S]*?```)/);
    for (const part of parts) {
      if (part.startsWith('```')) {
        // Code: ~3.5 chars per token (denser)
        tokens += Math.max(1, Math.ceil(part.length / 3.5));
      } else {
        // Natural text: ~4 chars per token
        const words = part.trim().split(/\s+/).filter(Boolean);
        // ~1.3 tokens per word on average
        tokens += words.length * 1.3;
      }
    }
    return Math.max(1, Math.round(tokens));
  }

  static estimate(text, method = 'rough') {
    if (method === 'precise') return this.precise(text);
    return this.rough(text);
  }
}

// ─── Compression Engine ───

class ContextCompression {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Breath engine for integration
    this.breath = new ContextBreath({
      windowTokens: this.config.maxTokens * 2, // compression target is half window
    });

    // Compression history tracking
    this.compressionLog = [];
    this.totalCompressed = 0;
    this.totalSaved = 0;
  }

  // ─── Public API ───

  /**
   * Compress message history according to configured mode.
   *
   * @param {Array} history — Array of message objects {role, content, ...}
   * @param {Object} [overrideConfig] — Optional config overrides for this call
   * @returns {Object} { compressed: Array[], stats: Object }
   */
  compress(history, overrideConfig = {}) {
    const config = { ...this.config, ...overrideConfig };
    const mode = config.mode || 'compress';

    // Validate input
    if (!Array.isArray(history) || history.length === 0) {
      return { compressed: [], stats: { original: 0, final: 0, ratio: 1, saved: 0 } };
    }

    const stats = {
      original: history.length,
      originalTokens: 0,
      final: 0,
      finalTokens: 0,
      ratio: 1,
      saved: 0,
      anchors: 0,
      truncated: 0,
      summarized: 0,
      mode,
    };

    // Estimate original token count
    stats.originalTokens = this._countHistoryTokens(history, config);

    let result;
    switch (mode) {
      case 'summarize':
        result = this._compressSummarize(history, config);
        break;
      case 'truncate':
        result = this._compressTruncate(history, config);
        break;
      case 'compress':
      default:
        result = this._compressHybrid(history, config);
        break;
    }

    // Update stats
    stats.final = result.length;
    stats.finalTokens = this._countHistoryTokens(result, config);
    stats.saved = stats.originalTokens - stats.finalTokens;
    stats.ratio = stats.finalTokens > 0 ? stats.originalTokens / stats.finalTokens : Infinity;

    // Log compression
    this.compressionLog.push({
      timestamp: Date.now(),
      mode,
      stats: { ...stats },
    });
    this.totalCompressed += stats.original - stats.final;
    this.totalSaved += stats.saved;

    return { compressed: result, stats };
  }

  /**
   * Aggressive compression to minimal state (śūnya).
   * Reduces history to absolute essentials: anchors + one summary block.
   *
   * @param {Array} history
   * @returns {Object} { compressed: Array[], stats: Object }
   */
  compressToŚūnya(history) {
    // Collect anchors
    const anchors = history.filter(msg => this._isAnchor(msg));
    // Collect non-anchors for summary
    const compressible = history.filter(msg => !this._isAnchor(msg));

    // Build śūnya summary from compressible blocks
    const summary = this._buildŚūnyaSummaryFromBlocks(compressible);

    const result = [
      ...anchors,
      summary,
    ];

    const stats = {
      original: history.length,
      originalTokens: this._countHistoryTokens(history),
      final: result.length,
      finalTokens: this._countHistoryTokens(result),
      ratio: 1,
      saved: 0,
      anchors: anchors.length,
      mode: 'śūnya',
    };
    stats.saved = stats.originalTokens - stats.finalTokens;
    stats.ratio = stats.finalTokens > 0 ? stats.originalTokens / stats.finalTokens : Infinity;

    this.compressionLog.push({
      timestamp: Date.now(),
      mode: 'śūnya',
      stats: { ...stats },
    });

    return { compressed: result, stats };
  }

  /**
   * Expand a compressed block back into its original representation.
   * Note: this reconstructs the metadata, not the original content
   * (which was lost during compression). Returns a structured expansion.
   *
   * @param {Object} compressedBlock — A block with role === 'compressed'
   * @returns {Array} Expanded message objects (reconstructed placeholders)
   */
  expand(compressedBlock) {
    if (!compressedBlock || compressedBlock.role !== 'compressed') {
      return [compressedBlock];
    }

    const { originalCount = 0, topics = [], tools = [], turnRange = {} } = compressedBlock;
    const expanded = [];

    for (let i = 0; i < originalCount; i++) {
      expanded.push({
        role: 'assistant',
        content: `[Expanded placeholder ${i + 1}/${originalCount} — topics: ${topics.join(', ')}]`,
        _expanded: true,
        _fromCompression: compressedBlock.compressedAt,
      });
    }

    return expanded;
  }

  /**
   * Calculate compression ratio between original and compressed histories.
   *
   * @param {Array} originalHistory
   * @param {Array} compressedHistory
   * @returns {Object} Ratio statistics
   */
  getCompressionRatio(originalHistory, compressedHistory) {
    if (!Array.isArray(originalHistory) || !Array.isArray(compressedHistory)) {
      return { ratio: 1, messageCount: { original: 0, compressed: 0 }, tokenRatio: 1 };
    }

    const origTokens = this._countHistoryTokens(originalHistory);
    const compTokens = this._countHistoryTokens(compressedHistory);

    return {
      ratio: compTokens > 0 ? origTokens / compTokens : Infinity,
      messageCount: {
        original: originalHistory.length,
        compressed: compressedHistory.length,
        removed: originalHistory.length - compressedHistory.length,
      },
      tokenRatio: compTokens > 0 ? origTokens / compTokens : Infinity,
      tokens: {
        original: origTokens,
        compressed: compTokens,
        saved: origTokens - compTokens,
      },
    };
  }

  /**
   * Check if a single message is a compression candidate.
   *
   * @param {Object} message
   * @param {Object} [config] — Optional config override
   * @returns {boolean}
   */
  shouldCompress(message, config = {}) {
    const cfg = { ...this.config, ...config };

    if (!message || typeof message !== 'object') return false;

    // Anchors never compress
    if (this._isAnchor(message)) return false;

    // Already compressed
    if (message.role === 'compressed') return false;

    // Recent messages protected
    if (message._isRecent) return false;

    // Tool call results: keep last 3
    if (message._toolResult && message._toolResultRank <= 3) return false;

    // System messages
    if (message.role === 'system') return false;

    // Named anchor roles
    if (cfg.anchorRoles && cfg.anchorRoles.includes(message.role)) return false;

    return true;
  }

  /**
   * Build a śūnya summary from compressed blocks.
   * Combines metadata from multiple compressed blocks into a unified summary.
   *
   * @param {Array} compressedHistory — History containing compressed blocks
   * @returns {Object} Summary message object
   */
  buildŚūnyaSummary(compressedHistory) {
    if (!Array.isArray(compressedHistory)) {
      return {
        role: 'compressed',
        content: '[śūnya: empty field]',
        originalCount: 0,
        compressedAt: Date.now(),
      };
    }

    const compressedBlocks = compressedHistory.filter(m => m.role === 'compressed');
    const anchors = compressedHistory.filter(m => this._isAnchor(m));
    const others = compressedHistory.filter(m => m.role !== 'compressed' && !this._isAnchor(m));

    // Aggregate metadata from compressed blocks
    const allTopics = new Set();
    const allTools = new Set();
    let totalOriginal = 0;
    let totalCompressedBlocks = compressedBlocks.length;

    for (const block of compressedBlocks) {
      totalOriginal += block.originalCount || 0;
      if (Array.isArray(block.topics)) {
        block.topics.forEach(t => allTopics.add(t));
      }
      if (Array.isArray(block.tools)) {
        block.tools.forEach(t => allTools.add(t));
      }
    }

    // Add topics from non-compressed, non-anchor messages
    for (const msg of others) {
      totalOriginal++;
      const topic = this._extractTopic(msg.content || '');
      if (topic) allTopics.add(topic);
      const tool = this._extractTool(msg);
      if (tool) allTools.add(tool);
    }

    const summaryContent = [
      `śūnya summary: ${totalOriginal + others.length} messages → ${totalCompressedBlocks + anchors.length} blocks`,
      `topics: ${[...allTopics].join(', ') || 'none'}`,
      `tools: ${[...allTools].join(', ') || 'none'}`,
      `anchors preserved: ${anchors.length}`,
    ].join(' | ');

    return {
      role: 'compressed',
      content: summaryContent,
      originalCount: totalOriginal + others.length,
      compressedAt: Date.now(),
      topics: [...allTopics],
      tools: [...allTools],
      anchorCount: anchors.length,
    };
  }

  // ─── Mode: Summarize ───

  _compressSummarize(history, config) {
    const keepRecent = config.keepRecent || 10;

    // Split: recent (keep) vs old (summarize)
    const recent = history.slice(-keepRecent);
    const old = history.slice(0, -keepRecent);

    // Filter old for compressible candidates
    const anchors = old.filter(msg => this._isAnchor(msg));
    const compressible = old.filter(msg => !this._isAnchor(msg));

    if (compressible.length === 0) {
      return [...history]; // nothing to compress
    }

    // Attempt LLM summarization if endpoint configured
    let summaryBlock;
    if (config.llmEndpoint) {
      summaryBlock = this._summarizeWithLLM(compressible, config);
    } else {
      // Fallback: deterministic summary
      summaryBlock = this._deterministicSummary(compressible);
    }

    return [...anchors, summaryBlock, ...recent];
  }

  /**
   * Summarize messages via LLM call.
   * @returns {Object} Compressed summary block
   */
  _summarizeWithLLM(messages, config) {
    // Check if we have what we need for an LLM call
    if (!config.llmEndpoint || !Array.isArray(messages)) {
      return this._deterministicSummary(messages);
    }

    // Build prompt for summarization
    const prompt = this._buildSummarizePrompt(messages);

    // TODO: Implement actual LLM call when endpoint is configured.
    // For now, return deterministic summary as fallback.
    // Future: fetch(config.llmEndpoint, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.llmApiKey}` },
    //   body: JSON.stringify({ model: config.llmModel, prompt })
    // });

    return this._deterministicSummary(messages);
  }

  _buildSummarizePrompt(messages) {
    const excerpts = messages.map((msg, i) => {
      const content = (msg.content || '').substring(0, 200);
      return `[${msg.role || 'unknown'} #${i}]: ${content}`;
    }).join('\n');

    return `Summarize the following ${messages.length} conversation messages concisely.
Preserve key decisions, topics discussed, tools used, and outcomes.
Format as: "Topics: A, B, C | Tools: X, Y | Decisions: D1, D2 | Outcome: O"

Messages:
${excerpts}`;
  }

  /**
   * Deterministic (no LLM) summary of message blocks.
   * Extracts topics, tools, and key metadata.
   */
  _deterministicSummary(messages) {
    const topics = new Set();
    const tools = new Set();
    const decisions = [];

    for (const msg of messages) {
      const content = msg.content || '';

      // Extract topic hint
      const topic = this._extractTopic(content);
      if (topic) topics.add(topic);

      // Extract tool usage
      const tool = this._extractTool(msg);
      if (tool) tools.add(tool);

      // Detect decision markers
      if (/^(?:besluit|decision|conclusion|result|outcome):/i.test(content)) {
        decisions.push(content.substring(0, 80));
      }
    }

    const parts = [
      `[${messages.length} messages summarized`,
      `topics: ${[...topics].join(', ') || 'general'}`,
      `tools: ${[...tools].join(', ') || 'none'}`,
    ];
    if (decisions.length > 0) {
      parts.push(`decisions: ${decisions.join('; ')}`);
    }
    const summaryText = parts.filter(Boolean).join(' | ') + ']';

    return {
      role: 'compressed',
      content: summaryText,
      originalCount: messages.length,
      compressedAt: Date.now(),
      topics: [...topics],
      tools: [...tools],
      _mode: 'deterministic',
    };
  }

  // ─── Mode: Truncate ───

  _compressTruncate(history, config) {
    const keepRecent = config.keepRecent || 10;
    const maxTokens = config.maxTokens || 32000;

    // Always keep recent messages
    const recent = history.slice(-keepRecent);
    const candidatePool = history.slice(0, -keepRecent);

    // Keep anchors from the candidate pool
    const anchors = candidatePool.filter(msg => this._isAnchor(msg));

    // Calculate current token usage
    const recentTokens = this._countHistoryTokens(recent);
    const anchorTokens = this._countHistoryTokens(anchors);
    const budget = maxTokens - recentTokens - anchorTokens;

    if (budget <= 0) {
      // No room for anything beyond recent + anchors
      return [...anchors, ...recent];
    }

    // Truncate oldest messages until within budget
    const nonAnchorCandidates = candidatePool.filter(msg => !this._isAnchor(msg));
    const kept = [];
    let usedTokens = 0;

    for (const msg of nonAnchorCandidates) {
      const msgTokens = TokenEstimator.estimate(msg.content || '', config.tokenEstimate || 'rough');
      if (usedTokens + msgTokens <= budget) {
        kept.push(msg);
        usedTokens += msgTokens;
      } else {
        // This message would exceed budget — everything before it is truncated
        break;
      }
    }

    // Create truncation marker
    const truncated = nonAnchorCandidates.length - kept.length;
    const truncationBlock = {
      role: 'compressed',
      content: `[${truncated} messages truncated (age/token limit)]`,
      originalCount: truncated,
      compressedAt: Date.now(),
      _mode: 'truncate',
    };

    return [...anchors, truncationBlock, ...kept, ...recent];
  }

  // ─── Mode: Compress (Hybrid) ───

  _compressHybrid(history, config) {
    const keepRecent = config.keepRecent || 10;
    const maxTokens = config.maxTokens || 32000;

    // Split history into zones
    const recent = history.slice(-keepRecent);
    const older = history.slice(0, -keepRecent);

    // Separate anchors from compressible
    const anchors = older.filter(msg => this._isAnchor(msg));
    const compressible = older.filter(msg => !this._isAnchor(msg));

    if (compressible.length === 0) {
      return [...history];
    }

    // Calculate budget
    const recentTokens = this._countHistoryTokens(recent);
    const anchorTokens = this._countHistoryTokens(anchors);
    const budget = maxTokens - recentTokens - anchorTokens;

    // Keep tool results (last 3)
    const toolResults = compressible.filter(msg => this._isToolResult(msg));
    const nonTool = compressible.filter(msg => !this._isToolResult(msg));

    // Rank tool results by recency
    toolResults.sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0));
    toolResults.forEach((msg, i) => { msg._toolResultRank = i + 1; });

    const keepTools = toolResults.slice(0, 3);
    const compressTools = toolResults.slice(3);

    // Summarize the non-tool compressible blocks
    let summaryBlocks = [];
    if (nonTool.length > 0) {
      if (config.llmEndpoint) {
        // Chunk into groups for summarization
        const chunks = this._chunkMessages(nonTool, 10);
        summaryBlocks = chunks.map(chunk => this._deterministicSummary(chunk));
      } else {
        summaryBlocks = [this._deterministicSummary(nonTool)];
      }
    }

    // Compress old tool results into one block
    let toolSummaryBlock = null;
    if (compressTools.length > 0) {
      toolSummaryBlock = {
        role: 'compressed',
        content: `[${compressTools.length} tool results compressed]`,
        originalCount: compressTools.length,
        compressedAt: Date.now(),
        tools: compressTools.map(m => this._extractTool(m)).filter(Boolean),
        _mode: 'compress-tools',
      };
    }

    // Assemble result
    const result = [
      ...anchors,
      ...summaryBlocks,
      ...(toolSummaryBlock ? [toolSummaryBlock] : []),
      ...keepTools,
      ...recent,
    ];

    return result;
  }

  // ─── Internal Helpers ───

  /**
   * Check if a message is an anchor (never compressed).
   */
  _isAnchor(message) {
    if (!message || typeof message !== 'object') return false;

    const content = (message.content || '').toLowerCase();
    const role = (message.role || '').toLowerCase();

    // System messages are anchors
    if (role === 'system') return true;

    // Explicit anchor flag
    if (message._anchor) return true;

    // Pattern matching
    const patterns = this.config.anchorPatterns || [];
    for (const pattern of patterns) {
      if (pattern instanceof RegExp) {
        if (pattern.test(message.content || '') || pattern.test(message.role || '')) {
          return true;
        }
      } else if (typeof pattern === 'string') {
        if (content.includes(pattern.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if a message contains tool results.
   */
  _isToolResult(message) {
    if (!message) return false;
    const content = message.content || '';
    const name = message.name || '';

    // Check for tool result markers
    if (message._toolResult) return true;
    if (name && (name.includes('tool') || name.includes('result') || name.includes('exec') || name.includes('read') || name.includes('write'))) return true;
    if (/\b(tool_call|function_call|tool_result)\b/i.test(content)) return true;

    return false;
  }

  /**
   * Extract a topic keyword from message content.
   */
  _extractTopic(content) {
    if (!content || typeof content !== 'string') return null;

    // Look for topic indicators
    const topicPatterns = [
      /^(?:topic|onderwerp|subject):?\s*(.+)$/im,
      /^(?:bespreek|discuss|over):?\s*(.+)$/im,
      /^#(\w+)/im,
    ];

    for (const pattern of topicPatterns) {
      const match = content.match(pattern);
      if (match) return match[1].trim().substring(0, 50);
    }

    // Fallback: first noun phrase (very rough)
    const firstLine = content.split('\n')[0].substring(0, 60);
    if (firstLine.length > 10) {
      return firstLine.replace(/^[^a-zā-źĀ-Ź]*/, '').substring(0, 40) || null;
    }

    return null;
  }

  /**
   * Extract tool name from message.
   */
  _extractTool(message) {
    if (!message) return null;
    if (message.name) return message.name;
    if (message.tool) return message.tool;

    const content = message.content || '';
    // Look for tool markers
    const toolMatch = content.match(/(?:tool|function):\s*(\w+)/i);
    if (toolMatch) return toolMatch[1];

    return null;
  }

  /**
   * Count total estimated tokens in message history.
   */
  _countHistoryTokens(history, config = {}) {
    const method = (config && config.tokenEstimate) || 'rough';
    let total = 0;
    for (const msg of history) {
      total += TokenEstimator.estimate(msg.content || '', method);
      // Add role overhead (~2 tokens per message)
      total += 2;
    }
    return total;
  }

  /**
   * Chunk messages into groups of size N.
   */
  _chunkMessages(messages, chunkSize) {
    const chunks = [];
    for (let i = 0; i < messages.length; i += chunkSize) {
      chunks.push(messages.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Build śūnya summary from raw message blocks.
   */
  _buildŚūnyaSummaryFromBlocks(messages) {
    if (!messages || messages.length === 0) {
      return {
        role: 'compressed',
        content: '[śūnya: void — no messages to condense]',
        originalCount: 0,
        compressedAt: Date.now(),
      };
    }

    const topics = new Set();
    const tools = new Set();
    const roles = new Set();

    for (const msg of messages) {
      const topic = this._extractTopic(msg.content || '');
      if (topic) topics.add(topic);
      const tool = this._extractTool(msg);
      if (tool) tools.add(tool);
      if (msg.role) roles.add(msg.role);
    }

    const summaryText = `śūnya: ${messages.length} messages condensed | roles: ${[...roles].join(', ')} | topics: ${[...topics].join(', ') || 'none'} | tools: ${[...tools].join(', ') || 'none'}`;

    return {
      role: 'compressed',
      content: summaryText,
      originalCount: messages.length,
      compressedAt: Date.now(),
      topics: [...topics],
      tools: [...tools],
      roles: [...roles],
      _mode: 'śūnya',
    };
  }

  // ─── Integration with ContextBreath ───

  /**
   * Auto-compress when breath engine exceeds budget.
   * Called by the breath engine loop when context window fills.
   *
   * @param {Array} history
   * @param {ContextBreath} breath
   * @returns {Array} Compressed history
   */
  autoCompressOnBreath(history, breath) {
    const available = breath._availableTokens();
    const currentTokens = this._countHistoryTokens(history);

    // Only compress if we're over budget
    if (currentTokens <= this.config.maxTokens && available > 0) {
      return history;
    }

    // Determine urgency
    const ratio = currentTokens / this.config.maxTokens;
    if (ratio > 3) {
      // Very over budget — aggressive śūnya
      const result = this.compressToŚūnya(history);
      return result.compressed;
    } else if (ratio > 2) {
      // Moderately over — hybrid compression
      const result = this.compress(history, { mode: 'compress' });
      return result.compressed;
    } else {
      // Slightly over — truncate only
      const result = this.compress(history, { mode: 'truncate' });
      return result.compressed;
    }
  }

  /**
   * Get compression statistics.
   */
  getStats() {
    return {
      totalCompressed: this.totalCompressed,
      totalSavedTokens: this.totalSaved,
      compressionCount: this.compressionLog.length,
      recentCompressions: this.compressionLog.slice(-5),
    };
  }

  /**
   * Reset compression tracking.
   */
  reset() {
    this.compressionLog = [];
    this.totalCompressed = 0;
    this.totalSaved = 0;
    if (this.breath) this.breath.reset();
  }
}

// ─── Standalone Functions ───

/**
 * Quick one-shot compression (no state).
 */
function quickCompress(history, config = {}) {
  const engine = new ContextCompression(config);
  return engine.compress(history);
}

/**
 * Quick śūnya compression (no state).
 */
function quickŚūnya(history, config = {}) {
  const engine = new ContextCompression(config);
  return engine.compressToŚūnya(history);
}

/**
 * Estimate tokens in a message array.
 */
function estimateTokens(messages, method = 'rough') {
  let total = 0;
  for (const msg of messages) {
    total += TokenEstimator.estimate(msg.content || '', method);
    total += 2; // role overhead
  }
  return total;
}

/**
 * Context headroom ratio → hexa-slot routing.
 *
 * Maps headroom ratio (0.0–1.0) to NPR hexa slot (0x00–0x3F).
 *   headroomRatio = 1 - (usedTokens / contextLimit)
 *
 * Low ratio (near 0.0) = tight context → compress slots (0x00-0x0F)
 * High ratio (near 1.0) = open context → full slots (0x30-0x3F)
 *
 * @param {number} headroomRatio - Available capacity ratio (0.0 = full, 1.0 = empty)
 * @returns {object} Hexa slot info (all values based on normalized input)
 */
function capacityRatioToHexaSlot(headroomRatio) {
  // Guard: NaN → treat as 0 (full context, compress)
  if (typeof headroomRatio !== 'number' || Number.isNaN(headroomRatio)) {
    headroomRatio = 0;
  }
  // Clamp to [0, 1)
  const norm = Math.max(0, Math.min(0.999, headroomRatio));
  const slot = Math.floor(norm * 0x40);
  const slotHex = `0x${slot.toString(16).padStart(2, '0').toUpperCase()}`;

  // Route based on slot range
  let route;
  if (slot < 0x10) {
    route = 'compress';      // 0x00-0x0F: aggressive compression zone
  } else if (slot < 0x20) {
    route = 'balance';       // 0x10-0x1F: balanced zone
  } else if (slot < 0x30) {
    route = 'expand';        // 0x20-0x2F: expansion zone
  } else {
    route = 'full';          // 0x30-0x3F: full capacity, no compression
  }

  return {
    slot,
    slotHex,
    headroomRatio: norm,
    route,
    description: `${slotHex} (${route}) — ${Math.round(norm * 100)}% capacity`,
  };
}

/**
 * @deprecated Use capacityRatioToHexaSlot instead.
 * Kept for backward compatibility during transition.
 */
function ratioToHexaSlot(ratio) {
  return capacityRatioToHexaSlot(ratio);
}

// ─── Exports ───

module.exports = {
  ContextCompression,
  TokenEstimator,
  quickCompress,
  quickŚūnya,
  estimateTokens,
  ratioToHexaSlot,
  DEFAULT_CONFIG,
};
