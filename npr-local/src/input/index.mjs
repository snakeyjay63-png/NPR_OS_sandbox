// @net 10.01.0.0/24
// ─────────────────────────────────────────────────
// input/index.mjs — Input Layer Barrel
// ─────────────────────────────────────────────────

export { decodeInputEvent, decodeBatch, evTypeLabel, EV, RECORD_SIZE } from "./reader.mjs";
export { normalizeEvent }            from "./normalize.mjs";
export { DeviceRegistry, DEFAULT_DEVICES } from "./devices.mjs";
export { EpollInputAdapter, createEpollAdapter } from "./epoll-adapter.mjs";
