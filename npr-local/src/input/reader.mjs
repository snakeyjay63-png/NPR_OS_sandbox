// @net 10.01.0.0/24
// ─────────────────────────────────────────────────
// input/reader.js — Raw Input Event Decoder
// ─────────────────────────────────────────────────
//
// Decodes linux input-event (24 bytes) from Buffer.
// Does NOT start tools. Only produces parsed events.
//
// Layout (little-endian):
//   [0..7]   seconds   (int64)
//   [8..15]  microseconds (int64)
//   [16..17] type      (uint16)
//   [18..19] code      (uint16)
//   [20..23] value     (int32)

const EV = {
  EV_KEY:      0x01,
  EV_REL:      0x02,
  EV_ABS:      0x03,
  EV_MSC:      0x04,
  EV_SW:       0x05,
  EV_LED:      0x11,
  EV_SND:      0x12,
  EV_REP:      0x14,
  EV_FF:       0x15,
  EV_PWR:      0x16,
  EV_SYN:      0x00,
};

const RECORD_SIZE = 24;

// ─── Decode ─────────────────────────────────────

export function decodeInputEvent(buffer, offset = 0) {
  return {
    seconds:     Number(buffer.readBigInt64LE(offset)),
    microseconds: Number(buffer.readBigInt64LE(offset + 8)),
    type:        buffer.readUInt16LE(offset + 16),
    code:        buffer.readUInt16LE(offset + 18),
    value:       buffer.readInt32LE(offset + 20),
  };
}

// ─── Type label ─────────────────────────────────

export function evTypeLabel(type) {
  return Object.entries(EV).find(([, v]) => v === type)?.[0] ?? `0x${type.toString(16)}`;
}

// ─── Batch decode ───────────────────────────────

export function decodeBatch(buffer) {
  const count = Math.floor(buffer.length / RECORD_SIZE);
  const events = [];
  for (let i = 0; i < count; i++) {
    events.push(decodeInputEvent(buffer, i * RECORD_SIZE));
  }
  return events;
}

export { EV, RECORD_SIZE };
