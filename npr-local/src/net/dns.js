// @net 10.00.1.0/24
// dns.js — NPR DNS: naam → adres → port
//
// Elke naam = een slot = een IP = een port = een functie
// DNS = het adresboek van NPR-netwerk

const crypto = require('crypto');

const BASE_PORT = 5000;

// ─── Naam → Slot ───

function nameToSlot(name) {
  const hash = crypto.createHash('md5').update(name.toLowerCase()).digest();
  return hash.readUInt32BE(0) % 64;
}

// ─── Slot → IP ───

function slotToIP(slot) {
  const dr = (slot % 9) || 9; // digital root 1-9
  return `10.${String(dr).padStart(2, '0')}.0.${String(slot).padStart(2, '0')}`;
}

// ─── Slot → Port ───

function slotToPort(slot) {
  return BASE_PORT + slot;
}

// ─── Resolve: naam → { name, slot, ip, port, url } ───

function resolve(name) {
  const slot = nameToSlot(name);
  const ip = slotToIP(slot);
  const port = slotToPort(slot);
  return {
    name,
    slot,
    ip,
    port,
    url: `http://127.0.0.1:${port}`,
    path: `/tool/${name}`,
  };
}

// ─── Reverse: slot → naam (als registry bekend) ───

const SLOT_TO_NAME = new Map();

function register(name) {
  const entry = resolve(name);
  SLOT_TO_NAME.set(entry.slot, entry);
  return entry;
}

function reverse(slot) {
  return SLOT_TO_NAME.get(slot) || null;
}

// ─── Alle bekende namen ───

function list() {
  return Array.from(SLOT_TO_NAME.values()).sort((a, b) => a.slot - b.slot);
}

// ─── Naam genereren voor slot ───

function suggestName(slot, base) {
  const ipv4 = slotToIP(slot);
  return `${base}-${ipv4.replace(/\./g, '_')}`;
}

module.exports = {
  nameToSlot,
  slotToIP,
  slotToPort,
  resolve,
  register,
  reverse,
  list,
  suggestName,
  SLOT_TO_NAME,
};
