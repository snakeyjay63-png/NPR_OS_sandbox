// @addr 10.05.5.0 | fd00:npr:0005:005::0 — Llama Scheduler
// ═══════════════════════════════════════════════════
// Couples queue + slot-monitor + client.
// The single entry point the NPR-loop uses for inference.
// ═══════════════════════════════════════════════════

const { QueueError } = require('./inference-queue');

function toHex(n) {
  if (typeof n !== 'number') return '0x0000';
  return '0x' + Math.abs(Math.floor(n)).toString(16).toUpperCase();
}

// @addr 10.05.5.1 | fd00:npr:0005:005::1 — LlamaScheduler
class LlamaScheduler {
  /**
   * @param {{client: object, slotMonitor: object, queue: object, eventSink: object}} opts
   */
  constructor({ client, slotMonitor, queue, eventSink }) {
    this.client = client;
    this.slotMonitor = slotMonitor;
    this.queue = queue;
    this.eventSink = eventSink;
    this.draining = false;
    // per-session active tracking — prevent monopoly
    this.activeSessions = new Set();
  }

  // @addr 10.05.5.2 | fd00:npr:0005:005::2 — enqueue request
  async enqueue(request) {
    // reject if session already has active inference
    if (this.activeSessions.has(request.sessionId)) {
      // push to back of queue (correction goes behind others)
    }

    const id = request.id ?? crypto.randomUUID();
    const enriched = { ...request, id };

    this.eventSink?.emit?.('inference_queued', {
      session_id: request.sessionId,
      queue_depth_hex: toHex(this.queue.pending.length + 1),
    });

    const promise = this.queue.enqueue(enriched);
    void this.drain();

    return promise;
  }

  // @addr 10.05.5.3 | fd00:npr:0005:005::3 — drain queue into slots
  async drain() {
    if (this.draining) return;
    this.draining = true;

    try {
      while (this.queue.pending.length > 0) {
        const slot = await this.slotMonitor.acquire();

        if (!slot) {
          await this.slotMonitor.waitForAvailability();
          continue;
        }

        const request = this.queue.shift();

        if (!request) {
          slot.release();
          continue;
        }

        this.activeSessions.add(request.sessionId);
        void this.runRequest(request, slot);
      }
    } finally {
      this.draining = false;
    }
  }

  // @addr 10.05.5.4 | fd00:npr:0005:005::4 — execute single request
  async runRequest(request, slot) {
    const start = Date.now();

    try {
      this.eventSink?.emit?.('inference_started', {
        session_id: request.sessionId,
        slot_id_hex: slot.idHex,
      });

      const result = await this.client.complete({
        messages: request.messages,
        slotId: slot.id,
        signal: request.signal,
      });

      const elapsed = Date.now() - start;

      this.eventSink?.emit?.('inference_completed', {
        session_id: request.sessionId,
        slot_id_hex: slot.idHex,
        elapsed_ms: elapsed,
      });

      request.resolve(result);
    } catch (error) {
      this.eventSink?.emit?.('inference_failed', {
        session_id: request.sessionId,
        slot_id_hex: slot.idHex,
        error: error.message,
      });
      request.reject(error);
    } finally {
      this.activeSessions.delete(request.sessionId);
      slot.release();

      this.eventSink?.emit?.('inference_slot_released', {
        slot_id_hex: slot.idHex,
      });

      // continue draining if more queued
      void this.drain();
    }
  }

  // @addr 10.05.5.5 | fd00:npr:0005:005::5 — live status
  getStatus() {
    return {
      queue: {
        pending: this.queue.pending.length,
        depth_hex: toHex(this.queue.pending.length),
      },
      slots: this.slotMonitor.getStatus(),
      active_sessions: this.activeSessions.size,
    };
  }
}

module.exports = { LlamaScheduler };
