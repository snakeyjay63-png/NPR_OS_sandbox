// @net 10.02.3.0/24
// ─────────────────────────────────────────────────
// events/addresses.js — Block Address Utilities
// ──────────────────────────────────────────────
//
// Utilities for 10.x.y.z block addresses.
// Bridges evdev signals → NPR block addresses.

// ─── Digital root ─────────────────────────────

export function digitalRoot(n) {
  n = Math.abs(Math.floor(n) || 0);
  if (n === 0) return 0;
  return ((n - 1) % 9) + 1;
}

// ─── Signal → address ─────────────────────────

export function signalToAddress(type, code, value) {
  const x = digitalRoot(type + 1);
  const y = digitalRoot(code + 1);
  const z = digitalRoot(Math.abs(value) + 1);
  return `10.${String(x).padStart(2, "0")}.${String(y).padStart(2, "0")}.${String(z).padStart(2, "0")}`;
}

// ─── Address → NPR route ──────────────────────

export function addressToNPRRoute(address) {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const [_, x, y, z] = parts;
  return `npr://${x.padStart(4, "0")}/${y.padStart(4, "0")}/${z.padStart(4, "0")}`;
}

// ─── Address → 6-bit slot ─────────────────────

export function addressToSlot(address) {
  const dr = digitalRoot(
    parseInt(address.split(".")[1] + address.split(".")[2] + address.split(".")[3], 10)
  );
  return (dr * 0x07) % 0x40;
}

// ─── 6-bit encode ─────────────────────────────

export function encode6Bit(slot) {
  return slot.toString(2).padStart(6, "0");
}
