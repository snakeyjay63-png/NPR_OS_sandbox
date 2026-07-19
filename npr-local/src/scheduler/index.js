/**
 * index.js — Public API for the NPR-local scheduler.
 *
 * Exports:
 *   Scheduler        — Main scheduler class
 *   parseCron, nextRun — Cron parser utilities
 *   runJob           — Standalone job execution
 *   createPersistence — Persistence layer (for advanced usage)
 */

const { Scheduler } = require('./scheduler');
const { parseCron, nextRun } = require('./cron-parser');
const { runJob } = require('./job-runner');
const { createPersistence } = require('./persistence');

module.exports = {
  Scheduler,
  parseCron,
  nextRun,
  runJob,
  createPersistence,
};
