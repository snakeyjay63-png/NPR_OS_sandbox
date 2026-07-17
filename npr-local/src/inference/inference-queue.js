// @addr 10.05.0.0 | fd00:npr:0005:000::0 — Inference Queue
// ═══════════════════════════════════════════════════
// FIFO request queue with per-item timeout.
// Blocks only the caller's promise; never the event loop.
// ═══════════════════════════════════════════════════

// @addr 10.05.0.1 | fd00:npr:0005:000::1 — QueueError
class QueueError extends Error {
  constructor(code, detail) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

// @addr 10.05.1.0 | fd00:npr:0005:001::0 — InferenceQueue
class InferenceQueue {
  /**
   * @param {{maxQueuedHex?: number, maxWaitMsHex?: number}} opts
   */
  constructor({
    maxQueuedHex = 0x40,       // 64
    maxWaitMsHex = 0x00007530, // 30000 ms
  } = {}) {
    this.pending = [];
    this.maxQueuedHex = maxQueuedHex;
    this.maxWaitMsHex = maxWaitMsHex;
  }

  // @addr 10.05.1.1 | fd00:npr:0005:001::1 — depth
  get depthHex() {
    return this.pending.length;
  }

  // @addr 10.05.1.2 | fd00:npr:0005:001::2 — enqueue (returns promise)
  enqueue(request) {
    if (this.pending.length >= this.maxQueuedHex) {
      throw new QueueError('QUEUE_FULL', {
        depth_hex: this.pending.length,
        limit_hex: this.maxQueuedHex,
      });
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.remove(request.id);
        reject(new QueueError('QUEUE_TIMEOUT', {
          wait_ms: this.maxWaitMsHex,
        }));
      }, this.maxWaitMsHex);

      this.pending.push({
        ...request,
        resolve,
        reject,
        timer,
        enqueuedAt: Date.now(),
      });
    });
  }

  // @addr 10.05.1.3 | fd00:npr:0005:001::3 — shift (FIFO pop)
  shift() {
    return this.pending.shift() ?? null;
  }

  // @addr 10.05.1.4 | fd00:npr:0005:001::4 — remove by id
  remove(id) {
    const index = this.pending.findIndex(item => item.id === id);
    if (index >= 0) {
      clearTimeout(this.pending[index].timer);
      this.pending.splice(index, 1);
    }
  }

  // @addr 10.05.1.5 | fd00:npr:0005:001::5 — peek position for a session
  position(sessionId) {
    const index = this.pending.findIndex(item => item.sessionId === sessionId);
    return index >= 0 ? index + 1 : null;
  }
}

module.exports = { QueueError, InferenceQueue };
