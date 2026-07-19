// @addr 10.04.0.0 | fd00:npr:0004:000::0 — Tool Call Parser
// ═══════════════════════════════════════════════════════
// Structured tool-call detection and parsing.
// Replaces fragile startsWith('tool:') with multi-format parser.
//
// Supported formats:
//   1. tool:name args          (legacy text)
//   2. <tool name="read">/path</tool>  (XML-style)
//   3. JSON tool_calls array   (OpenAI-style structured)
//   4. ```json{...}```        (code-fenced JSON)
// ═══════════════════════════════════════════════════════

const crypto = require('crypto');

/**
 * Normalize a tool call for dedup hashing.
 * Strip whitespace, normalize args order for known tools.
 */
function normalizeToolCall(name, args) {
  const n = (name || '').toLowerCase().trim();
  const a = (args || '').toLowerCase().trim();
  return `${n}:${a}`;
}

/**
 * Compute a stable hash for a tool call (for loop detection).
 * @returns {string} SHA-256 hex (first 16 chars)
 */
function toolCallHash(name, args) {
  const normalized = normalizeToolCall(name, args);
  return crypto.createHash('sha256')
    .update(normalized)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Parse tool calls from model response text.
 * Returns array of { name, args, hash, raw } or empty array.
 */
function parseToolCalls(response) {
  if (!response || typeof response !== 'string') return [];

  const trimmed = response.trim();

  // ─── Format 1: JSON tool_calls (OpenAI-style) ───
  const jsonResult = tryParseJsonToolCalls(trimmed);
  if (jsonResult.length > 0) return jsonResult;

  // ─── Format 2: XML-style <tool name="...">...</tool> ───
  const xmlResult = parseXmlToolCalls(trimmed);
  if (xmlResult.length > 0) return xmlResult;

  // ─── Format 3: Legacy text tool:name args ───
  const textResult = parseTextToolCall(trimmed);
  if (textResult.length > 0) return textResult;

  return [];
}

// ─── JSON Tool Call Parser ───

function tryParseJsonToolCalls(text) {
  // Try direct JSON first
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Try extracting JSON from code fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        parsed = JSON.parse(fenceMatch[1].trim());
      } catch { /* fall through */ }
    }
  }

  if (!parsed) return [];

  // OpenAI-style: { tool_calls: [{ function: { name, arguments } }] }
  if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
    return parsed.tool_calls.map(tc => {
      const fn = tc.function || {};
      const name = fn.name || fn.tool || '';
      let args = '';
      if (typeof fn.arguments === 'string') {
        args = fn.arguments;
      } else if (fn.arguments && typeof fn.arguments === 'object') {
        args = JSON.stringify(fn.arguments);
      }
      // Also handle flat format: { name, arguments }
      if (!name && parsed.content) {
        name = parsed.tool || parsed.name || '';
        args = typeof parsed.arguments === 'string' ? parsed.arguments : JSON.stringify(parsed.arguments || '');
      }
      return {
        name,
        args,
        hash: toolCallHash(name, args),
        raw: text.slice(0, 200),
        format: 'json',
      };
    }).filter(tc => tc.name);
  }

  // Flat JSON: { tool: "read", path: "/x" }
  if (parsed.tool || parsed.name) {
    const name = parsed.tool || parsed.name;
    const rest = { ...parsed };
    delete rest.tool;
    delete rest.name;
    return [{
      name,
      args: Object.entries(rest).map(([k,v]) => `${k}=${v}`).join(' '),
      hash: toolCallHash(name, ''),
      raw: text.slice(0, 200),
      format: 'json-flat',
    }];
  }

  return [];
}

// ─── XML-style Tool Call Parser ───

function parseXmlToolCalls(text) {
  // Match <tool name="read">/path/file</tool> or <tool name="scan" full="true" />
  const xmlRegex = /<tool\s+name=["'](\w+)["']\s*(?:([\s\S]*?))?\s*\/?\s*>/gi;
  const results = [];
  let m;

  while ((m = xmlRegex.exec(text)) !== null) {
    const name = m[1];
    const inner = (m[2] || '').trim();
    results.push({
      name,
      args: inner,
      hash: toolCallHash(name, inner),
      raw: m[0].slice(0, 200),
      format: 'xml',
    });
  }

  return results;
}

// ─── Legacy Text Tool Call Parser ───

function parseTextToolCall(text) {
  // tool:name args...
  const match = text.match(/^tool:(\w+)\s*(.*)?$/s);
  if (!match) return [];

  const [, name, args] = match;
  return [{
    name: name.trim(),
    args: (args || '').trim(),
    hash: toolCallHash(name.trim(), (args || '').trim()),
    raw: text.slice(0, 200),
    format: 'text',
  }];
}

// ─── Tool Call Format Detection ───

/**
 * Detect the dominant format in a response.
 * Returns 'tool' if tool calls detected, 'text' otherwise.
 */
function detectResponseType(response) {
  const calls = parseToolCalls(response);
  if (calls.length > 0) {
    return { type: 'tool', calls, format: calls[0].format };
  }
  return { type: 'text', content: response };
}

module.exports = {
  parseToolCalls,
  detectResponseType,
  toolCallHash,
  normalizeToolCall,
};
