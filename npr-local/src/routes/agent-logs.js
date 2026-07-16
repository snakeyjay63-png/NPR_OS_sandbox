// @net 10.07.0.0/24
// routes/agent-logs.js — Agent event log tail
// Equivalent: openclaw logs

const MAX_LOG_ENTRIES = 500;

// In-memory log buffer (circular)
const logBuffer = [];

/**
 * Write an event to the log buffer.
 * @param {string} level - 'info', 'warn', 'error', 'event'
 * @param {string} source - component name
 * @param {string} message
 * @param {object} [meta] - optional metadata
 */
function log(level, source, message, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    tsUs: Number(process.hrtime.bigint()),
    level,
    source,
    message,
    ...meta,
  };
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }
}

/**
 * GET /agent/logs?limit=50&level=info&source=agent
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {object} ctx
 */
function handler(req, res, ctx = {}) {
  const url = ctx.url || new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const params = new URLSearchParams(url.search);

  let entries = [...logBuffer];

  // Filter by level
  const level = params.get('level');
  if (level) {
    entries = entries.filter(e => e.level === level);
  }

  // Filter by source
  const source = params.get('source');
  if (source) {
    entries = entries.filter(e => e.source === source);
  }

  // Limit
  const limit = Math.min(parseInt(params.get('limit')) || 100, MAX_LOG_ENTRIES);
  entries = entries.slice(-limit);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    count: entries.length,
    buffer: MAX_LOG_ENTRIES,
    entries,
  }, null, 2));
}

/**
 * SSE stream for live logs.
 * GET /agent/logs/stream
 */
function streamHandler(req, res, ctx = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  // Send buffered entries first
  const url = ctx.url || new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const params = new URLSearchParams(url.search);
  const limit = Math.min(parseInt(params.get('limit')) || 50, MAX_LOG_ENTRIES);
  const recent = logBuffer.slice(-limit);
  for (const entry of recent) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }

  // Client disconnect detection
  let isClosed = false;
  req.on('close', () => { isClosed = true; });

  // Periodic check for new entries (simple polling)
  let lastIdx = logBuffer.length;
  const interval = setInterval(() => {
    if (isClosed) { clearInterval(interval); return; }
    const newEntries = logBuffer.slice(lastIdx);
    for (const entry of newEntries) {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    }
    lastIdx = logBuffer.length;
  }, 1000);

  req.on('close', () => clearInterval(interval));
}

module.exports = { log, handler, streamHandler, logBuffer };
