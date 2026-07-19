/**
 * NPR Skill System — Entry point.
 *
 * Self-contained procedure artifacts following NPR cycle semantics:
 * Noise (input) → Pattern (procedure) → Return (output)
 *
 * Exports:
 *   - SkillRegistry: Discover, validate, search, execute skills
 *   - parseSkill, validateSkill: Parse individual SKILL.md files
 *   - ExecutionContext, executeSkill: Execute procedures
 */

'use strict';

const { SkillRegistry } = require('./registry');
const {
  parseSkill,
  validateSkill,
  extractFrontmatter,
  extractSection,
  parseParamTable,
  parseProcedure,
  parseStepLine,
  parseExamples,
} = require('./parser');
const {
  ExecutionContext,
  executeSkill,
  executeStep,
} = require('./executor');

module.exports = {
  // Registry
  SkillRegistry,

  // Parser
  parseSkill,
  validateSkill,
  extractFrontmatter,
  extractSection,
  parseParamTable,
  parseProcedure,
  parseStepLine,
  parseExamples,

  // Executor
  ExecutionContext,
  executeSkill,
  executeStep,
};
