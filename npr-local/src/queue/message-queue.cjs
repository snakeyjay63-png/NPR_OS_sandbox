// @net 10.06.0.0/24
// ═══════════════════════════════════════════════
// queue/message-queue.cjs — FIFO Message Queue
// ═══════════════════════════════════════════════
//
// Berichten netje achter elkaar. Wachten op doorvoer.
// Geen race conditions, geen verloren data.
//
// ═══════════════════════════════════════════════

const EventEmitter = require('events');

class MessageQueue extends EventEmitter {
  /**
   * @param {Object} options
   * @param {number} options.maxSize - max items in queue (0 = unlimited)
   * @param {number} options.processTimeoutMs - timeout per item
   * @param {string} options.name - queue name for logging
   */
  constructor(options = {}) {
    super();
    this.name = options.name || 'default';
    this.maxSize = options.maxSize || 0;
    this.processTimeoutMs = options.processTimeoutMs || 60000;
    
    this.queue = [];
    this.processing = false;
    this.paused = false;
    this.processors = [];
    this.stats = {
      enqueued: 0,
      processed: 0,
      failed: 0,
      dropped: 0,
    };
  }

  // ─── Enqueue ───

  /**
   * Add message to back of queue
   * @param {Object} item
   * @returns {Object} queued item with metadata
   */
  enqueue(item) {
    if (this.maxSize > 0 && this.queue.length >= this.maxSize) {
      this.stats.dropped++;
      this.emit('dropped', { item, queueLength: this.queue.length });
      return { error: 'queue full', dropped: true };
    }

    const queued = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      item,
      status: 'queued',
      enqueuedAt: Date.now(),
      processedAt: null,
    };

    this.queue.push(queued);
    const position = this.queue.length; // position = index in queue
    this.stats.enqueued++;
    this.emit('enqueued', { item: queued, queueLength: this.queue.length });

    // Auto-start processing if not already running
    if (!this.processing && !this.paused) {
      setImmediate(() => this.processNext());
    }

    return { ...queued, position };
  }

  // ─── Process ───

  /**
   * Process next item in queue
   * @private
   */
  async processNext() {
    if (this.processing || this.paused || this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const item = this.queue[0]; // peek

    if (!item) {
      this.processing = false;
      return;
    }

    // Wait until this item is at the front
    if (this.queue[0].id !== item.id) {
      this.processing = false;
      return;
    }

    // Dequeue
    this.queue.shift();
    item.status = 'processing';
    this.emit('processing', { item });

    try {
      let result;
      const timeout = new Promise((_, rej) => {
        setTimeout(() => rej(new Error(`timeout after ${this.processTimeoutMs}ms`)), this.processTimeoutMs);
      });

      // Try each processor in order
      for (const processor of this.processors) {
        const acceptPromise = Promise.resolve(processor.accept(item.item));
        const accept = await acceptPromise;
        if (accept) {
          const handlePromise = processor.handle(item.item);
          result = await Promise.race([handlePromise, timeout]);
          break;
        }
      }

      if (!result) {
        // No processor accepted — use default passthrough
        result = { ...item.item, status: 'passthrough' };
      }

      item.status = 'processed';
      item.processedAt = Date.now();
      item.result = result;
      this.stats.processed++;
      this.emit('processed', { item });

    } catch (err) {
      item.status = 'failed';
      item.error = err.message;
      item.processedAt = Date.now();
      this.stats.failed++;
      this.emit('failed', { item, error: err.message });
    }

    this.processing = false;
    // Process next immediately
    setImmediate(() => this.processNext());
  }

  // ─── Processors ───

  /**
   * Register a processor
   * @param {Function} accept - returns boolean/string (truthy = accepts this item)
   * @param {Function} handle - async function that processes the item
   */
  registerProcessor(accept, handle) {
    this.processors.push({ accept, handle });
    return this;
  }

  // ─── Control ───

  pause() {
    this.paused = true;
    this.emit('paused');
    return this;
  }

  resume() {
    this.paused = false;
    this.emit('resumed');
    if (this.queue.length > 0 && !this.processing) {
      setImmediate(() => this.processNext());
    }
    return this;
  }

  // ─── Query ───

  getStatus() {
    return {
      name: this.name,
      length: this.queue.length,
      maxSize: this.maxSize,
      processing: this.processing,
      paused: this.paused,
      processors: this.processors.length,
      stats: this.stats,
    };
  }

  getItems() {
    return this.queue.map(item => ({
      id: item.id,
      status: item.status,
      enqueuedAt: item.enqueuedAt,
      processedAt: item.processedAt,
      item: item.item,
      error: item.error,
    }));
  }

  clear() {
    const cleared = this.queue.length;
    this.queue = [];
    this.emit('cleared', { count: cleared });
    return cleared;
  }
}

// ─── Singleton ───

let instance = null;

function getQueue(options = {}) {
  if (!instance) {
    instance = new MessageQueue(options);
  }
  return instance;
}

// ─── Exports ───

module.exports = {
  MessageQueue,
  getQueue,
};
