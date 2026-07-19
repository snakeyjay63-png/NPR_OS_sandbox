// @net 10.06.1.0/24
// ═══════════════════════════════════════════════
// routes/queue.js — Queue REST Endpoints
// ═══════════════════════════════════════════════
//
// GET    /queue/status     — queue status + stats
// GET    /queue/items      — list queued items
// POST   /queue/enqueue    — add message to queue
// POST   /queue/pause      — pause processing
// POST   /queue/resume     — resume processing
// POST   /queue/clear      — clear all items
// GET    /queue/items/:id  — get single item
// ═══════════════════════════════════════════════

const { getQueue } = require('../queue/message-queue.cjs');

const queue = getQueue({
  name: 'npr-main',
  maxSize: 1000,
  processTimeoutMs: 30000,
});

// ─── Queue Processors ───

// PLC parser processor
const { parseST } = require('../language-fields/plc/parser/st-parser.cjs');
const { plcStore } = require('./plc.cjs');

queue.registerProcessor(
  (item) => item.type === 'plc_parse',
  async (item) => {
    const result = parseST(item.code, {
      plcId: item.plcId || `PLC-${Date.now()}`,
      sourceFile: item.sourceFile,
      safetyRated: item.safetyRated || false,
    });
    
    // Store result
    plcStore.set(result.plcId, result);
    
    return {
      plcId: result.plcId,
      validation: result.validation,
      model: result.model,
    };
  }
);

// ─── GET /queue/status ───

function getStatus(req, res) {
  const status = queue.getStatus();
  res.json({
    success: true,
    queue: status,
    tickUs: Math.round((performance || {}).now() || Date.now()),
  });
}

// ─── GET /queue/items ───

function getItems(req, res) {
  const items = queue.getItems();
  const limit = parseInt((req.query || {}).limit) || 50;
  const offset = parseInt((req.query || {}).offset) || 0;

  res.json({
    success: true,
    total: items.length,
    items: items.slice(offset, offset + limit),
  });
}

// ─── GET /queue/items/:id ───

function getItem(req, res) {
  const id = (req.params && req.params.id) || null;
  if (!id) {
    return res.status(400).json({ error: 'missing id' });
  }

  const items = queue.getItems();
  const found = items.find(i => i.id === id);
  if (!found) {
    return res.status(404).json({ error: 'item not found' });
  }

  res.json({ success: true, item: found });
}

// ─── POST /queue/enqueue ───

function enqueue(req, res) {
  const body = req.body || {};
  const queued = queue.enqueue(body);

  if (queued.error) {
    return res.status(503).json({ error: queued.error, dropped: queued.dropped });
  }

  res.json({
    success: true,
    id: queued.id,
    status: queued.status,
    position: queue.queue.length, // position in queue after enqueue
    enqueuedAt: queued.enqueuedAt,
  });
}

// ─── POST /queue/pause ───

function pause(req, res) {
  queue.pause();
  res.json({ success: true, paused: true });
}

// ─── POST /queue/resume ───

function resume(req, res) {
  queue.resume();
  res.json({ success: true, paused: false });
}

// ─── POST /queue/clear ───

function clear(req, res) {
  const count = queue.clear();
  res.json({ success: true, cleared: count });
}

// ─── Exports ───

module.exports = {
  getStatus,
  getItems,
  getItem,
  enqueue,
  pause,
  resume,
  clear,
  queue,
};
