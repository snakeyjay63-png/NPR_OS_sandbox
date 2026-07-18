/**
 * tool-00.cjs — NPR Router (Tool-00)
 *
 * Stap 17: Centrale encoder-runtime + NPR-reductiepijp.
 *
 * Canonieke encoders per invoertype:
 *   hex_encode_text(x)       := UTF8(NFC(x)) → hex
 *   hex_encode_token(x, ver) := token_id → fixed-width hex
 *   hex_encode_integer(x)    := canonical_unsigned_hex(x)
 *   hex_encode_ipv6(x)       := expanded_8x4_hex(x)
 *   hex_encode_git_hash(x)   := lowercase_hex(x)
 *
 * NPR-reductie:
 *   npr_reduce(x) := npr_mod9( hex_digit_value( dr_hex( hex_encode(x) ) ) )
 *
 * Philosophy:
 *   De router reduceert signalen naar hun NPR-wortel (1-9).
 *   Reductie ≠ interferentie (stap 18 combineert cycli).
 *   Stap 17 = observatie + reductie. Stap 18 = interferentie + routing.
 */

"use strict";

// ─── Canonieke Encoders ───

/**
 * hex_encode_text(x) — UTF-8 NFC → hex string
 * @param {string} x — invoer
 * @returns {string} hex representatie
 */
function hex_encode_text(x) {
  if (typeof x !== "string") {
    throw new TypeError("hex_encode_text expects string");
  }
  // NFC normalisatie
  const nfc = x.normalize("NFC");
  // UTF-8 → hex
  const buf = Buffer.from(nfc, "utf8");
  return buf.toString("hex");
}

/**
 * hex_encode_token(x, ver) — token_id → fixed-width hex
 * @param {number} x — token id
 * @param {string} [ver="v1"] — tokenizer versie (voor toekomstige compat)
 * @returns {string} 8-char hex (v1 default)
 */
function hex_encode_token(x, ver = "v1") {
  if (typeof x !== "number" || x < 0) {
    throw new TypeError("hex_encode_token expects non-negative integer");
  }
  const width = ver === "v1" ? 8 : 8; // v1 = 32-bit fixed
  return x.toString(16).padStart(width, "0");
}

/**
 * hex_encode_integer(x) — canonical unsigned hex
 * @param {number} x — integer
 * @returns {string} lowercase hex zonder 0x prefix
 */
function hex_encode_integer(x) {
  if (!Number.isInteger(x) || x < 0) {
    throw new TypeError("hex_encode_integer expects non-negative integer");
  }
  return x.toString(16);
}

/**
 * hex_encode_ipv6(x) — expanded 8x4 hex
 * @param {string} x — IPv6 adres (kort of lang)
 * @returns {string} expanded 8-group hex (lowercase)
 */
function hex_encode_ipv6(x) {
  if (typeof x !== "string") {
    throw new TypeError("hex_encode_ipv6 expects string");
  }
  // Simpele expansie: split op ":" en pad elk deel naar 4 chars
  // (Volledige IPv6 expansie vereist :: expansie — vereenvoudigd hier)
  const parts = x.split(":").filter(Boolean);
  const padded = parts.map(p => p.padStart(4, "0"));
  // :: expansie: vul aan tot 8 groups
  while (padded.length < 8) {
    padded.splice(padded.length - 1, 0, "0000");
  }
  return padded.slice(0, 8).join(":");
}

/**
 * hex_encode_git_hash(x) — lowercase hex
 * @param {string} x — git hash
 * @returns {string} lowercase hex (kort of volledig)
 */
function hex_encode_git_hash(x) {
  if (typeof x !== "string") {
    throw new TypeError("hex_encode_git_hash expects string");
  }
  // Verwijder eventuele prefixen en lowercase
  return x.replace(/^[~^]*/, "").toLowerCase();
}

// ─── NPR Reductiepijp ───

/**
 * dr_hex(hex) — digitale wortel van hex string
 * Sommeer hex cijfers → digitale wortel
 * @param {string} hex — hex string
 * @returns {number} digitale wortel [1..9] of 0 als hex leeg
 */
function dr_hex(hex) {
  if (!hex || typeof hex !== "string") return 0;
  let sum = 0;
  for (const ch of hex.toLowerCase()) {
    const v = parseInt(ch, 16);
    if (!isNaN(v)) {
      sum += v;
    }
  }
  if (sum === 0) return 0;
  return ((sum - 1) % 9) + 1;
}

/**
 * npr_mod9(n) — NPR mod-9 (resultaat [1..9] of 0)
 * @param {number} n — integer
 * @returns {number} NPR waarde
 */
function npr_mod9(n) {
  n = Math.abs(parseInt(n) || 0);
  if (n === 0) return 0;
  return ((n - 1) % 9) + 1;
}

/**
 * hex_digit_value(hex) — som van hex cijferwaarden
 * @param {string} hex — hex string
 * @returns {number} som
 */
function hex_digit_value(hex) {
  let sum = 0;
  for (const ch of hex.toLowerCase()) {
    const v = parseInt(ch, 16);
    if (!isNaN(v)) {
      sum += v;
    }
  }
  return sum;
}

/**
 * npr_reduce(x, encoder) — volledige NPR-reductie
 * 
 * Pipe: x → hex_encode → dr_hex → hex_digit_value → npr_mod9
 * 
 * @param {*} x — input
 * @param {Function} [encoder=hex_encode_text] — encoder functie
 * @returns {{ hex: string, dr: number, npr: number, value: number }}
 */
function npr_reduce(x, encoder = hex_encode_text) {
  const hex = encoder(x);
  const dr = dr_hex(hex);
  const value = hex_digit_value(hex);
  const npr = npr_mod9(value);
  return { hex, dr, npr, value };
}

// ─── Input Type Detectie ───

/**
 * detect_input_type(x) — detecteert invoertype
 * @param {*} x — input
 * @returns {string} type identifier
 */
function detect_input_type(x) {
  if (typeof x === "number") return "integer";
  if (typeof x !== "string") return "unknown";
  
  // Git hash pattern (40 hex chars of shorter abbreviations)
  if (/^[0-9a-fA-F]{7,40}$/.test(x)) return "git_hash";
  
  // IPv6 pattern (simple detection)
  if (/:/.test(x) && /[0-9a-fA-F]/.test(x)) return "ipv6";
  
  // Token-like (pure number string)
  if (/^\d+$/.test(x)) return "integer";
  
  return "text";
}

/**
 * auto_reduce(x) — automatische encoder selectie + reductie
 * @param {*} x — input
 * @returns {{ type: string, result: object }}
 */
function auto_reduce(x) {
  let type = detect_input_type(x);
  let encoder;
  let input = x;
  
  switch (type) {
    case "integer":
      encoder = hex_encode_integer;
      if (typeof x === "string") {
        input = parseInt(x, 10);
      }
      break;
    case "ipv6":
      encoder = hex_encode_ipv6;
      break;
    case "git_hash":
      encoder = hex_encode_git_hash;
      break;
    default:
      encoder = hex_encode_text;
      type = "text";
  }
  
  return { type, result: npr_reduce(input, encoder) };
}

// ─── Tool-00 Interface ───

/**
 * validate — valideert input en retourneert NPR-analyse
 * @param {{ source: string, type: string }} params
 * @returns {object} validatie resultaat
 */
function validate(params) {
  const { source, type } = params || {};
  
  if (!source) {
    return { valid: false, error: "missing source" };
  }
  
  try {
    const detected = type || detect_input_type(source);
    let input = source;
    
    // Convert string numbers to actual numbers for integer encoder
    if (detected === "integer" && typeof source === "string") {
      input = parseInt(source, 10);
    }
    
    const result = npr_reduce(input, getEncoder(detected));
    
    return {
      valid: true,
      type: detected,
      npr: result.npr,
      digitalRoot: result.dr,
      hexLength: result.hex.length,
      hex: result.hex,
      phase: getPhase(result.npr),
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * route — routeert input naar NPR slot
 * @param {{ source: string, type: string }} params
 * @returns {object} route resultaat
 */
function route(params) {
  const analysis = validate(params);
  
  if (!analysis.valid) {
    return { routed: false, error: analysis.error };
  }
  
  const slot = (analysis.npr * 0x07) % 0x40;
  
  return {
    routed: true,
    source_type: analysis.type,
    npr: analysis.npr,
    digitalRoot: analysis.digitalRoot,
    slot: slot,
    slot_hex: "0x" + slot.toString(16).toUpperCase(),
    phase: analysis.phase,
  };
}

/**
 * analyze — volledige NPR-analyse met metadata
 * @param {{ source: string, trace: object }} params
 * @returns {object} analyse resultaat
 */
function analyze(params) {
  const { source, trace } = params || {};
  
  if (!source) {
    return { error: "missing source" };
  }
  
  const auto = auto_reduce(source);
  const routeResult = route({ source });
  
  return {
    input: {
      length: source.length,
      type: auto.type,
    },
    npr: {
      npr: auto.result.npr,
      digitalRoot: auto.result.dr,
      value: auto.result.value,
      hex: auto.result.hex,
    },
    route: routeResult,
    trace: trace || null,
  };
}

// ─── Helpers ───

function getEncoder(type) {
  switch (type) {
    case "integer": return hex_encode_integer;
    case "ipv6": return hex_encode_ipv6;
    case "git_hash": return hex_encode_git_hash;
    default: return hex_encode_text;
  }
}

function getPhase(npr) {
  if (npr <= 2) return "Noise";
  if (npr <= 4) return "Pattern";
  if (npr <= 6) return "Return";
  if (npr <= 8) return "Hexa";
  return "Identity";
}

// ─── Exports ───

module.exports = {
  // Encoders
  hex_encode_text,
  hex_encode_token,
  hex_encode_integer,
  hex_encode_ipv6,
  hex_encode_git_hash,
  
  // NPR pipe
  dr_hex,
  npr_mod9,
  hex_digit_value,
  npr_reduce,
  
  // Auto
  detect_input_type,
  auto_reduce,
  
  // Tool-00 interface
  validate,
  route,
  analyze,
  
  // Helpers
  getEncoder,
  getPhase,
};
