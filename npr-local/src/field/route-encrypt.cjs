/**
 * Stap 20: Encryptie Als Taal — Route Structuur
 *
 * NPR-signatuur beschrijft de route. Eén contextpermutatie verwerkt alle bytes.
 * Encryptie is de functie die route-structuur encodeert.
 *
 * Afhankelijkheid: Stap 19 (return-cyclus).
 * Referentie: /sec route-infrastructuur.
 */

const { createCipheriv, createDecipheriv, randomBytes } = require("node:crypto");

// ─────────────────────────────────────────────
// 1. Constanten
// ─────────────────────────────────────────────

const BYTE_SPACE_SIZE = 256;
const SPECTRAL_BLOCK_COUNT = 6;
const BLOCK_WIDTH = 42;
const RETURN_WIDTH = 4;

// 6 × 42 + 4 = 256 — sanity check
if (SPECTRAL_BLOCK_COUNT * BLOCK_WIDTH + RETURN_WIDTH !== BYTE_SPACE_SIZE) {
  throw new Error('Spectral block math invalid');
}

const BLOCK_NAMES = ['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'RETURN'];

const MOTOR_PHASES = ['ΦA', 'ΦB', 'ΦC'];

// ─────────────────────────────────────────────
// 2. Byte-Spectrum
// ─────────────────────────────────────────────

/**
 * assertByte(x) — valideert dat x een geldige byte is (0..255).
 */
function assertByte(x) {
  if (!Number.isInteger(x) || x < 0 || x > 255) {
    throw new RangeError(`byte must be an integer in 0..255, got: ${x}`);
  }
}

/**
 * spectral_block(x) — bepaal welk spectraal blok byte x behoort tot.
 *
 *   0  ≤ x < 252  →  B0..B5
 *   252 ≤ x ≤ 255 →  RETURN
 *
 * Retourneert block-id (0-5 voor B0-B5, 6 voor RETURN).
 */
function spectral_block(x) {
  assertByte(x);
  if (x < 252) {
    return Math.floor(x / BLOCK_WIDTH); // 0..5
  }
  return 6; // RETURN
}

/**
 * sub_position(x) — positie binnen het blok.
 *
 *   x < 252  →  x mod 42       (0..41)
 *   x ≥ 252  →  x - 252        (0..3)
 */
function sub_position(x) {
  assertByte(x);
  if (x < 252) {
    return x % BLOCK_WIDTH;
  }
  return x - 252;
}

// ─────────────────────────────────────────────
// 3. Mod9 Scheiding
// ─────────────────────────────────────────────

function raw_mod9(x) {
  return x % 9; // {0..8}
}

/**
 * NPR-mod9: mappt veelvouden van 9 naar 9 (niet 0).
 * Resultaat ∈ {1..9}.
 */
function npr_mod9(x) {
  const r = x % 9;
  return r === 0 ? 9 : r;
}

// ─────────────────────────────────────────────
// 4. Route-Signatuur
// ─────────────────────────────────────────────

/**
 * route_signature(x) — beschrijft de route voor byte x.
 * Vervangt de byte NIET; dit is metadata over de route.
 */
function route_signature(x) {
  const sp = sub_position(x);
  return {
    block:         spectral_block(x),
    sub_position:  sp,
    phase_index:   raw_mod9(sp),   // {0..8}
    npr_root:      npr_mod9(sp),   // {1..9}
  };
}

// ─────────────────────────────────────────────
// 5. Context + Canonieke Serialisatie v1
// ─────────────────────────────────────────────

/**
 * NFC-normaliseert een stringwaarde.
 */
function normalizeNfc(value) {
  if (typeof value !== 'string') {
    return value;
  }
  return value.normalize('NFC');
}

/**
 * Valideert en normalizeert een RouteContext object.
 */
function validate_context(ctx) {
  if (!ctx || typeof ctx !== 'object') {
    throw new TypeError('RouteContext must be a non-null object');
  }

  const { source_ids, motor_phase, iteration_depth, return_mode, layer_id } = ctx;

  if (!Array.isArray(source_ids)) {
    throw new TypeError('source_ids must be an array');
  }
  // NFC-normalisatie + lexicografisch sorteren
  const sorted = source_ids
    .map(id => {
      if (typeof id !== 'string') {
        throw new TypeError('each source_id must be a string');
      }
      return normalizeNfc(id);
    })
    .sort();

  const mp = normalizeNfc(motor_phase);
  if (!MOTOR_PHASES.includes(mp)) {
    throw new TypeError(`motor_phase must be one of ${MOTOR_PHASES.join(', ')}`);
  }

  if (!Number.isInteger(iteration_depth) || iteration_depth < 0) {
    throw new TypeError('iteration_depth must be a non-negative integer');
  }

  const rm = normalizeNfc(return_mode);
  if (typeof rm !== 'string' || rm.length === 0) {
    throw new TypeError('return_mode must be a non-empty string');
  }

  if (!Number.isInteger(layer_id)) {
    throw new TypeError('layer_id must be an integer');
  }

  return {
    source_ids:      sorted,
    motor_phase:     mp,
    iteration_depth,
    return_mode:     rm,
    layer_id,
  };
}

/**
 * Canonieke serialisatie v1.
 *
 * - encoding: UTF-8 (JS strings zijn UTF-16; we use JSON which is valid)
 * - Unicode-normalisatie: NFC (best-effort, Node.js default string ops)
 * - veldvolgorde: vast (schema-gedefinieerd)
 * - integers: base-10 zonder voorloopnullen
 * - source_ids: lexicografisch gesorteerd
 * - schema_version: verplicht
 */
function canonical_serialize_v1(ctx) {
  const normalized = validate_context(ctx);

  const canonical = {
    schema_version: 'NPR_CONTEXT_V1',
    source_ids:      normalized.source_ids,
    motor_phase:     normalized.motor_phase,
    iteration_depth: normalized.iteration_depth,
    return_mode:     normalized.return_mode,
    layer_id:        normalized.layer_id,
  };

  // JSON.stringify met vaste key-order (constructor order preserved in JS)
  return JSON.stringify(canonical);
}

// ─────────────────────────────────────────────
// 6. Permutatie-afleiding
// ─────────────────────────────────────────────

/**
 * derive_route(context) → Permutation(BYTE_SPACE)
 *
 * Eén permutatie per context. Gebruikt canonieke context-string
 * als zaad voor deterministische permutatie-generatie via Fisher-Yates
 * met een simple LCRNG afgeleid van de context.
 *
 * LET OP: Dit is NPR_ROUTE (routecodering), niet cryptografisch veilig.
 * Voor vertrouwelijkheid: gebruik NPR_CIPHER (AEAD).
 */

/**
 * Simpele deterministische RNG zaad uit string.
 * FNV-1a style hash → 32-bit unsigned.
 */
function hash_string(str) {
  let h = 2166136261 >>> 0; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0; // FNV prime
  }
  return h;
}

/**
 * LCRNG: x_{n+1} = (a * x_n + c) mod m
 * Numerical Recipes parameters.
 */
function lcgrng(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state >>> 16) % 65536; // 16-bit value
  };
}

/**
 * Fisher-Yates shuffle met deterministische RNG.
 */
function fisher_yates(size, rng) {
  const arr = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) {
    const j = rng() % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Deriveert één permutatie van BYTE_SPACE uit de context.
 *
 * Retourneert array van lengte 256: perm[x] = image van byte x.
 */
function derive_route(ctx) {
  const canonical = canonical_serialize_v1(ctx);
  const seed = hash_string(canonical);
  const rng = lcgrng(seed);
  return fisher_yates(BYTE_SPACE_SIZE, rng);
}

/**
 * Bouwt inverse permutatie: inv[perm[x]] = x.
 */
function inverse_permutation(perm) {
  const inv = new Uint8Array(BYTE_SPACE_SIZE);
  for (let i = 0; i < BYTE_SPACE_SIZE; i++) {
    inv[perm[i]] = i;
  }
  return inv;
}

// ─────────────────────────────────────────────
// 7. NPR_ROUTE — Routecodering
// ─────────────────────────────────────────────

/**
 * route_encode(x, context) — encodeert één byte via de context-permutatie.
 */
function route_encode(x, ctx) {
  if (!Number.isInteger(x) || x < 0 || x > 255) {
    throw new RangeError('byte must be integer 0-255');
  }
  const perm = derive_route(ctx);
  return perm[x];
}

/**
 * route_decode(y, context) — decodeert één byte via de inverse permutatie.
 *
 * Decryptie is NIET afhankelijk van onbekande plaintext-signatuur —
 * de inverse permutatie is volledig bepaald door context alleen.
 */
function route_decode(y, ctx) {
  if (!Number.isInteger(y) || y < 0 || y > 255) {
    throw new RangeError('byte must be integer 0-255');
  }
  const perm = derive_route(ctx);
  const inv = inverse_permutation(perm);
  return inv[y];
}

/**
 * Bulk encode/decode voor Uint8Array.
 * Cache de permutatie zodat ie niet per byte herleidt.
 */
function route_encode_bulk(data, ctx) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('data must be Uint8Array');
  }
  const perm = derive_route(ctx);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = perm[data[i]];
  }
  return out;
}

function route_decode_bulk(data, ctx) {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('data must be Uint8Array');
  }
  const perm = derive_route(ctx);
  const inv = inverse_permutation(perm);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = inv[data[i]];
  }
  return out;
}

// ─────────────────────────────────────────────
// 8. NPR_CIPHER — Authenticated Encryption
// ─────────────────────────────────────────────

/**
 * NPR_CIPHER gebruikt bestaande AEAD (AES-256-GCM).
 * NPR-context identificeert de route als AAD (Additional Authenticated Data).
 *
 * Retourneert: { ciphertext, nonce, tag }
 *
 * Dit IS cryptografisch veilig (confidentiality + integrity + authenticity).
 *
 * LET OP: Dit gebruikt Node.js crypto, niet een zelfgemaakte permutatie.
 */

function npr_cipher_encrypt(plaintext, secret_key, ctx) {
  const canonical = canonical_serialize_v1(ctx);
  const aad = Buffer.from(canonical, 'utf8');

  const nonce = randomBytes(12); // 96-bit nonce for GCM
  const key = typeof secret_key === 'string'
    ? Buffer.from(secret_key, 'utf8')
    : Buffer.from(secret_key);

  if (key.length !== 32) {
    throw new Error('secret_key must be 32 bytes (AES-256)');
  }

  const plaintextBuf = typeof plaintext === 'string'
    ? Buffer.from(plaintext, 'utf8')
    : Buffer.from(plaintext);

  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(aad, { plaintextLength: plaintextBuf.length });

  const encrypted = Buffer.concat([
    cipher.update(plaintextBuf),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    nonce,
    tag,
    plaintextLength: plaintextBuf.length,
  };
}

function npr_cipher_decrypt(encrypted, secret_key, ctx, nonce, tag) {
  const canonical = canonical_serialize_v1(ctx);
  const aad = Buffer.from(canonical, 'utf8');

  const key = typeof secret_key === 'string'
    ? Buffer.from(secret_key, 'utf8')
    : Buffer.from(secret_key);

  if (key.length !== 32) {
    throw new Error('secret_key must be 32 bytes (AES-256)');
  }

  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag); // vereist vóór final() bij GCM decrypt

  const encBuf = typeof encrypted === 'string'
    ? Buffer.from(encrypted, 'hex')
    : Buffer.from(encrypted);

  const decrypted = Buffer.concat([
    decipher.update(encBuf),
    decipher.final(),
  ]);

  return decrypted;
}

// ─────────────────────────────────────────────
// 9. Utility: Bijectiviteit verifiëren
// ─────────────────────────────────────────────

/**
 * Verifieert dat een permutatie bijectief is:
 * elk element van 0..255 verschijnt precies één keer.
 */
function verify_bijective(perm) {
  if (!Array.isArray(perm) || perm.length !== BYTE_SPACE_SIZE) {
    return false;
  }
  const seen = new Uint8Array(BYTE_SPACE_SIZE);
  for (const v of perm) {
    if (v < 0 || v >= BYTE_SPACE_SIZE || seen[v]) {
      return false;
    }
    seen[v] = 1;
  }
  // Alle 256 posities moeten bezet zijn
  for (let i = 0; i < BYTE_SPACE_SIZE; i++) {
    if (!seen[i]) return false;
  }
  return true;
}

// ─────────────────────────────────────────────
// 10. Cycliciteit — cycluslengte analyse
// ─────────────────────────────────────────────

/**
 * Bereken cycluslengte voor een specifieke byte onder de permutatie.
 * x → F(x) → F(F(x)) → ... → terug naar x.
 *
 * Retourneert cycluslengte en de cyclus-paden.
 */
function cycle_info(perm, start) {
  const visited = new Set();
  const path = [];
  let cur = start;
  while (!visited.has(cur)) {
    visited.add(cur);
    path.push(cur);
    cur = perm[cur];
  }
  return {
    start,
    cycle_length: path.length,
    path,
  };
}

/**
 * Bereken order(F) — kleinste n > 0 waarvoor F^n = identity.
 * Dit is de LCM van alle cycluslengtes.
 */
function gcd(a, b) {
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

function lcm(a, b) {
  return (a / gcd(a, b)) * b;
}

/**
 * Bereken order van de permutatie.
 * Analyseert alle cycli en neemt LCM van de lengtes.
 */
function permutation_order(perm) {
  const visited = new Uint8Array(BYTE_SPACE_SIZE);
  let order = 1;

  for (let i = 0; i < BYTE_SPACE_SIZE; i++) {
    if (!visited[i]) {
      let cur = i;
      let cycle_len = 0;
      while (!visited[cur]) {
        visited[cur] = 1;
        cur = perm[cur];
        cycle_len++;
      }
      order = lcm(order, cycle_len);
    }
  }

  return order;
}

/**
 * Volledige cyclus-analyse voor een permutatie.
 * Retourneert { cycles: [...], order, max_cycle, min_cycle, avg_cycle }.
 */
function full_cycle_analysis(perm) {
  const visited = new Uint8Array(BYTE_SPACE_SIZE);
  const cycles = [];
  let total_elements = 0;

  for (let i = 0; i < BYTE_SPACE_SIZE; i++) {
    if (!visited[i]) {
      const cycle = [];
      let cur = i;
      while (!visited[cur]) {
        visited[cur] = 1;
        cycle.push(cur);
        cur = perm[cur];
      }
      cycles.push(cycle);
      total_elements += cycle.length;
    }
  }

  const lengths = cycles.map(c => c.length).sort((a, b) => a - b);

  return {
    cycles,
    cycle_count: cycles.length,
    order: permutation_order(perm),
    max_cycle: lengths[lengths.length - 1],
    min_cycle: lengths[0],
    avg_cycle: total_elements / cycles.length,
  };
}

// ─────────────────────────────────────────────
// BLOCK_CONTRACT — stap 20 contract (Stap 21 compatible)
// ─────────────────────────────────────────────

const BLOCK_CONTRACT = Object.freeze({
  id: '20_encryptie_taal',
  phases: ['validate_context', 'derive_route', 'verify_bijective'],
  inputSchema: 'NPR_ROUTE_CONTEXT',
  outputSchema: 'NPR_ROUTE_PERMUTATION',
  dependencies: ['19_return'],
});

// ─────────────────────────────────────────────
// 11. Export summary
// ─────────────────────────────────────────────

module.exports = {
  BLOCK_CONTRACT,
  // Spectral
  spectral_block,
  sub_position,
  raw_mod9,
  npr_mod9,
  route_signature,
  // Context
  validate_context,
  canonical_serialize_v1,
  // NPR_ROUTE
  derive_route,
  inverse_permutation,
  route_encode,
  route_decode,
  route_encode_bulk,
  route_decode_bulk,
  // NPR_CIPHER
  npr_cipher_encrypt,
  npr_cipher_decrypt,
  // Verification
  verify_bijective,
  // Cycliciteit
  cycle_info,
  permutation_order,
  full_cycle_analysis,
  // Constants
  BYTE_SPACE_SIZE,
  SPECTRAL_BLOCK_COUNT,
  BLOCK_WIDTH,
  RETURN_WIDTH,
  BLOCK_NAMES,
  MOTOR_PHASES,
};
