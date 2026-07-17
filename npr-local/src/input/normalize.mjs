// @net 10.01.1.0/24
// ─────────────────────────────────────────────────
// input/normalize.js — Raw → Normalized Event
// ─────────────────────────────────────────────────
//
// Transforms raw device input into canonical Local Hub events.
// Output is testable, storable, replayable.

import { validateEvent } from "../events/schema.mjs";

export function normalizeEvent(device, input) {
  const event = {
    id:        crypto.randomUUID(),
    timestamp: process.hrtime.bigint().toString(),

    source: {
      deviceId:  device.id,
      transport: device.transport ?? "evdev",
      path:      device.path ?? "unknown",
    },

    signal: {
      type:  input.type,
      code:  input.code,
      value: input.value,
    },

    state: "received",
  };

  const errors = validateEvent(event);
  if (errors.length > 0) {
    throw new Error(`Normalized event invalid: ${errors.join("; ")}`);
  }

  return event;
}
