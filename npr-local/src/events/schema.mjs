// @net 10.02.0.0/24
// ─────────────────────────────────────────────────
// events/schema.js — Normalized Event Schema
// ─────────────────────────────────────────────────
//
// Defines the canonical Local Hub event shape.
// Every device event is normalized to this format.

// ─── Canonical shape ────────────────────────────

export const EVENT_SCHEMA = {
  id:         { type: "string",  uuid: true },
  timestamp:  { type: "string",  hrtime: true },
  source:     {
    deviceId:  { type: "string" },
    transport: { type: "string", enum: ["evdev", "hid", "usb", "bluetooth", "tty", "udp", "tcp", "http"] },
    path:      { type: "string" },
  },
  signal:     {
    type:  { type: "integer", min: 0 },
    code:  { type: "integer", min: 0 },
    value: { type: "integer" },
  },
  state:      { type: "string", enum: ["received", "routed", "executed", "error"] },
  block:      { type: "string", optional: true },
  action:     { type: "string", optional: true },
  error:      { type: "string", optional: true },
};

// ─── Validate ───────────────────────────────────

export function validateEvent(event) {
  const errors = [];

  if (!event.id || !/^[0-9a-f]{8}-/.test(event.id)) {
    errors.push("id: valid UUID required");
  }
  if (!event.timestamp || typeof event.timestamp !== "string") {
    errors.push("timestamp: string (hrtime bigint) required");
  }
  if (!event.source?.deviceId) {
    errors.push("source.deviceId: required");
  }
  if (!EVENT_SCHEMA.source.transport.enum.includes(event.source?.transport)) {
    errors.push(`source.transport: must be one of ${EVENT_SCHEMA.source.transport.enum.join(", ")}`);
  }
  if (typeof event.signal?.type  !== "number") errors.push("signal.type: integer required");
  if (typeof event.signal?.code  !== "number") errors.push("signal.code: integer required");
  if (typeof event.signal?.value !== "number") errors.push("signal.value: integer required");

  return errors;
}
