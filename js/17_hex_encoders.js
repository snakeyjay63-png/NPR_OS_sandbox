#!/usr/bin/env node
/**
 * NPR-OS Stap 17: Canonieke Hex-Encoders
 * input → hex → dr_hex → npr_mod9 → {0..9,A..F} → {1..9}
 *
 * SCOPE V1:
 *   integer: 0 .. Number.MAX_SAFE_INTEGER (BigInt = future)
 *   ipv6: pure hex notation only (IPv4-mapped ::ffff:x.x.x.x = unsupported)
 *   utf8: strict decoding (INVALID_UTF8 on invalid sequences)
 */

// --- Strict hex validation ---

function assertValidHex(value) {
  const stripped = String(value).trim().replace(/^0x/i, '');
  if (!stripped || !/^[0-9A-Fa-f]+$/.test(stripped)) {
    throw new Error('INVALID_HEX');
  }
  return stripped;
}

// --- Core ---

/**
 * drHex(hexDigits) → digital root as hex string.
 * hexDigits: string[] van hex karakters ('0'..'9','A'..'F').
 * FIX: publiceert nu validatie (was intern, nu geëxporteerd).
 */
function drHex(hexDigits) {
  if (!hexDigits || hexDigits.length === 0) return '0';
  for (const ch of hexDigits) {
    if (typeof ch !== 'string' || !/^[0-9A-Fa-f]$/.test(ch)) {
      throw new Error('INVALID_HEX_DIGIT');
    }
  }
  let sum = 0;
  for (const ch of hexDigits) sum += parseInt(ch, 16);
  while (sum > 15) {
    let tmp = 0;
    for (const ch of sum.toString(16).toUpperCase()) tmp += parseInt(ch, 16);
    sum = tmp;
  }
  return sum.toString(16).toUpperCase();
}

function nprMod9(dh) {
  const n = parseInt(dh, 16);
  return n === 0 ? 9 : ((n - 1) % 9) + 1;
}

function hexCanonical(s) {
  const clean = assertValidHex(s).toUpperCase();
  return clean.length % 2 ? '0' + clean : clean;
}

function result(type, canonical, hex) {
  const d = hex.split('');
  return { inputType: type, canonicalValue: canonical, hex, hexDigits: d, drHex: drHex(d), mod9: 0 };
}

function finish(r) { r.mod9 = nprMod9(r.drHex); return r; }

// --- Encoders ---

function encodeUtf8Text(text) {
  if (text == null || text === '') throw new Error('EMPTY_INPUT');
  const n = String(text).normalize('NFC');
  const h = Buffer.from(n, 'utf-8').toString('hex').toUpperCase();
  return finish(result('utf8_text', n, h));
}

function encodeInteger(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('INVALID_INTEGER');
  if (n < 0) throw new Error('NEGATIVE_INTEGER_UNSUPPORTED');
  if (!Number.isInteger(n)) throw new Error('INVALID_INTEGER');
  if (n > Number.MAX_SAFE_INTEGER) throw new Error('INTEGER_OUT_OF_RANGE');
  return finish(result('integer', n.toString(), n.toString(16).toUpperCase().padStart(2, '0')));
}

function encodeTokenId(id) {
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error('INVALID_TOKEN_ID');
  }
  const hex = n.toString(16).toUpperCase().padStart(2, '0');
  return finish(result('token_id', n.toString(), hex));
}

function encodeHexString(hex) {
  if (!hex || hex.toString().trim() === '') throw new Error('EMPTY_INPUT');
  const s = assertValidHex(hex);
  const c = hexCanonical(s);
  return finish(result('hex_string', c, c));
}

function encodeHash(hash, algorithm = 'sha256') {
  if (!hash || hash.toString().trim() === '') throw new Error('EMPTY_INPUT');
  const s = assertValidHex(hash);
  const upper = s.toUpperCase();
  const algo = (algorithm || 'sha256').toLowerCase();
  const expectedLengths = { sha1: 40, sha256: 64, sha512: 128 };
  const expectedLen = expectedLengths[algo];
  if (!expectedLen) throw new Error('UNSUPPORTED_HASH_ALGORITHM');
  if (upper.length !== expectedLen) throw new Error(`INVALID_HASH_LENGTH: expected ${expectedLen} for ${algo}, got ${upper.length}`);
  return finish(result('hash', upper, upper));
}

function encodeIpv6(addr) {
  if (!addr || addr.toString().trim() === '') throw new Error('EMPTY_INPUT');
  const ip = addr.toString().trim();
  // Reject zone IDs
  if (ip.includes('%')) throw new Error('INVALID_IPV6');
  // FIX: Reject IPv4-mapped/IPv4-embedded (::ffff:192.0.2.1 = unsupported V1)
  if (ip.includes('.')) throw new Error('INVALID_IPV6');
  // Reject multiple ::
  if ((ip.match(/::/g) || []).length > 1) throw new Error('INVALID_IPV6');
  if (!/^[0-9a-fA-F:]+$/.test(ip)) throw new Error('INVALID_IPV6');
  let exp = ip;
  if (exp.includes('::')) {
    const [l, r] = exp.split('::');
    const lp = l ? l.split(':') : [];
    const rp = r ? r.split(':') : [];
    exp = [...lp, ...Array(8 - lp.length - rp.length).fill('0'), ...rp].join(':');
  }
  const seg = exp.split(':');
  if (seg.length !== 8) throw new Error('INVALID_IPV6');
  // Validate each segment: 1-4 hex chars
  if (!seg.every(s => /^[0-9A-Fa-f]{1,4}$/.test(s))) throw new Error('INVALID_IPV6');
  const h = seg.map(s => s.padStart(4, '0').toUpperCase()).join('');
  if (h.length !== 32) throw new Error('INVALID_IPV6');
  // FIX: canonicalValue = fully expanded upper-case form
  const canonicalValue = seg.map(s => s.padStart(4, '0').toUpperCase()).join(':');
  return finish(result('ipv6', canonicalValue, h));
}

function reduceHex(hex) {
  const c = hexCanonical(hex);
  const d = c.split('');
  return { hex: c, hexDigits: d, drHex: drHex(d), mod9: nprMod9(drHex(d)) };
}

// --- Decoders ---

function decodeUtf8Hex(hex) {
  const clean = assertValidHex(hex);
  if (clean.length % 2 !== 0) throw new Error('INVALID_HEX_BYTE_LENGTH');
  // FIX: strict UTF-8 decoding (fatal on invalid sequences)
  const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    return decoder.decode(Buffer.from(clean, 'hex'));
  } catch {
    throw new Error('INVALID_UTF8');
  }
}

function decodeIntegerHex(hex) {
  const clean = assertValidHex(hex);
  // FIX: use BigInt for safe range check before converting to Number
  const n = BigInt('0x' + clean);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('INTEGER_OUT_OF_RANGE');
  }
  return Number(n);
}

// --- Export ---

module.exports = {
  encodeUtf8Text, encodeInteger, encodeTokenId, encodeHexString,
  encodeIpv6, encodeHash, reduceHex, drHex, nprMod9,
  decodeUtf8Hex, decodeIntegerHex,
};

// --- Tests ---

if (require.main === module) {
  const P = [], F = [];
  function t(n, fn) { try { fn(); P.push(n); } catch (e) { F.push(n + ': ' + e.message); } }
  function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m || 'eq'); }
  function throwsWith(fn, prefix) {
    let thrown = false;
    try { fn(); } catch (e) { thrown = true; if (!String(e.message).startsWith(prefix)) throw new Error(`${e.message} does not start with ${prefix}`); }
    if (!thrown) throw new Error('Expected error');
  }

  // --- Existing core tests ---
  t('utf8 hello', () => eq(encodeUtf8Text('hello').hex, '68656C6C6F'));
  t('utf8 roundtrip', () => eq(decodeUtf8Hex(encodeUtf8Text('hello world').hex), 'hello world'));
  t('int 12345', () => eq(encodeInteger(12345).hex, '3039'));
  t('int 0', () => eq(encodeInteger(0).hex, '00'));
  t('int neg', () => throwsWith(() => encodeInteger(-1), 'NEGATIVE_INTEGER'));
  t('token 12345', () => eq(encodeTokenId(12345).hex, '3039'));
  t('hex 0000 dr=0', () => eq(encodeHexString('0000').drHex, '0'));
  t('hex F dr=F mod9=6', () => { const r = encodeHexString('F'); eq(r.drHex, 'F'); eq(r.mod9, 6); });
  t('hex case', () => eq(encodeHexString('abc').hex, encodeHexString('ABC').hex));
  t('ipv6 ::1', () => { const r = encodeIpv6('::1'); eq(r.hex.length, 32); });
  t('ipv6 2001:db8::1', () => { const r = encodeIpv6('2001:db8::1'); eq(r.hex.startsWith('20010DB8'), true); });
  t('hash sha256', () => { const h = 'a'.repeat(64); const r = encodeHash(h); eq(r.hex.length, 64); });
  t('drHex empty', () => eq(drHex([]), '0'));
  t('drHex 3039', () => eq(drHex('3039'.split('')), 'F'));
  t('nprMod9', () => { eq(nprMod9('0'), 9); eq(nprMod9('1'), 1); eq(nprMod9('F'), 6); });

  // --- Issue 1: encodeTokenId preserves type ---
  t('token_id inputType', () => eq(encodeTokenId(12345).inputType, 'token_id'));

  // --- Issue 3: distinct error names ---
  t('int float → INVALID_INTEGER', () => throwsWith(() => encodeInteger(1.5), 'INVALID_INTEGER'));
  t('int NaN → INVALID_INTEGER', () => throwsWith(() => encodeInteger(NaN), 'INVALID_INTEGER'));
  t('int Infinity → INVALID_INTEGER', () => throwsWith(() => encodeInteger(Infinity), 'INVALID_INTEGER'));
  t('int MAX_SAFE+1 → INTEGER_OUT_OF_RANGE', () => throwsWith(() => encodeInteger(Number.MAX_SAFE_INTEGER + 10), 'INTEGER_OUT_OF_RANGE'));

  // --- Issue 4: 0X prefix case insensitive ---
  t('0X prefix accepted', () => eq(encodeHexString('0XAB').hex, encodeHexString('0xab').hex));

  // --- Issue 5: reduceHex validates ---
  t('reduceHex invalid → INVALID_HEX', () => throwsWith(() => reduceHex('XYZ'), 'INVALID_HEX'));

  // --- Issue 6: decoder validates ---
  t('decodeUtf8Hex odd length → INVALID_HEX_BYTE_LENGTH', () => throwsWith(() => decodeUtf8Hex('ABC'), 'INVALID_HEX_BYTE_LENGTH'));
  t('decodeUtf8Hex invalid chars', () => throwsWith(() => decodeUtf8Hex('GGGG'), 'INVALID_HEX'));
  t('decodeIntegerHex invalid chars', () => throwsWith(() => decodeIntegerHex('ZZZ'), 'INVALID_HEX'));

  // --- Issue 7: hash length validation ---
  t('hash wrong length → INVALID_HASH_LENGTH', () => throwsWith(() => encodeHash('AB'), 'INVALID_HASH_LENGTH'));
  t('hash sha1 length', () => { const h = 'a'.repeat(40); const r = encodeHash(h, 'sha1'); eq(r.hex.length, 40); });
  t('hash sha512 length', () => { const h = 'f'.repeat(128); const r = encodeHash(h, 'sha512'); eq(r.hex.length, 128); });
  t('hash unsupported algo', () => throwsWith(() => encodeHash('a'.repeat(64), 'md5'), 'UNSUPPORTED_HASH_ALGORITHM'));

  // --- Issue 8: IPv6 edge cases ---
  t('ipv6 multiple ::', () => throwsWith(() => encodeIpv6('::1::2'), 'INVALID_IPV6'));
  t('ipv6 segment > 4 chars', () => throwsWith(() => encodeIpv6('2001:0DB8:0000:0000:0000:0000:0000:12345'), 'INVALID_IPV6'));
  t('ipv6 zone ID', () => throwsWith(() => encodeIpv6('::1%eth0'), 'INVALID_IPV6'));

  // --- NFC equivalence ---
  t('NFC equivalence', () => {
    const eacute = '\u00E9'; // precomposed é
    const e_acute = 'e\u0301'; // e + combining acute
    eq(encodeUtf8Text(eacute).hex, encodeUtf8Text(e_acute).hex);
  });

  // --- FIX: drHex validates ---
  t('drHex invalid digit → INVALID_HEX_DIGIT', () => throwsWith(() => drHex(['X']), 'INVALID_HEX_DIGIT'));
  t('drHex non-string → INVALID_HEX_DIGIT', () => throwsWith(() => drHex([42]), 'INVALID_HEX_DIGIT'));

  // --- FIX: decodeIntegerHex BigInt safety ---
  t('decodeIntegerHex safe range', () => eq(decodeIntegerHex('3039'), 12345));
  t('decodeIntegerHex out of range → INTEGER_OUT_OF_RANGE', () => throwsWith(() => decodeIntegerHex('8000000000000000'), 'INTEGER_OUT_OF_RANGE'));

  // --- FIX: decodeUtf8Hex strict ---
  t('decodeUtf8Hex strict valid', () => eq(decodeUtf8Hex('C3A9'), '\u00E9'));
  t('decodeUtf8Hex invalid utf8 → INVALID_UTF8', () => throwsWith(() => decodeUtf8Hex('C3'), 'INVALID_UTF8'));

  // --- FIX: IPv6 canonicalValue fully expanded ---
  t('ipv6 canonicalValue expanded', () => {
    const r = encodeIpv6('2001:db8::1');
    eq(r.canonicalValue, '2001:0DB8:0000:0000:0000:0000:0000:0001');
  });
  t('ipv6 canonicalValue ::1', () => {
    const r = encodeIpv6('::1');
    eq(r.canonicalValue, '0000:0000:0000:0000:0000:0000:0000:0001');
  });
  t('ipv6 equivalent forms same canonicalValue', () => {
    const r1 = encodeIpv6('2001:db8::1');
    const r2 = encodeIpv6('2001:0db8:0:0:0:0:0:1');
    eq(r1.canonicalValue, r2.canonicalValue);
  });

  // --- FIX: IPv4-mapped IPv6 unsupported ---
  t('ipv6 mapped → INVALID_IPV6', () => throwsWith(() => encodeIpv6('::ffff:192.0.2.128'), 'INVALID_IPV6'));

  console.log(`Stap 17 tests: ${P.length}/${P.length + F.length} ✅`);
  if (F.length) F.forEach(f => console.log(`  ❌ ${f}`));
}
