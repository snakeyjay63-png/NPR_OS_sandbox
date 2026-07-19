/**
 * Skill Executor — Execute skill procedures with NPR cycle semantics.
 *
 * Noise  → Gather inputs (read files, resolve params)
 * Pattern → Apply procedure steps (exec, write, template, prompt)
 * Return  → Collect outputs and return structured result
 *
 * Each step type maps to an execution function.
 * Unknown step types are treated as informational text.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Execution context — shared state across all steps of a skill run.
 */
class ExecutionContext {
  constructor(skill, params, options = {}) {
    this.skill = skill;
    this.params = params || {};
    this.workdir = options.workdir || skill.directory || process.cwd();
    this.timeout = options.timeout || 30000; // 30s default
    this.output = {};    // accumulated output data
    this.logs = [];      // execution log
    this.steps = [];     // completed step results
    this._llmCallback = options.llmCallback || null;
  }

  log(level, msg, data) {
    const entry = {
      level,
      step: this.steps.length,
      timestamp: Date.now(),
      message: msg,
      ...(data || {}),
    };
    this.logs.push(entry);
    if (typeof process.stdout.write === 'function') {
      process.stdout.write(
        `[skill:${this.skill.name}] [${level}] ${msg}\n`
      );
    }
  }

  /**
   * Resolve a parameter by name, with optional default.
   * Supports template replacement in any string: {param_name}
   */
  resolveParam(name, defaultValue) {
    return this.params[name] !== undefined ? this.params[name] : defaultValue;
  }

  /**
   * Replace {param} placeholders in a string with resolved values.
   */
  interpolate(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/\{(\w+)\}/g, (match, key) => {
      const val = this.params[key];
      return val !== undefined ? String(val) : match;
    });
  }

  /**
   * Render a template string with parameter substitution.
   * Supports simple {key} syntax and multi-line templates.
   */
  renderTemplate(templateStr, data) {
    const context = { ...this.params, ...(data || {}) };
    let result = templateStr;
    for (const [key, val] of Object.entries(context)) {
      const placeholder = `{${key}}`;
      result = result.split(placeholder).join(String(val ?? ''));
    }
    return result;
  }
}

/**
 * Execute a skill's procedure steps.
 *
 * @param {Skill} skill — Parsed skill object
 * @param {object} params — Input parameters
 * @param {object} options — Execution options
 * @returns {Promise<object>} Execution result
 */
async function executeSkill(skill, params = {}, options = {}) {
  const ctx = new ExecutionContext(skill, params, options);

  ctx.log('info', `Starting skill: ${skill.name}`);
  ctx.log('noise', 'NPR Cycle — Noise phase: gathering inputs', { params });

  // Phase 1: Noise — validate inputs
  const missing = skill.parameters
    .filter(p => p.required && params[p.name] === undefined)
    .map(p => p.name);

  if (missing.length > 0) {
    ctx.log('error', `Missing required parameters: ${missing.join(', ')}`);
    return {
      success: false,
      skill: skill.name,
      error: `Missing required parameters: ${missing.join(', ')}`,
      logs: ctx.logs,
    };
  }

  // Phase 2: Pattern — execute procedure
  ctx.log('pattern', 'NPR Cycle — Pattern phase: executing procedure', {
    stepCount: skill.procedure.length,
  });

  const results = [];
  for (let i = 0; i < skill.procedure.length; i++) {
    const step = skill.procedure[i];
    ctx.steps.push(step);

    try {
      const result = await executeStep(ctx, step, i);
      results.push(result);
      ctx.output[step.type] = ctx.output[step.type] || [];
      ctx.output[step.type].push(result);
      ctx.log('info', `Step ${i + 1} (${step.type}): complete`);
    } catch (err) {
      ctx.log('error', `Step ${i + 1} (${step.type}): ${err.message}`);
      if (options.continueOnError) {
        results.push({ success: false, error: err.message });
        continue;
      }
      return {
        success: false,
        skill: skill.name,
        error: `Step ${i + 1} failed (${step.type}): ${err.message}`,
        completedSteps: results,
        logs: ctx.logs,
      };
    }
  }

  // Phase 3: Return — collect outputs
  ctx.log('return', 'NPR Cycle — Return phase: collecting outputs');

  const result = {
    success: true,
    skill: skill.name,
    steps: results,
    output: ctx.output,
    logs: ctx.logs,
    nprCycle: {
      noise: skill.nprCycle.noise,
      pattern: skill.nprCycle.pattern,
      return: skill.nprCycle.return,
    },
  };

  ctx.log('info', `Skill complete: ${skill.name}`);
  return result;
}

/**
 * Execute a single procedure step.
 *
 * @param {ExecutionContext} ctx
 * @param {object} step
 * @param {number} index
 * @returns {Promise<object>}
 */
async function executeStep(ctx, step, index) {
  const content = ctx.interpolate(step.content);

  switch (step.type) {
    case 'read':
      return handleRead(ctx, content);

    case 'write': {
      const parts = splitFileAndContent(content);
      return handleWrite(ctx, parts.file, parts.content);
    }

    case 'exec':
      return handleExec(ctx, content);

    case 'template':
      return handleTemplate(ctx, content);

    case 'prompt':
      return handlePrompt(ctx, content);

    case 'text':
    default:
      return { success: true, type: 'text', content: ctx.interpolate(content) };
  }
}

/**
 * read <file> — Read a file from disk.
 */
function handleRead(ctx, filePath) {
  const resolved = path.resolve(ctx.workdir, filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  const content = fs.readFileSync(resolved, 'utf8');
  ctx.output[filePath] = content;
  return { success: true, type: 'read', file: filePath, content, lines: content.split('\n').length };
}

/**
 * write <file> <content> — Write content to a file.
 */
function handleWrite(ctx, filePath, content) {
  const resolved = path.resolve(ctx.workdir, filePath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(resolved, content, 'utf8');
  ctx.output[filePath] = content;
  return { success: true, type: 'write', file: filePath, bytes: Buffer.byteLength(content, 'utf8') };
}

/**
 * exec <command> — Run a shell command.
 */
function handleExec(ctx, command) {
  const timeoutMs = ctx.timeout;
  let stdout, stderr;
  try {
    stdout = execSync(command, {
      cwd: ctx.workdir,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024, // 1MB
      encoding: 'utf8',
    });
  } catch (err) {
    if (err.signal === 'SIGTERM') {
      throw new Error(`Command timed out after ${timeoutMs / 1000}s`);
    }
    stderr = err.stderr ? err.stderr.toString() : err.message;
    stdout = err.stdout ? err.stdout.toString() : '';
    // Non-zero exit is a warning, not fatal, unless configured otherwise
    ctx.log('warn', `Command exited with code ${err.status}: ${command}`);
  }
  return {
    success: true,
    type: 'exec',
    command,
    stdout: (stdout || '').trim(),
    stderr: (stderr || '').trim(),
  };
}

/**
 * template <template_path> [data_key] — Render a template file with params.
 * If no data_key, uses all params as context.
 */
function handleTemplate(ctx, content) {
  const parts = content.split(/\s+/).filter(Boolean);
  const templatePath = parts[0];
  const dataKey = parts[1] || null;

  const resolved = path.resolve(ctx.workdir, templatePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Template not found: ${resolved}`);
  }

  const templateRaw = fs.readFileSync(resolved, 'utf8');
  const data = dataKey && ctx.params[dataKey] ? { ...ctx.params[dataKey] } : ctx.params;
  const rendered = ctx.renderTemplate(templateRaw, data);

  ctx.output[`template:${templatePath}`] = rendered;
  return { success: true, type: 'template', file: templatePath, content: rendered };
}

/**
 * prompt <text> — Send text to an LLM for processing.
 * Requires llmCallback option on ExecutionContext.
 */
async function handlePrompt(ctx, text) {
  if (!ctx._llmCallback) {
    // Without an LLM callback, return the text as-is (passthrough)
    ctx.log('warn', 'No llmCallback configured; prompt step passthrough');
    return { success: true, type: 'prompt', input: text, output: text, note: 'passthrough' };
  }

  try {
    const output = await ctx._llmCallback(text, ctx.skill.name);
    return { success: true, type: 'prompt', input: text, output };
  } catch (err) {
    throw new Error(`LLM prompt failed: ${err.message}`);
  }
}

/**
 * Parse "write" step content into file path and content.
 * Format: <file> <content> (content starts after first space-separated filename)
 * Or: <file>\n<content> (multi-line)
 */
function splitFileAndContent(content) {
  const firstNewline = content.indexOf('\n');
  const firstSpace = content.indexOf(' ');

  let file, contentStr;

  if (firstNewline !== -1 && (firstSpace === -1 || firstNewline < firstSpace)) {
    // Multi-line format: first line is file, rest is content
    file = content.slice(0, firstNewline).trim();
    contentStr = content.slice(firstNewline + 1);
  } else if (firstSpace !== -1) {
    // Single-line format: file content
    file = content.slice(0, firstSpace).trim();
    contentStr = content.slice(firstSpace + 1);
  } else {
    // Just a filename — write empty content
    file = content.trim();
    contentStr = '';
  }

  return { file, content: contentStr };
}

module.exports = {
  ExecutionContext,
  executeSkill,
  executeStep,
};
