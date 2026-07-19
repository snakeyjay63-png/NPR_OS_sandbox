/**
 * Skill Registry — Discover, validate, search, and execute skills.
 *
 * The registry is the Pattern layer of the NPR cycle:
 * it transforms a filesystem of SKILL.md files into a queryable,
 * executable skill set.
 *
 * Usage:
 *   const registry = new SkillRegistry('/path/to/skills');
 *   await registry.discover();
 *   const skill = registry.get('hello');
 *   const results = registry.find('greeting');
 *   const output = await registry.execute('hello', { name: 'Jelmer' });
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parseSkill, validateSkill } = require('./parser');
const { executeSkill } = require('./executor');

/**
 * @typedef {object} Skill
 * @property {string} name
 * @property {string} description
 * @property {string[]} whenToUse
 * @property {{noise: string, pattern: string, return: string}} nprCycle
 * @property {{name: string, type: string, required: boolean, description: string}[]} parameters
 * @property {{type: string, content: string}[]} procedure
 * @property {Array} examples
 * @property {string[]} assets
 * @property {string[]} examplesDir
 * @property {string} path
 * @property {string} directory
 */

class SkillRegistry {
  /**
   * @param {string} skillsDir — Root directory containing skill folders
   * @param {object} [options]
   * @param {boolean} [options.autoDiscover=false] — Discover on construction
   * @param {boolean} [options.continueOnError=false] — Continue execution past step failures
   * @param {number} [options.timeout=30000] — Default exec timeout ms
   * @param {function} [options.llmCallback=null] — Callback for prompt steps
   */
  constructor(skillsDir, options = {}) {
    this.skillsDir = path.resolve(skillsDir);
    this.skills = new Map();
    this.options = {
      autoDiscover: false,
      continueOnError: false,
      timeout: 30000,
      llmCallback: null,
      ...options,
    };

    if (options.autoDiscover) {
      this.discover();
    }
  }

  /**
   * Discover all skills in the skills directory.
   * Scans for SKILL.md files in immediate subdirectories.
   *
   * @returns {Promise<Array<Skill>>} Discovered skills
   */
  async discover() {
    const skills = [];

    if (!fs.existsSync(this.skillsDir)) {
      throw new Error(`Skills directory not found: ${this.skillsDir}`);
    }

    const entries = fs.readdirSync(this.skillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillPath = path.join(this.skillsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) continue;

      const skill = parseSkill(skillPath);
      if (!skill) continue;

      const validation = validateSkill(skill);
      if (validation.valid) {
        this.skills.set(skill.name, skill);
        skills.push(skill);
      } else {
        // Still register but flag with validation errors
        skill.validationErrors = validation.errors;
        this.skills.set(skill.name, skill);
        skills.push(skill);
      }
    }

    return skills;
  }

  /**
   * Get a skill by name.
   *
   * @param {string} name
   * @returns {Skill|null}
   */
  get(name) {
    return this.skills.get(name) || null;
  }

  /**
   * Find skills matching a query string.
   * Searches name, description, whenToUse, and nprCycle fields.
   *
   * @param {string} query — Search term (simple text match)
   * @param {number} [limit=5] — Max results
   * @returns {Array<Skill>}
   */
  find(query, limit = 5) {
    const lower = query.toLowerCase();
    const results = [];

    for (const skill of this.skills.values()) {
      const haystack = [
        skill.name,
        skill.description,
        skill.whenToUse.join(' '),
        skill.nprCycle.noise,
        skill.nprCycle.pattern,
        skill.nprCycle.return,
        ...skill.parameters.map(p => `${p.name} ${p.description}`),
      ].join(' ').toLowerCase();

      if (haystack.includes(lower)) {
        results.push(skill);
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Validate a single skill file.
   *
   * @param {string} skillPath — Absolute path to a SKILL.md file
   * @returns {{valid: boolean, errors: string[], skill?: Skill}}
   */
  validate(skillPath) {
    const skill = parseSkill(skillPath);
    if (!skill) {
      return { valid: false, errors: ['Failed to parse skill file'] };
    }
    const result = validateSkill(skill);
    result.skill = skill;
    return result;
  }

  /**
   * Validate all registered skills.
   *
   * @returns {{total: number, valid: number, invalid: number, details: Array}}
   */
  validateAll() {
    const details = [];
    let validCount = 0;
    let invalidCount = 0;

    for (const [name, skill] of this.skills) {
      const validation = validateSkill(skill);
      details.push({ name, valid: validation.valid, errors: validation.errors });
      if (validation.valid) {
        validCount++;
      } else {
        invalidCount++;
      }
    }

    return {
      total: this.skills.size,
      valid: validCount,
      invalid: invalidCount,
      details,
    };
  }

  /**
   * Execute a skill by name with parameters.
   *
   * @param {string} name — Skill name
   * @param {object} [params={}] — Input parameters
   * @param {object} [overrides={}] — Execution overrides
   * @returns {Promise<object>} Execution result
   */
  async execute(name, params = {}, overrides = {}) {
    const skill = this.get(name);
    if (!skill) {
      throw new Error(`Skill not found: ${name}`);
    }

    const execOptions = {
      workdir: skill.directory,
      timeout: overrides.timeout || this.options.timeout,
      continueOnError: overrides.continueOnError ?? this.options.continueOnError,
      llmCallback: overrides.llmCallback || this.options.llmCallback,
    };

    return executeSkill(skill, params, execOptions);
  }

  /**
   * List all registered skill names.
   *
   * @returns {string[]}
   */
  list() {
    return Array.from(this.skills.keys());
  }

  /**
   * Get summary of all skills (for debugging / inspection).
   *
   * @returns {Array<object>}
   */
  summary() {
    return Array.from(this.skills.values()).map(skill => ({
      name: skill.name,
      description: skill.description,
      parameters: skill.parameters.length,
      steps: skill.procedure.length,
      assets: skill.assets.length,
      valid: !skill.validationErrors,
      path: skill.path,
    }));
  }

  /**
   * Register a skill programmatically (without filesystem).
   *
   * @param {Skill} skill
   */
  register(skill) {
    const validation = validateSkill(skill);
    if (!validation.valid) {
      skill.validationErrors = validation.errors;
    }
    this.skills.set(skill.name, skill);
  }

  /**
   * Remove a skill by name.
   *
   * @param {string} name
   * @returns {boolean} True if removed
   */
  unregister(name) {
    return this.skills.delete(name);
  }
}

module.exports = {
  SkillRegistry,
};
