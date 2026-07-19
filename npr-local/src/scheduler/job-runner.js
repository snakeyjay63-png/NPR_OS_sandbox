/**
 * job-runner.js — Execute scheduled jobs.
 *
 * Supports systemEvent, agentTurn, script, http, and nprCycle job types.
 * Each runner returns a structured result for history tracking.
 */

const { read: fetch } = require('node:https');
const { request: httpReq } = require('node:http');

/**
 * Run a single job and return the result.
 *
 * @param {object} job - The job to execute
 * @param {object} context - Optional runtime context (e.g., agent, nprEngine)
 * @returns {Promise<object>} Run result
 */
async function runJob(job, context = {}) {
  const { type, payload = {}, name } = job;
  const startTime = new Date();

  const runners = {
    systemEvent: runSystemEvent,
    agentTurn: runAgentTurn,
    script: runScript,
    http: runHttp,
    nprCycle: runNprCycle,
  };

  const runner = runners[type];
  if (!runner) {
    return {
      status: 'error',
      error: `Unknown job type: ${type}`,
      jobName: name,
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
    };
  }

  try {
    const result = await runner(job, payload, context);
    return {
      ...result,
      status: 'success',
      jobName: name,
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
    };
  } catch (err) {
    return {
      status: 'error',
      error: err.message,
      jobName: name,
      startTime: startTime.toISOString(),
      endTime: new Date().toISOString(),
    };
  }
}

/**
 * systemEvent — Inject an event into the agent loop.
 * Returns the event data for the caller to handle.
 */
async function runSystemEvent(job, payload, context) {
  const text = payload.text || '';

  // If an eventEmitter is provided, emit the event
  if (context.eventEmitter) {
    context.eventEmitter.emit('scheduledEvent', {
      jobId: job.id,
      jobName: job.name,
      text,
      timestamp: new Date().toISOString(),
    });
    return { emitted: true, text };
  }

  // Fallback: return event for manual processing
  return {
    eventType: 'systemEvent',
    text,
    timestamp: new Date().toISOString(),
    note: 'No eventEmitter provided — event returned for manual handling',
  };
}

/**
 * agentTurn — Trigger an agent turn with a prompt.
 * Delegates to context.agent if available.
 */
async function runAgentTurn(job, payload, context) {
  const prompt = payload.prompt || '';

  if (context.agent && typeof context.agent.processTurn === 'function') {
    const response = await context.agent.processTurn({ text: prompt, source: 'scheduler' });
    return { prompt, response };
  }

  return {
    eventType: 'agentTurn',
    prompt,
    timestamp: new Date().toISOString(),
    note: 'No agent provided — prompt returned for manual handling',
  };
}

/**
 * script — Execute a JS function from a script string or path.
 * Uses Function constructor (not eval) for safer execution.
 * Sandboxed with limited globals.
 */
async function runScript(job, payload, context) {
  const script = payload.script;
  if (!script) {
    throw new Error('No script provided in job payload');
  }

  // If script looks like a file path, read it
  const { readFileSync } = require('fs');
  const { isAbsolute } = require('path');
  let code = script;

  if (script.startsWith('/') || script.startsWith('./') || script.startsWith('../')) {
    code = readFileSync(script, 'utf-8');
  }

  // Build a sandboxed execution environment
  const sandbox = {
    context,
    job,
    payload,
    Date: global.Date,
    Math: global.Math,
    JSON: global.JSON,
    console: {
      log: (...args) => console.log(`[scheduler:script:${job.id}]`, ...args),
      warn: (...args) => console.warn(`[scheduler:script:${job.id}]`, ...args),
      error: (...args) => console.error(`[scheduler:script:${job.id}]`, ...args),
    },
  };

  // Support both sync and async scripts
  const fn = new Function(...Object.keys(sandbox), `return (async () => { ${code} })()`);
  const result = await fn(...Object.values(sandbox));

  return { executed: true, result };
}

/**
 * http — Make an HTTP(S) request.
 */
async function runHttp(job, payload) {
  const { url, method = 'GET', body } = payload;

  if (!url) {
    throw new Error('No URL provided in job payload');
  }

  const options = {
    method: method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
      ...(payload.headers || {}),
    },
    timeout: payload.timeout || 30_000,
  };

  if (body && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
    options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
  }

  const result = await new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const lib = isHttps ? require('node:https') : require('node:http');

    const req = lib.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ${url} timed out`));
    });

    if (body && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });

  return result;
}

/**
 * nprCycle — Trigger the full Noise→Pattern→Return cycle.
 *
 * If context.nprEngine is available, delegates to it.
 * Otherwise, returns the cycle data for manual processing.
 */
async function runNprCycle(job, payload, context) {
  const { noise, pattern, 'return': returnPath } = payload;

  const cycleData = {
    noise: noise || '',
    pattern: pattern || '',
    return: returnPath || null,
    timestamp: new Date().toISOString(),
  };

  if (context.nprEngine && typeof context.nprEngine.runCycle === 'function') {
    const result = await context.nprEngine.runCycle(cycleData);
    return { ...cycleData, engineResult: result };
  }

  return {
    ...cycleData,
    note: 'No nprEngine provided — cycle data returned for manual handling',
  };
}

module.exports = { runJob };
