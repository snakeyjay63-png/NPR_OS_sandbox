// @addr 10.04.0.0 | fd00:npr:0004:000::0 — NPR Return Structure
// ═══════════════════════════════════════════════════
// Canonical NPR Return envelope.
// Every NPR-loop response shares this outer structure.
// Noise → Pattern → Return.
// ═══════════════════════════════════════════════════

const { nprRoute } = require('./npr');

// ─── Helpers ───

// @addr 10.04.0.1 | fd00:npr:0004:000::1 — hex from int
function toHex(n) {
  if (typeof n !== 'number') return '0x0000';
  return '0x' + Math.abs(Math.floor(n)).toString(16).toUpperCase();
}

// @addr 10.04.0.2 | fd00:npr:0004:000::2 — simple checksum (first 4 hex chars)
function checksumHex(str) {
  let h = 0x0000;
  for (let i = 0; i < Math.min(str.length, 64); i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return '0x' + (h & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

// ─── Canonical Return ───

// @addr 10.04.1.0 | fd00:npr:0004:001::0 — create canonical return
function createReturn({ noise, pattern, candidate, iterations, events = [] } = {}) {
  const route = noise?.route ?? nprRoute(noise?.input ?? '');

  return {
    schema_hex: '0x0100',

    ok: pattern?.valid ?? false,

    route: {
      gateway_port_hex: '0x1388',  // 5000
      llama_port_hex: '0x223D',    // 8765
      openclaw_port_hex: '0x4965', // 18789
      npr: route,
    },

    noise: {
      session_id: noise?.session_id ?? 'unknown',
      input_checksum_hex: checksumHex(noise?.input ?? ''),
      context_blocks: noise?.context_blocks ?? [],
    },

    pattern: pattern ?? { sutra_hex: '0x0107', valid: false },

    return: {
      content: pattern?.valid ? candidate : null,
      iterations_hex: toHex(iterations ?? 0),
      halt_reason: pattern?.valid ? 'VALID_RETURN' : 'VALIDATION_FAILED',
      events: events,
    },
  };
}

// ─── Failed Return (iteration limit, hard error) ───

// @addr 10.04.1.1 | fd00:npr:0004:001::1 — create failed return
function createFailedReturn({ cycles, reason = 'ITERATION_LIMIT', noise } = {}) {
  return {
    schema_hex: '0x0100',
    ok: false,

    route: {
      gateway_port_hex: '0x1388',
      llama_port_hex: '0x223D',
      openclaw_port_hex: '0x4965',
      npr: noise?.route ?? null,
    },

    noise: {
      session_id: noise?.session_id ?? 'unknown',
      input_checksum_hex: checksumHex(noise?.input ?? ''),
      context_blocks: noise?.context_blocks ?? [],
    },

    pattern: {
      sutra_hex: '0x0107',
      valid: false,
      cycles: cycles?.map(c => ({
        iteration_hex: c.iteration_hex,
        pratyaksha: c.pattern?.pratyaksha,
        anumana: c.pattern?.anumana,
        agama: c.pattern?.agama,
      })),
    },

    return: {
      content: null,
      iterations_hex: toHex(cycles?.length ?? 0),
      halt_reason: reason,
      events: [],
    },
  };
}

// ─── Lightweight Return (for non-NPR routes that need envelope) ───

// @addr 10.04.1.2 | fd00:npr:0004:001::2 — envelope without full NPR cycle
function envelope(content, { route, sessionId } = {}) {
  return {
    schema_hex: '0x0100',
    ok: true,
    route: route ?? null,
    noise: {
      session_id: sessionId ?? 'ad-hoc',
      input_checksum_hex: '0x0000',
      context_blocks: [],
    },
    pattern: { sutra_hex: '0x0107', valid: true },
    return: {
      content,
      iterations_hex: '0x0001',
      halt_reason: 'DIRECT',
      events: [],
    },
  };
}

module.exports = {
  createReturn,
  createFailedReturn,
  envelope,
  toHex,
  checksumHex,
};
