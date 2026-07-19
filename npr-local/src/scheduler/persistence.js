/**
 * persistence.js — Save/load scheduler jobs to JSON.
 *
 * Auto-saves on mutations, loads on startup.
 * Handles file corruption gracefully.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_DATA_DIR = path.join(__dirname, '..', '..', 'data');

/**
 * @param {string} dataDir - Directory for the scheduler.json file
 */
function createPersistence(dataDir = DEFAULT_DATA_DIR) {
  const filePath = path.join(dataDir, 'scheduler.json');

  let store = { jobs: new Map(), history: new Map() };

  /** Load stored data from disk. Returns empty store if file missing/corrupt. */
  function load() {
    try {
      if (!fs.existsSync(filePath)) {
        _save(); // Create fresh file
        return store;
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);

      // Restore jobs
      if (data.jobs && Array.isArray(data.jobs)) {
        for (const job of data.jobs) {
          store.jobs.set(job.id, _reviveJob(job));
        }
      }

      // Restore history (capped to avoid unbounded growth)
      if (data.history && typeof data.history === 'object') {
        for (const [id, runs] of Object.entries(data.history)) {
          if (Array.isArray(runs)) {
            store.history.set(id, runs.slice(-200)); // Keep last 200 runs
          }
        }
      }
    } catch (err) {
      // File corrupt or unreadable — start fresh
      console.warn('[scheduler:persistence] Load failed, starting fresh:', err.message);
      store = { jobs: new Map(), history: new Map() };
      _save();
    }

    return store;
  }

  /** Serialize and write store to disk atomically. */
  function _save() {
    try {
      fs.mkdirSync(dataDir, { recursive: true });

      const serializable = {
        version: 1,
        savedAt: new Date().toISOString(),
        jobs: [...store.jobs.values()],
        history: Object.fromEntries(
          [...store.history.entries()].map(([id, runs]) => [id, runs])
        ),
      };

      const tmp = filePath + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(serializable, null, 2), 'utf-8');
      fs.renameSync(tmp, filePath);
    } catch (err) {
      console.error('[scheduler:persistence] Save failed:', err.message);
    }
  }

  /** Restore Date objects from ISO strings. */
  function _reviveJob(job) {
    const revived = { ...job };
    if (revived.lastRun) revived.lastRun = new Date(revived.lastRun);
    if (revived.nextRun) revived.nextRun = new Date(revived.nextRun);
    if (revived.createdAt) revived.createdAt = new Date(revived.createdAt);
    if (revived.ttl !== null && revived.createdAt) {
      revived.expiresAt = new Date(revived.createdAt.getTime() + revived.ttl);
    }
    return revived;
  }

  return {
    load,
    save: _save,

    /** Upsert a job and persist. */
    setJob(id, job) {
      store.jobs.set(id, job);
      _save();
    },

    /** Get a job from the store. */
    getJob(id) {
      return store.jobs.get(id) || null;
    },

    /** Remove a job and its history. */
    removeJob(id) {
      store.jobs.delete(id);
      store.history.delete(id);
      _save();
    },

    /** List all jobs. */
    listJobs() {
      return [...store.jobs.values()];
    },

    /** Add a run record to history. */
    addHistory(jobId, record) {
      const runs = store.history.get(jobId) || [];
      runs.push(record);
      // Cap at 500 records per job
      if (runs.length > 500) {
        runs.splice(0, runs.length - 500);
      }
      store.history.set(jobId, runs);
      _save();
    },

    /** Get run history for a job. */
    getHistory(jobId) {
      return store.history.get(jobId) || [];
    },

    /** Clear history for a job. */
    clearHistory(jobId) {
      store.history.delete(jobId);
      _save();
    },
  };
}

module.exports = { createPersistence };
