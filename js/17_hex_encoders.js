#!/usr/bin/env node
/**
 * NPR-OS Stap 17: Canonieke Hex-Encoders
 * input → hex → dr_hex → npr_mod9 → {0..9,A..F} → {1..9}
 */

// --- Core ---

function drHex(hexDigits) {
  if (!hexDigits || hexDigits.length === 0) return '0';
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
  s = (s || '').toString().trim().toUpperCase().replace(/^0X/, '');
  return s.length % 2 ? '0' + s : s;
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
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw new Error('NEGATIVE_INTEGER_UNSUPPORTED');
  return finish(result('integer', n.toString(), n.toString(16).toUpperCase().padStart(2, '0')));
}

function encodeTokenId(id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw new Error('INVALID_TOKEN_ID');
  return encodeInteger(n);
}

function encodeHexString(hex) {
  if (!hex || hex.toString().trim() === '') throw new Error('EMPTY_INPUT');
  const s = hex.toString().trim();
  if (!/^[0-9a-fA-F]+$/.test(s.replace(/^0x/, ''))) throw new Error('INVALID_HEX');
  const c = hexCanonical(s);
  return finish(result('hex_string', c, c));
}

function encodeIpv6(addr) {
  if (!addr || addr.toString().trim() === '') throw new Error('EMPTY_INPUT');
  const ip = addr.toString().trim();
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
  const h = seg.map(s => s.padStart(4, '0').toUpperCase()).join('');
  if (h.length !== 32) throw new Error('INVALID_IPV6');
  return finish(result('ipv6', ip, h));
}

function encodeHash(hash) {
  if (!hash || hash.toString().trim() === '') throw new Error('EMPTY_INPUT');
  const s = hash.toString().trim();
  if (!/^[0-9a-fA-F]+$/.test(s.replace(/^0x/, ''))) throw new Error('INVALID_HEX');
  return finish(result('hash', s.toUpperCase(), s.toUpperCase()));
}

function reduceHex(hex) {
  const c = hexCanonical(hex);
  const d = c.split('');
  return { hex: c, hexDigits: d, drHex: drHex(d), mod9: nprMod9(drHex(d)) };
}

// --- Decoders ---

function decodeUtf8Hex(hex) { return Buffer.from(hexCanonical(hex), 'hex').toString('utf-8'); }
function decodeIntegerHex(hex) { return parseInt(hexCanonical(hex), 16); }

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

  t('utf8 hello', () => eq(encodeUtf8Text('hello').hex, '68656C6C6F'));
  t('utf8 roundtrip', () => eq(decodeUtf8Hex(encodeUtf8Text('hello world').hex), 'hello world'));
  t('int 12345', () => eq(encodeInteger(12345).hex, '3039'));
  t('int 0', () => eq(encodeInteger(0).hex, '00'));
  t('int neg', () => { try { encodeInteger(-1); throw 0; } catch (e) { if (!e) throw new Error('no throw'); } });
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

  console.log(`Stap 17 tests: ${P}/${P + F.length} ✅`);
  if (F.length) F.forEach(f => console.log(`  ❌ ${f}`));
}
