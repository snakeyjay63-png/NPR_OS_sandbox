// @net 10.05.0.0/24
// ─────────────────────────────────────────────────
// audit/event-log.js — Event Audit Logger
// ─────────────────────────────────────────────────
//
// Records every event→action transition locally.
// Raw microsecond precision, no Math.round().

export class EventLog {
  constructor(options = {}) {
    this.records  = [];
    this.maxSize  = options.maxSize ?? 10_000;
    this.filepath = options.filepath ?? null;
  }

  // ─── Write ──────────────────────────────────

  write(record) {
    const entry = {
      timestamp: process.hrtime.bigint().toString(),
      ...record,
    };

    this.records.push(entry);
    if (this.records.length > this.maxSize) {
      this.records.shift();
    }

    return entry;
  }

  // ─── Query ──────────────────────────────────

  recent(count = 50) {
    return this.records.slice(-count);
  }

  findByDevice(deviceId) {
    return this.records.filter((r) => r.device === deviceId);
  }

  findByBlock(address) {
    return this.records.filter((r) => r.block === address);
  }

  findByResult(result) {
    return this.records.filter((r) => r.result === result);
  }

  errors() {
    return this.records.filter((r) => r.result === "error" || r.result === "no_route" || r.result === "denied");
  }

  // ─── Stats ──────────────────────────────────

  stats() {
    const total = this.records.length;
    const executed = this.records.filter((r) => r.result === "executed").length;
    const errors = this.records.filter((r) => r.result !== "executed" && r.result !== "accepted").length;
    const durations = this.records.map((r) => r.durationUs).filter(Number.isFinite);
    const avgUs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return { total, executed, errors, avgUs };
  }

  // ─── Clear ──────────────────────────────────

  clear() {
    this.records = [];
  }
}
