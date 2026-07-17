// @net 10.02.0.0/24
// ─────────────────────────────────────────────────
// events/index.js — Events Layer Barrel
// ─────────────────────────────────────────────────

export { EventRegistry, resolveEventRoute } from "./registry.mjs";
export { EventDispatcher }                  from "./dispatcher.mjs";
export { EVENT_SCHEMA, validateEvent }      from "./schema.mjs";
export *                                    from "./addresses.mjs";
