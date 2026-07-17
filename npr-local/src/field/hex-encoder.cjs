// @net 10.17.0.0/24
// ═══════════════════════════════════════════════════
// @net 10.17.0.0/24
// field/hex-encoder.cjs — Stap 17: Hex Native
// ═══════════════════════════════════════════════════
//
// Hex-native encoding layer.
// Bridges digital root (1-9) into hexadecimal space (1-9, A-F)
// and provides UTF-8 hex encode/decode utilities.
//
// dr_hex       : ℕ → [1..9, A..F]
// npr_mod9     : ℕ → [0..9]
// hex_encode   : String → HexString
// hex_decode   : HexString → String
// token_to_dr_hex  : String → [1..9, A..F]
// token_to_npr_mod9: String → [0..9]
//
// ═══════════════════════════════════════════════════

/**
 * All valid hex digits in order, including '0' for the zero case.
 * @type {string[]}
 */
const HEX_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Extended digital root mapping values into hex space [0..9, A..F].
 *
 * For n = 0: returns '0'.
 * For n > 0:
 *   - If n % 9 === 0: returns '9'
 *   - If n % 9 ∈ [1..9]: returns the digit as hex (1-9 for values ≤ 9, A-F for values > 9)
 *
 * The standard mod-9 gives [1..9]. When the raw remainder would exceed 9
 * (which can't happen with mod-9 alone), values are mapped via .toString(16).
 * In practice for positive integers: result ∈ ['1'..'9'] unless n % 9 > 9
 * (which only occurs when n itself is large enough to have mod-16 > 9,
 * but we use mod-9 so result stays 1-9).
 *
 * Extended behavior: for values where we want hex beyond 9,
 * we apply mod-16 instead. This function uses mod-9 as the base
 * with hex formatting for the result.
 *
 * @param {number} n - Non-negative integer.
 * @returns {string} Hex digit string in ['0'..'9', 'A'..'F'].
 */
function dr_hex(n) {
  n = Math.abs(Math.floor(n));

  if (n === 0) return '0';

  const remainder = n % 9;
  if (remainder === 0) return '9';

  // remainder is 1-8 here, which maps directly to hex digits
  return remainder.toString(16).toUpperCase();
}

/**
 * Standard NPR mod-9 digital root.
 *
 * Returns ((n - 1) % 9) + 1 for n > 0, and 0 for n = 0.
 * This is the canonical digital root used throughout NPR-OS.
 *
 * @param {number} n - Non-negative integer.
 * @returns {number} Digital root in [0..9].
 */
function npr_mod9(n) {
  n = Math.abs(Math.floor(n));

  if (n === 0) return 0;

  return ((n - 1) % 9) + 1;
}

/**
 * Encode a string to a hex representation of its UTF-8 bytes.
 * Each byte becomes a 2-character hex string, joined with no separator.
 *
 * Example: hex_encode("Hi") → "4869"
 *
 * @param {string} text - Text to encode.
 * @returns {string} Hex-encoded string (uppercase).
 * @throws {Error} On empty or non-string input.
 */
function hex_encode(text) {
  if (typeof text !== 'string') {
    throw new Error('invalid_input: hex_encode expects a string');
  }
  if (text.length === 0) {
    throw new Error('empty_input: hex_encode received empty string');
  }

  const bytes = new TextEncoder().encode(text);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).toUpperCase().padStart(2, '0');
  }
  return hex;
}

/**
 * Decode a hex-encoded string back to text.
 * Expects pairs of hex characters representing UTF-8 bytes.
 *
 * Example: hex_decode("4869") → "Hi"
 *
 * @param {string} hex - Hex-encoded string (case-insensitive).
 * @returns {string} Decoded text.
 * @throws {Error} On invalid hex input.
 */
function hex_decode(hex) {
  if (typeof hex !== 'string') {
    throw new Error('invalid_input: hex_decode expects a string');
  }
  if (hex.length === 0) {
    throw new Error('empty_input: hex_decode received empty string');
  }
  if (hex.length % 2 !== 0) {
    throw new Error('invalid_hex: hex string must have even length');
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    if (isNaN(byte)) {
      throw new Error('invalid_hex: non-hex character at position ' + i);
    }
    bytes[i / 2] = byte;
  }

  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * Compute a token value from its Unicode code points, then apply dr_hex.
 *
 * Token value = sum of code point values of all characters.
 *
 * @param {string} token - Text token to compute dr_hex for.
 * @returns {string} Hex digital root digit.
 * @throws {Error} On empty or non-string input.
 */
function token_to_dr_hex(token) {
  if (typeof token !== 'string') {
    throw new Error('invalid_input: token_to_dr_hex expects a string');
  }
  if (token.length === 0) {
    throw new Error('empty_input: token_to_dr_hex received empty string');
  }

  const value = tokenValue(token);
  return dr_hex(value);
}

/**
 * Compute a token value from its Unicode code points, then apply npr_mod9.
 *
 * Token value = sum of code point values of all characters.
 *
 * @param {string} token - Text token to compute npr_mod9 for.
 * @returns {number} NPR mod-9 digital root in [0..9].
 * @throws {Error} On empty or non-string input.
 */
function token_to_npr_mod9(token) {
  if (typeof token !== 'string') {
    throw new Error('invalid_input: token_to_npr_mod9 expects a string');
  }
  if (token.length === 0) {
    throw new Error('empty_input: token_to_npr_mod9 received empty string');
  }

  const value = tokenValue(token);
  return npr_mod9(value);
}

// ─── Internal Helpers ─────────────────────────────

/**
 * Compute numeric value of a token as sum of Unicode code points.
 * Mirrors the tokenValue function in npr.js for consistency.
 *
 * @param {string} token - Text token.
 * @returns {number} Sum of code point values.
 */
function tokenValue(token) {
  let sum = 0;
  for (const ch of token) {
    const code = ch.codePointAt(0) || 0;
    sum += code;
  }
  return sum;
}

// ─── Module Exports ───────────────────────────────

module.exports = {
  dr_hex,
  npr_mod9,
  hex_encode,
  hex_decode,
  token_to_dr_hex,
  token_to_npr_mod9,
  HEX_DIGITS,
};
