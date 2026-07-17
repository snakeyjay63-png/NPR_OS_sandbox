// @addr 10.06.0.0 | fd00:npr:0006:000::0 — Text Block Parser
// ═══════════════════════════════════════════════════
// Sits between Pattern and Return in the NPR cycle.
// Raw model text → uniform message-blocks → consistent layout.
// ═══════════════════════════════════════════════════

// @addr 10.06.0.1 — BlockKind
const BLOCK_KINDS = Object.freeze([
  'paragraph',
  'heading',
  'code',
  'list',
  'table',
  'tool_result',
  'status',
  'error',
  'npr_return',
  'raw',
]);

// @addr 10.06.1.0 — parseRawText
/**
 * Parse raw model output into structured blocks.
 * @param {string} text - Raw text from model
 * @returns {{blocks: object[], meta: object}}
 */
function parseRawText(text) {
  if (!text || !text.trim()) {
    return { blocks: [], meta: { line_count: 0 } };
  }

  const lines = text.split('\n');
  const blocks = [];
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Heading: # ## ### etc
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      finalizeBlock(blocks, currentBlock);
      currentBlock = {
        kind: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      };
      continue;
    }

    // Code block: ```lang ... ```
    if (trimmed.startsWith('```')) {
      finalizeBlock(blocks, currentBlock);
      const lang = trimmed.slice(3).trim() || 'text';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      currentBlock = {
        kind: 'code',
        language: lang,
        text: codeLines.join('\n'),
      };
      continue;
    }

    // List item: - * 1. etc
    const listMatch = trimmed.match(/^[\s]*([-*]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      if (currentBlock?.kind !== 'list') {
        finalizeBlock(blocks, currentBlock);
        currentBlock = { kind: 'list', items: [] };
      }
      currentBlock.items.push(listMatch[2].trim());
      continue;
    }

    // Status line: "Status: ..." or "Pattern: ..."
    const statusMatch = trimmed.match(/^(Status|Pattern|Route|Queue|Context):\s+(.+)$/i);
    if (statusMatch) {
      finalizeBlock(blocks, currentBlock);
      currentBlock = {
        kind: 'status',
        label: statusMatch[1],
        value: statusMatch[2].trim(),
      };
      continue;
    }

    // Error line: "Error:" or "Exception:"
    const errorMatch = trimmed.match(/^(Error|Exception|Fail):?\s+(.+)$/i);
    if (errorMatch) {
      finalizeBlock(blocks, currentBlock);
      currentBlock = {
        kind: 'error',
        type: errorMatch[1],
        message: errorMatch[2].trim(),
      };
      continue;
    }

    // NPR Return block: JSON-like or structured
    if (trimmed.startsWith('NPR_RETURN') || trimmed.startsWith('{') ) {
      finalizeBlock(blocks, currentBlock);
      // Try to collect JSON block
      let jsonText = trimmed;
      if (trimmed.startsWith('{')) {
        let braceCount = (trimmed.match(/{/g) || []).length - (trimmed.match(/}/g) || []).length;
        while (braceCount > 0 && i < lines.length - 1) {
          i++;
          jsonText += '\n' + lines[i];
          braceCount += (lines[i].match(/{/g) || []).length;
          braceCount -= (lines[i].match(/}/g) || []).length;
        }
        try {
          const parsed = JSON.parse(jsonText);
          currentBlock = {
            kind: 'npr_return',
            data: parsed,
          };
        } catch {
          currentBlock = { kind: 'raw', text: jsonText };
        }
      } else {
        currentBlock = { kind: 'npr_return', raw: trimmed };
      }
      continue;
    }

    // Table: pipe-separated
    const tableMatch = trimmed.match(/^\|(.+)\|$/);
    if (tableMatch) {
      if (currentBlock?.kind !== 'table') {
        finalizeBlock(blocks, currentBlock);
        currentBlock = { kind: 'table', rows: [] };
      }
      const cells = tableMatch[1].split('|').map(c => c.trim());
      currentBlock.rows.push(cells);
      continue;
    }

    // Tool result: [tool:xxx] or [result:xxx]
    const toolMatch = trimmed.match(/^\[(tool|result):([^\]]+)\](.*)$/i);
    if (toolMatch) {
      finalizeBlock(blocks, currentBlock);
      currentBlock = {
        kind: 'tool_result',
        name: toolMatch[2].trim(),
        output: toolMatch[3].trim(),
      };
      continue;
    }

    // Regular paragraph text
    if (trimmed) {
      if (!currentBlock || currentBlock.kind !== 'paragraph') {
        finalizeBlock(blocks, currentBlock);
        currentBlock = { kind: 'paragraph', text: '' };
      } else {
        currentBlock.text += '\n';
      }
      currentBlock.text += trimmed;
    } else {
      // Empty line — finalize current block
      finalizeBlock(blocks, currentBlock);
      currentBlock = null;
    }
  }

  finalizeBlock(blocks, currentBlock);

  return {
    blocks,
    meta: {
      line_count: lines.length,
      block_count: blocks.length,
    },
  };
}

function finalizeBlock(blocks, currentBlock) {
  if (currentBlock) {
    blocks.push(currentBlock);
  }
}

// @addr 10.06.1.1 — blocksToJSON
function blocksToJSON(blocks) {
  return {
    type: 'response',
    blocks: blocks.map(b => {
      switch (b.kind) {
        case 'paragraph': return { kind: 'paragraph', text: b.text };
        case 'heading':   return { kind: 'heading', level: b.level, text: b.text };
        case 'code':      return { kind: 'code', language: b.language, text: b.text };
        case 'list':      return { kind: 'list', items: b.items };
        case 'table':     return { kind: 'table', rows: b.rows };
        case 'tool_result': return { kind: 'tool_result', name: b.name, output: b.output };
        case 'status':    return { kind: 'status', label: b.label, value: b.value };
        case 'error':     return { kind: 'error', type: b.type, message: b.message };
        case 'npr_return': return { kind: 'npr_return', data: b.data ?? b.raw };
        default:          return { kind: 'raw', text: b.text ?? '' };
      }
    }),
  };
}

// @addr 10.06.1.2 — validateBlocks
function validateBlocks(parsed) {
  const { blocks } = parsed;
  const issues = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (!BLOCK_KINDS.includes(block.kind)) {
      issues.push({ index: i, issue: `Unknown kind: ${block.kind}` });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    block_count: blocks.length,
  };
}

module.exports = {
  BLOCK_KINDS,
  parseRawText,
  blocksToJSON,
  validateBlocks,
};
