// ═══════════════════════════════════════════════════
// field/keyboard-npr.js — Physical Keyboard NPR Route
// ═══════════════════════════════════════════════════
//
// From /sec/toetsenbord
// Maps the signal chain: finger → switch → matrix →
// controller → scan code → HID → driver → Unicode → UTF-8
//
// Each layer is a "gat" (gap) = injection point
// ═══════════════════════════════════════════════════

const ENCODING_LAYERS = [
  { layer: 0, name: 'finger',      type: 'analog',  gat: false },
  { layer: 1, name: 'switch',      type: 'analog',  gat: false },
  { layer: 2, name: 'matrix',      type: 'analog',  gat: false },
  { layer: 3, name: 'controller',  type: 'gap',     gat: true,  label: 'Gat 1: A/D' },
  { layer: 4, name: 'scan code',   type: 'digital', gat: false },
  { layer: 5, name: 'HID',         type: 'digital', gat: false },
  { layer: 6, name: 'driver',      type: 'gap',     gat: true,  label: 'Gat 2: Driver' },
  { layer: 7, name: 'IME',         type: 'gap',     gat: true,  label: 'Gat 3: IME' },
  { layer: 8, name: 'Unicode',     type: 'digital', gat: false },
  { layer: 9, name: 'UTF-8',       type: 'gap',     gat: true,  label: 'Gat 4: Encoding' },
  { layer: 10, name: 'terminal',   type: 'digital', gat: false },
];

// ─── Scan Code → Character ───

const SCAN_CODES = {
  0x1C: 'a', 0x32: 'b', 0x21: 'c', 0x23: 'd',
  0x24: 'e', 0x2B: 'f', 0x22: 'g', 0x25: 'h',
  0x2C: 'i', 0x33: 'j', 0x34: 'k', 0x35: 'l',
  0x31: 'm', 0x45: 'n', 0x26: 'o', 0x39: 'p',
};

// ─── NPR Route for Character ───

function keyboardNPR(key) {
  const char = key.toLowerCase().charAt(0);
  const code = char.codePointAt(0);
  const utf8Bytes = [...new TextEncoder().encode(char)];
  
  // Find scan code (reverse lookup)
  const scanCode = Object.entries(SCAN_CODES).find(([_, v]) => v === char);
  
  // Digital root of char code
  const dr = digitalRoot(code);
  const slot = (dr * 7) % 64;
  
  return {
    input: {
      key: char,
      codePoint: code,
      utf8: utf8Bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`),
      utf8Length: utf8Bytes.length,
    },
    layers: ENCODING_LAYERS.filter(l => l.gat).map(l => ({
      layer: l.layer,
      name: l.name,
      gat: l.label,
    })),
    route: {
      digitalRoot: dr,
      slot,
      phases: [
        { node: '1.5',   function: 'category' },
        { node: '1.25',  function: 'perspective' },
        { node: '1.19',  function: 'relations' },
        { node: '1.13',  function: 'structure' },
        { node: '1.40',  function: 'scale' },
      ],
    },
    origin: '0.0.0.0',
    return: '0.0.0.0',
  };
}

// ─── Digital Root ───

function digitalRoot(n) {
  n = Math.abs(n || 0);
  if (n === 0) return 0;
  return ((n - 1) % 9) + 1;
}

// ─── Full Signal Chain ───

function signalChain(char) {
  const chain = [];
  const code = char.codePointAt(0);
  
  chain.push({ stage: 'finger',       signal: 'mechanical',  data: 'downward force' });
  chain.push({ stage: 'switch',       signal: 'electrical',  data: 'contact closed' });
  chain.push({ stage: 'matrix',       signal: 'row/col',     data: 'matrix address' });
  chain.push({ stage: 'controller',   signal: 'scan code',   data: `0x${code.toString(16)}`, gat: true });
  chain.push({ stage: 'HID',          signal: 'USB/PS2',     data: 'HID report' });
  chain.push({ stage: 'driver',       signal: 'keystroke',   data: 'OS event', gat: true });
  chain.push({ stage: 'IME',          signal: 'character',   data: `${char} (U+${code.toString(16).padStart(4, '0')})`, gat: true });
  chain.push({ stage: 'UTF-8',        signal: 'bytes',       data: [...new TextEncoder().encode(char)].map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '), gat: true });
  chain.push({ stage: 'terminal',     signal: 'display',     data: 'glyph rendered' });
  
  return chain;
}

module.exports = { keyboardNPR, signalChain, ENCODING_LAYERS };
