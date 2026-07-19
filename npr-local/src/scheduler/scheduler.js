/**
 * scheduler.js — Main Scheduler class for NPR-local.
 *
 * Pure Node.js cron job scheduler supporting:
 * - systemEvent, agentTurn, script, http, nprCycle job types
 * - at (one-shot), every (interval ms), cron (expression) scheduling
 * - Persistence to JSON
 * - Run history tracking
 * - TTL-based auto-deletion
 *
 * Usage:
 *   const { Scheduler } = require('./scheduler');
 *   const sched = new Scheduler();
 *   sched.add({ name: 'Daily scan', schedule: { type: 'cron', value: '0 6 * * *' }, type: 'systemEvent', payload: { text: 'Run daily scan' } });
 *   sched.start();
 */

const EventEmitter = require('events');
const { parseCron, nextRun } = require('./cron-parser');
const { runJob } = require('./job-runner');
const { createPersistence } = require('./persistence');

/** Generate a unique job ID. */
function uid() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

class Scheduler extends EventEmitter {
  /**
   * @param {object} options
   * @param {string} [options.dataDir] - Directory for persistence file
   * @param {object} [options.context] - Runtime context (agent, nprEngine, eventEmitter)
   * @param {number} [options.tickMs=5000] - How often to check for due jobs
   */
  constructor(options = {}) {
    super();

    this._tickMs = options.tickMs || 5000;
    this._context = options.context || {};
    this._timer = null;
    this._running = false;
    this._jobs = new Map();

    // If an external eventEmitter is provided, forward events to it
    this._externalEmitter = options.context?.eventEmitter || null;

    // Persistence layer
    this._persist = createPersistence(options.dataDir);
    this._persist.load();

    // Restore persisted jobs
    for (const job of this._persist.listJobs()) {
      this._jobs.set(job.id, job);
    }

    this._log('restored', this._jobs.size, 'job(s)');
  }

  /**
   * Add a new scheduled job.
   *
   * @param {object} jobDef - Job definition (id is auto-generated if omitted)
   * @returns {string} The job ID
   */
  add(jobDef) {
    const id = jobDef.id || uid();

    if (this._jobs.has(id)) {
      throw new Error(`Job with id "${id}" already exists`);
    }

    const job = {
      id,
      name: jobDef.name || `untitled-${id.slice(0, 8)}`,
      schedule: {
        type: jobDef.schedule?.type || 'every',
        value: jobDef.schedule?.value,
      },
      type: jobDef.type || 'systemEvent',
      payload: { ...(jobDef.payload || {}) },
      enabled: jobDef.enabled !== false,
      lastRun: null,
      nextRun: null,
      runCount: 0,
      maxRuns: jobDef.maxRuns || null,
      ttl: jobDef.ttl || null,
      createdAt: new Date(),
      expiresAt: null,
    };

    if (job.ttl !== null) {
      job.expiresAt = new Date(job.createdAt.getTime() + job.ttl);
    }

    job.nextRun = this._computeNextRun(job);
    this._jobs.set(id, job);
    this._persist.setJob(id, job);
    this._log('added', job.name, `(${id})`);
    return id;
  }

  /**
   * Get a job by ID.
   * @param {string} jobId
   * @returns {object|null}
   */
  get(jobId) {
    return this._jobs.get(jobId) || null;
  }

  /**
   * List all jobs.
   * @returns {object[]}
   */
  list() {
    return [...this._jobs.values()];
  }

  /**
   * Remove a job.
   * @param {string} jobId
   * @returns {boolean}
   */
  remove(jobId) {
    const job = this._jobs.get(jobId);
    if (!job) return false;

    this._jobs.delete(jobId);
    this._persist.removeJob(jobId);
    this._log('removed', job.name);
    return true;
  }

  /**
   * Enable a job.
   * @param {string} jobId
   */
  enable(jobId) {
    const job = this._jobs.get(jobId);
    if (!job) return;
    job.enabled = true;
    job.nextRun = this._computeNextRun(job);
    this._persist.setJob(jobId, job);
    this._log('enabled', job.name);
  }

  /**
   * Disable a job.
   * @param {string} jobId
   */
  disable(jobId) {
    const job = this._jobs.get(jobId);
    if (!job) return;
    job.enabled = false;
    this._persist.setJob(jobId, job);
    this._log('disabled', job.name);
  }

  /**
   * Run a job immediately (ignoring schedule).
   * @param {string} jobId
   * @returns {Promise<object>}
   */
  async run(jobId) {
    const job = this._jobs.get(jobId);
    if (!job) {
      throw new Error(`Job "${jobId}" not found`);
    }
    if (!job.enabled) {
      throw new Error(`Job "${jobId}" is disabled`);
    }

    return this._executeJob(job);
  }

  /**
   * Get run history for a job.
   * @param {string} jobId
   * @returns {object[]}
   */
  getHistory(jobId) {
    return this._persist.getHistory(jobId);
  }

  /**
   * Start the scheduler tick loop.
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._timer = setInterval(() => this._tick(), this._tickMs);
    this._log('started');
    this.emit('started');
  }

  /**
   * Stop the scheduler tick loop.
   */
  stop() {
    if (!this._running) return;
    this._running = false;
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    // Final persistence save
    for (const job of this._jobs.values()) {
      this._persist.setJob(job.id, job);
    }
    this._log('stopped');
    this.emit('stopped');
  }

  // ── Internal Methods ──

  /** Check all jobs for due executions. */
  _tick() {
    const now = new Date();

    for (const job of this._jobs.values()) {
      // Skip disabled jobs
      if (!job.enabled) continue;

      // Check TTL expiry
      if (job.expiresAt && now > job.expiresAt) {
        this._log('expired', job.name);
        this.emit('expired', { jobId: job.id, jobName: job.name });
        this.remove(job.id);
        continue;
      }

      // Check if due
      if (job.nextRun && now >= job.nextRun) {
        this._executeJob(job).catch((err) => {
          this._log('tick error', err.message);
        });
      }
    }
  }

  /** Execute a job, update metadata, and record history. */
  async _executeJob(job) {
    // Check maxRuns
    if (job.maxRuns !== null && job.runCount >= job.maxRuns) {
      this._log('max runs reached', job.name);
      this.emit('maxRunsReached', { jobId: job.id, jobName: job.name });
      this.disable(job.id);
      return { status: 'skipped', reason: 'maxRuns reached' };
    }

    this._log('running', job.name, `(#${job.runCount + 1})`);
    this.emit('beforeRun', { jobId: job.id, jobName: job.name });

    const result = await runJob(job, this._context);

    // Update job metadata
    job.lastRun = new Date();
    job.runCount += 1;
    job.nextRun = this._computeNextRun(job);
    this._persist.setJob(job.id, job);

    // Record history
    const record = {
      jobId: job.id,
      runNumber: job.runCount,
      timestamp: new Date().toISOString(),
      status: result.status,
      result: result.status === 'success' ? result : { error: result.error },
    };
    this._persist.addHistory(job.id, record);

    // Forward events to external emitter
    if (this._externalEmitter) {
      this._externalEmitter.emit('schedulerRun', record);
    }

    // If one-shot (type 'at'), auto-disable after running
    if (job.schedule.type === 'at' && job.maxRuns === null) {
      job.maxRuns = 0; // Force maxRunsReached on next tick
    }

    this.emit('afterRun', { jobId: job.id, jobName: job.name, result });
    return result;
  }

  /** Compute the next fire time for a job. */
  _computeNextRun(job) {
    const { type, value } = job.schedule;

    if (type === 'at') {
      if (typeof value === 'string') {
        const date = new Date(value);
        return date.getTime() > Date.now() ? date : null;
      }
      if (typeof value === 'number') {
        return value > Date.now() ? new Date(value) : null;
      }
      return null;
    }

    if (type === 'every') {
      const ms = typeof value === 'string' ? parseInt(value, 10) : value;
      if (Number.isNaN(ms) || ms <= 0) return null;
      // Schedule relative to lastRun or now
      const base = job.lastRun ? new Date(job.lastRun) : new Date();
      return new Date(base.getTime() + ms);
    }

    if (type === 'cron') {
      if (!value || typeof value !== 'string') return null;
      try {
        const parsed = parseCron(value);
        const base = job.lastRun ? new Date(job.lastRun) : new Date();
        const fire = nextRun(parsed, base, 1)[0];
        return fire || null;
      } catch (err) {
        console.error(`[scheduler] Invalid cron for "${job.name}": ${err.message}`);
        return null;
      }
    }

    return null;
  }

  /** Simple structured logger. */
  _log(...args) {
    console.log(`[scheduler]`, ...args);
  }
}

module.exports = { Scheduler };
