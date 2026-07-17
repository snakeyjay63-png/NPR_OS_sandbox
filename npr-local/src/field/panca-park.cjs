"use strict";

// Pañca Park — Arthouse Park van de Vrede
// Drievoudige vijfstructuur op Hexa Grid Sea
// Park = wereld, water = medium, hexagrid = vorm, Pañca = organisatie

const PANCA_PARK = Object.freeze({
  garden:   0x00,
  water:    0x01,
  pavilion: 0x02,
  path:     0x03,
  horizon:  0x04,
});

const PANCA_STATE = Object.freeze({
  presence:   0x00,
  movement:   0x01,
  resonance:  0x02,
  memory:     0x03,
  return:     0x04,
});

const PANCA_SHAKTI = Object.freeze({
  create:    0x00,
  connect:   0x01,
  transform: 0x02,
  preserve:  0x03,
  release:   0x04,
});

const PARK_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(PANCA_PARK).map(([k, v]) => [v, k]))
);
const STATE_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(PANCA_STATE).map(([k, v]) => [v, k]))
);
const SHAKTI_NAMES = Object.freeze(
  Object.fromEntries(Object.entries(PANCA_SHAKTI).map(([k, v]) => [v, k]))
);

// Validate hex value is in [0x00..0x04]
function isValidHex(v) {
  return Number.isInteger(v) && v >= 0x00 && v <= 0x04;
}

function isValidDepth(v) {
  return Number.isInteger(v) && v >= 0 && v <= 0xff;
}

function isValidEnergy(v) {
  return Number.isInteger(v) && v >= 0 && v <= 0xff;
}

function createPeaceParkCell({
  q_hex,
  r_hex,
  park_hex = 0x00,
  state_hex = 0x00,
  shakti_hex = 0x00,
  depth_hex = 0x00,
  energy_hex = 0x00,
}) {
  if (!isValidHex(park_hex)) throw new Error(`Invalid park_hex: ${park_hex}`);
  if (!isValidHex(state_hex)) throw new Error(`Invalid state_hex: ${state_hex}`);
  if (!isValidHex(shakti_hex)) throw new Error(`Invalid shakti_hex: ${shakti_hex}`);
  if (!isValidDepth(depth_hex)) throw new Error(`Invalid depth_hex: ${depth_hex}`);
  if (!isValidEnergy(energy_hex)) throw new Error(`Invalid energy_hex: ${energy_hex}`);

  return Object.freeze({
    coordinate: Object.freeze({ q_hex, r_hex }),
    panca: Object.freeze({
      park_hex,
      state_hex,
      shakti_hex,
    }),
    water: Object.freeze({
      depth_hex,
      energy_hex,
    }),
  });
}

// Human-readable interpretation of a cell
function interpretCell(cell) {
  const park = PARK_NAMES[cell.panca.park_hex] ?? `0x${cell.panca.park_hex.toString(16)}`;
  const state = STATE_NAMES[cell.panca.state_hex] ?? `0x${cell.panca.state_hex.toString(16)}`;
  const shakti = SHAKTI_NAMES[cell.panca.shakti_hex] ?? `0x${cell.panca.shakti_hex.toString(16)}`;

  return Object.freeze({
    coordinate: `${cell.coordinate.q_hex},${cell.coordinate.r_hex}`,
    domain: park,
    state,
    shakti,
    depth: `0x${cell.water.depth_hex.toString(16).padStart(2, '0')}`,
    energy: `0x${cell.water.energy_hex.toString(16).padStart(2, '0')}`,
  });
}

// Count total meaningful combinations: 5×5×5 = 125
const COMBINATION_SPACE = 5 * 5 * 5;

// Generate all valid combinations for a given coordinate
function enumerateCombinations(q_hex, r_hex) {
  const cells = [];
  for (let p = 0; p <= 4; p++) {
    for (let s = 0; s <= 4; s++) {
      for (let sh = 0; sh <= 4; sh++) {
        cells.push(
          createPeaceParkCell({
            q_hex,
            r_hex,
            park_hex: p,
            state_hex: s,
            shakti_hex: sh,
          })
        );
      }
    }
  }
  return cells;
}

module.exports = {
  PANCA_PARK,
  PANCA_STATE,
  PANCA_SHAKTI,
  PARK_NAMES,
  STATE_NAMES,
  SHAKTI_NAMES,
  createPeaceParkCell,
  interpretCell,
  enumerateCombinations,
  COMBINATION_SPACE,
};
