/**
 * Skill Parser — Parse SKILL.md files into structured Skill objects.
 *
 * Noise → Pattern: raw markdown becomes a structured procedure.
 *
 * Reads a SKILL.md file and extracts:
 *  - name, description, whenToUse, nprCycle, parameters, procedure, examples
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parse a SKILL.md file into a Skill object.
 *
 * @param {string} filePath — Absolute path to a SKILL.md file
 * @returns {Skill|null} Parsed skill or null on failure
 */
function parseSkill(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const skillDir = path.dirname(filePath);

  const skill = {
    name: '',
    description: '',
    whenToUse: [],
    nprCycle: { noise: '', pattern: '', return: '' },
    parameters: [],
    procedure: [],
    examples: [],
    assets: [],
    examplesDir: [],
    path: filePath,
    directory: skillDir,
  };

  // --- Title: # Skill: <name> or # <name> ---
  const titleMatch = raw.match(/^#\s*(?:Skill:\s*)?(.+)$/im);
  if (titleMatch) {
    skill.name = titleMatch[1].trim();
  }

  // --- YAML frontmatter override (if present) ---
  const frontmatter = extractFrontmatter(raw);
  if (frontmatter) {
    if (frontmatter.name) skill.name = frontmatter.name;
    if (frontmatter.description) skill.description = frontmatter.description;
    if (frontmatter.nprCycle) {
      Object.assign(skill.nprCycle, frontmatter.nprCycle);
    }
    if (frontmatter.whenToUse && Array.isArray(frontmatter.whenToUse)) {
      skill.whenToUse = frontmatter.whenToUse;
    }
  }

  // --- Description (markdown ## Description) ---
  if (!skill.description) {
    const descBlock = extractSection(raw, 'Description');
    if (descBlock) skill.description = descBlock.trim();
  }

  // --- When to Use ---
  const wtuBlock = extractSection(raw, 'When to Use');
  if (wtuBlock) {
    skill.whenToUse = wtuBlock
      .split('\n')
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
  }

  // --- NPR Cycle ---
  // Supports both formats:
  //   **Noise:** text          (colon inside bold)
  //   **Noise** : text         (colon outside bold)
  //   - **Noise:** text        (list item prefix)
  const nprBlock = extractSection(raw, 'NPR Cycle');
  if (nprBlock) {
    const extractField = (key) => {
      // colon inside bold: **Noise:** text
      let m = nprBlock.match(new RegExp(`\\*\\*${escapeRegex(key)}\\*\\*\\s*:\\s*(.+)$`, 'im'));
      if (m) return m[1].trim();
      // colon outside bold: **Noise** : text
      m = nprBlock.match(new RegExp(`\\*\\*${escapeRegex(key)}\\*\\*\\s*:\\s*(.+)$`, 'im'));
      if (m) return m[1].trim();
      // generic: key followed by colon and content (handles any bold placement)
      m = nprBlock.match(new RegExp(`${escapeRegex(key)}\\s*:\\s*(.+)$`, 'im'));
      if (m) return m[1].replace(/\*\*/g, '').trim();
      return '';
    };

    skill.nprCycle.noise = extractField('Noise');
    skill.nprCycle.pattern = extractField('Pattern');
    skill.nprCycle.return = extractField('Return');
  }

  // --- Parameters (markdown table) ---
  const paramBlock = extractSection(raw, 'Parameters');
  if (paramBlock) {
    skill.parameters = parseParamTable(paramBlock);
  }

  // --- Procedure (numbered list or step block) ---
  const procBlock = extractSection(raw, 'Procedure');
  if (procBlock) {
    skill.procedure = parseProcedure(procBlock);
  }

  // --- Examples (JSON blocks) ---
  const exBlock = extractSection(raw, 'Examples');
  if (exBlock) {
    skill.examples = parseExamples(exBlock);
  }

  // --- Scan for assets/examples directories ---
  const assetsDir = path.join(skillDir, 'assets');
  const examplesDir = path.join(skillDir, 'examples');
  if (fs.existsSync(assetsDir) && fs.statSync(assetsDir).isDirectory()) {
    skill.assets = listFiles(assetsDir);
  }
  if (fs.existsSync(examplesDir) && fs.statSync(examplesDir).isDirectory()) {
    skill.examplesDir = listFiles(examplesDir);
  }

  return skill;
}

/**
 * Extract YAML-style frontmatter from markdown.
 * Supports simple key: value, nested {}, and arrays [].
 *
 * @param {string} markdown
 * @returns {object|null}
 */
function extractFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return null;

  const block = match[1];
  const result = {};
  const lines = block.split('\n');

  for (const line of lines) {
    const kv = line.match(/^(\w[\w-]*)\s*:\s*(.+)$/);
    if (!kv) continue;

    const key = kv[1];
    let val = kv[2].trim();

    // Inline JSON-ish objects/arrays
    if ((val.startsWith('{') && val.endsWith('}')) || (val.startsWith('[') && val.endsWith(']'))) {
      try {
        val = JSON.parse(val);
      } catch {
        // keep raw string
      }
    } else {
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
    }

    result[key] = val;
  }

  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Extract content between a ## heading and the next ## heading (or end of doc).
 *
 * @param {string} markdown
 * @param {string} sectionName
 * @returns {string|null}
 */
function extractSection(markdown, sectionName) {
  const headingRe = new RegExp(`^##\\s+${escapeRegex(sectionName)}\\s*$`, 'im');
  const anyHeadingRe = /^##\s+/im;

  const headingMatch = markdown.match(headingRe);
  if (!headingMatch) return null;

  const start = headingMatch.index + headingMatch[0].length;
  const remainder = markdown.slice(start);
  const nextHeading = remainder.match(anyHeadingRe);

  if (!nextHeading) return remainder.trim();
  return remainder.slice(0, nextHeading.index).trim();
}

/**
 * Parse a markdown parameter table into an array of {name, type, required, description}.
 *
 * @param {string} tableMarkdown
 * @returns {Array<object>}
 */
function parseParamTable(tableMarkdown) {
  const rows = tableMarkdown
    .split('\n')
    .filter(line => {
      if (!line.includes('|')) return false;
      // Skip separator rows (|---|---|)
      if (/^\s*\|[\s-:|]+\|\s*$/.test(line)) return false;
      // Skip header rows (Name | Type | Required | Description)
      const cols = line.split('|').map(c => c.trim()).filter(Boolean);
      if (cols.length >= 3) {
        const lower = cols.map(c => c.toLowerCase());
        if (lower.includes('name') && (lower.includes('type') || lower.includes('required'))) return false;
      }
      return true;
    });

  const params = [];
  for (const row of rows) {
    const cols = row
      .split('|')
      .map(c => c.trim())
      .filter(Boolean);

    if (cols.length >= 4) {
      params.push({
        name: cols[0],
        type: cols[1],
        required: cols[2].toLowerCase() === 'true' || cols[2].toLowerCase() === 'yes',
        description: cols.slice(3).join(' ').trim(),
      });
    } else if (cols.length >= 2) {
      params.push({
        name: cols[0],
        type: cols[1] || 'string',
        required: false,
        description: cols[2] || '',
      });
    }
  }

  return params;
}

/**
 * Parse a procedure section into structured steps.
 * Detects step types: read, write, exec, template, prompt.
 *
 * @param {string} procMarkdown
 * @returns {Array<object>}
 */
function parseProcedure(procMarkdown) {
  const steps = [];
  const lines = procMarkdown.split('\n');

  // Try numbered list pattern: 1. `exec ...` or 1. exec ...
  const numberedRe = /^\s*\d+\.\s+(.*)$/;

  for (const line of lines) {
    const numMatch = line.match(numberedRe);
    if (numMatch) {
      steps.push(parseStepLine(numMatch[1]));
    } else if (line.trim()) {
      // Non-numbered lines might still be step commands
      const step = parseStepLine(line.trim());
      if (step.type !== 'text') {
        steps.push(step);
      }
    }
  }

  // If no structured steps found, treat whole block as a single text step
  if (steps.length === 0 && procMarkdown.trim()) {
    steps.push({ type: 'text', content: procMarkdown.trim() });
  }

  return steps;
}

/**
 * Parse a single procedure line into a step object.
 *
 * @param {string} line
 * @returns {{type: string, content: string, [key]: string}}
 */
function parseStepLine(line) {
  // `code block` style: `exec ls -la`
  const codeMatch = line.match(/^\s*`(\w+)\s+(.+?)`\s*$/);
  if (codeMatch) {
    return { type: codeMatch[1], content: codeMatch[2] };
  }

  // Bare keyword style: exec ls -la
  const bareMatch = line.match(/^(read|write|exec|template|prompt)\s+(.*)$/i);
  if (bareMatch) {
    return { type: bareMatch[1].toLowerCase(), content: bareMatch[2].trim() };
  }

  // Fallback: text description
  return { type: 'text', content: line.trim() };
}

/**
 * Parse example JSON blocks from a section.
 *
 * @param {string} section
 * @returns {Array<object>}
 */
function parseExamples(section) {
  const examples = [];
  const jsonBlocks = section.match(/```(?:json)?\s*([\s\S]*?)```/g);

  if (jsonBlocks) {
    for (const block of jsonBlocks) {
      const inner = block.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      try {
        examples.push(JSON.parse(inner));
      } catch {
        // skip malformed JSON
      }
    }
  }

  return examples;
}

/**
 * List files recursively in a directory (relative paths).
 *
 * @param {string} dir
 * @returns {Array<string>}
 */
function listFiles(dir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...listFiles(fullPath).map(f => path.join(entry.name, f)));
      } else {
        results.push(entry.name);
      }
    }
  } catch {
    // ignore permission errors
  }
  return results;
}

/**
 * Escape special regex characters in a string.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate a parsed skill has required fields.
 *
 * @param {Skill} skill
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateSkill(skill) {
  const errors = [];

  if (!skill.name) errors.push('Missing skill name (title or frontmatter "name")');
  if (!skill.description) errors.push('Missing description');
  if (!skill.procedure || skill.procedure.length === 0) {
    errors.push('Missing or empty procedure');
  }

  // Check NPR cycle fields
  const npr = skill.nprCycle || {};
  if (!npr.noise) errors.push('NPR Cycle missing "Noise" field');
  if (!npr.pattern) errors.push('NPR Cycle missing "Pattern" field');
  if (!npr.return) errors.push('NPR Cycle missing "Return" field');

  return { valid: errors.length === 0, errors };
}

module.exports = {
  parseSkill,
  validateSkill,
  extractFrontmatter,
  extractSection,
  parseParamTable,
  parseProcedure,
  parseStepLine,
  parseExamples,
};
