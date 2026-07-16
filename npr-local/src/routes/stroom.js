/**
 * stroom.js — GBS Hub speed measurement
 *
 * Rol: Elektrisch-stroom metafoor voor endpoint performance
 * Kan: V, I, Ω, W, fasen, sunya, detail
 *
 * @net 10.06.0.0/24
 */

const core = require('./core');
const PATH_TO_SLOT = core.PATH_TO_SLOT || new Map();

// ─── Phase buckets ───
// 6N = Noise (slots 0-15)
// 12P = Pattern (slots 16-31)
// 24H = Hexa (slots 48-63)

/**
 * Compute stroom (current/power) data from ticks Map.
 *
 * @param {Map<string, number[]>} ticks - Path → latency array from index.js
 * @returns {object} GBS Hub response
 */
function getStroomData(ticks) {
  if (!ticks) ticks = new Map();
  const slot6N = [];   // L1 — maxwell / 6N
  const slot12P = [];  // L2 — planck / 12P
  const slot24H = [];  // L3 — mandelbrot / 24H

  let totalRequests = 0;
  let totalLatencySum = 0;
  let totalLatencyCount = 0;

  for (const [path, latencies] of ticks) {
    if (!latencies.length) continue;

    const slot = PATH_TO_SLOT.has(path) ? PATH_TO_SLOT.get(path) : null;
    const sum = latencies.reduce((a, b) => a + b, 0);
    const avg = sum / latencies.length;

    totalRequests += latencies.length;
    totalLatencySum += sum;
    totalLatencyCount += latencies.length;

    // Bucket by phase
    if (slot !== undefined && slot !== null) {
      if (slot >= 0 && slot <= 15) {
        slot6N.push(avg);
      } else if (slot >= 16 && slot <= 31) {
        slot12P.push(avg);
      } else if (slot >= 48 && slot <= 63) {
        slot24H.push(avg);
      }
    }
  }

  // ─── V (E-veld) — average tick latency in ms (stored as μs) ───
  const V = totalLatencyCount > 0
    ? Math.round((totalLatencySum / totalLatencyCount / 1000) * 1000) / 1000
    : 0;

  // ─── I (B-veld) — request throughput (requests/sec) ───
  const uptimeSec = Math.max(process.uptime(), 1);
  const I = Math.round((totalRequests / uptimeSec) * 10) / 10;

  // ─── Ω (weerstand) — V / I ───
  const ohm = I > 0 ? Math.round((V / I) * 1000) / 1000 : 0;

  // ─── W (vermogen) — V × I ───
  const W = Math.round((V * I) * 100) / 100;

  // ─── fasen (per-phase averages in ms, stored as μs) ───
  const avgOfArr = (arr) => arr.length > 0
    ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length / 1000) * 1000) / 1000
    : 0;

  const fasen = {
    L1: { veld: avgOfArr(slot6N) },
    L2: { veld: avgOfArr(slot12P) },
    L3: { veld: avgOfArr(slot24H) },
  };

  // ─── sunya — slot usage, noise, factor ───
  const totalSlots = 64;
  const usedSlots = new Set();
  for (const [path] of ticks) {
    const slot = PATH_TO_SLOT.has(path) ? PATH_TO_SLOT.get(path) : null;
    if (slot !== undefined && slot !== null) {
      usedSlots.add(slot);
    }
  }
  const zichtbaar = usedSlots.size;
  // sunya baseline = 64μs = 2^6
  const baseline = 64;
  const allLatencies = [];
  for (const [, latencies] of ticks) {
    allLatencies.push(...latencies);
  }
  const underHorizon = allLatencies.filter(l => l < baseline).length;
  const aboveHorizon = allLatencies.filter(l => l >= baseline).length;
  const noise = totalLatencyCount > 0
    ? Math.round((V / Math.max(totalLatencyCount, 1)) * 1000) / 1000
    : 0;
  const factor = Math.round((zichtbaar / totalSlots) * 100) / 100;

  const sunya = {
    zichtbaar,
    slots: totalSlots,
    noise,
    factor,
    baseline,
    under: underHorizon,
    above: aboveHorizon,
    total: allLatencies.length,
  };

  // ─── detail — Faraday status ───
  const detail = {
    check: V > 0 ? 'actief' : 'rust',
    faraday: `E=${V.toFixed(3)} | B=${I.toFixed(1)} | Ω=${ohm.toFixed(3)} | W=${W.toFixed(2)}`,
  };

  return { V, I, ohm, W, fasen, sunya, detail };
}

/**
 * HTTP handler that accepts ticks via a shared reference.
 *
 * @param {Map<string, number[]>} ticks
 * @returns {function} Express-style handler
 */
function handler(ticks) {
  return (req, res) => {
    res.json(getStroomData(ticks));
  };
}

module.exports = { getStroomData, handler };
