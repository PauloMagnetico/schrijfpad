/* Schrijfpad — letterdata.
 *
 * Coördinatenstelsel (y naar beneden), gedeeld door alle letters:
 *   ASC  =  50  bovenlijn (stokletters, hoofdletters)
 *   XH   = 120  x-hoogte (romphoogte)
 *   BL   = 210  basislijn
 *   DSC  = 270  onderlijn (staartletters)
 * De breedte (w) verschilt per letter. Elke streek is een SVG-pad dat in de
 * schrijfrichting loopt; de volgorde van de strokes is de schrijfvolgorde.
 * Een streek met dot:true is een punt (tikken, niet slepen).
 *
 * De streekdata volgt het lopend blokschrift (Loblosch, syboor.eu) en wordt
 * gegenereerd door tools/gen-strokes.mjs → strokes.js. Vormen, schrijfrichting
 * én pauzes (aparte streken, bv. romp en stok van de a) komen daarvandaan.
 */

import { lower, upper } from './strokes.js';

export const GUIDES = { ASC: 50, XH: 120, BL: 210, DSC: 270 };

function fx(n) { return Math.round(n * 10) / 10; }

/* ---- klanken van meer letters ----------------------------------------- */

// Verschuif een pad dx naar rechts. Alle gegenereerde paden zijn absoluut
// (M/L/C/Q/A), dus alleen de x-waarden schuiven op.
function shiftX(d, dx) {
  const ARGC = { M: 2, L: 2, C: 6, Q: 4, S: 4, T: 2, A: 7, H: 1, V: 1, Z: 0 };
  let cmd = '', k = 0;
  return (d.match(/[A-Za-z]|-?[\d.]+/g) || []).map((t) => {
    if (/[A-Za-z]/.test(t)) { cmd = t.toUpperCase(); k = 0; return t; }
    const i = k++ % (ARGC[cmd] || 2);
    const isX = cmd === 'H' || (cmd === 'A' ? i === 5 : cmd !== 'V' && i % 2 === 0);
    return isX ? String(fx(parseFloat(t) + dx)) : t;
  }).join(' ');
}

// Een klank van meer letters wordt als één geheel ingeoefend: de delen
// staan naast elkaar, streken in schrijfvolgorde per deelletter. De eerste
// streek van elke volgende deelletter krijgt newLetter: daar pauzeert de
// kijkanimatie even; binnen een letter loopt ze vloeiend door.
function compose(parts) {
  let dx = 0;
  const strokes = [];
  parts.forEach((p, pi) => {
    lower[p].strokes.forEach((st, si) => {
      const copy = Object.assign({}, st, { d: shiftX(st.d, dx) });
      if (pi > 0 && si === 0) copy.newLetter = true;
      strokes.push(copy);
    });
    dx += lower[p].w;
  });
  return { w: dx, strokes };
}

// Meerletterklanken (ij heeft als digraaf een eigen glyph in de bron).
export const KLANKEN = ['aa', 'ee', 'oo', 'uu', 'ie', 'oe', 'ui', 'eu', 'ou', 'ei', 'au', 'ch', 'ng', 'nk', 'sch'];
for (const k of KLANKEN) lower[k] = compose(k.split(''));

export const LETTERS = Object.assign({}, lower, upper);

// Voorbeeldwoord per letter/klank, door de lesgever bepaald ("a van tas"):
// een kort, alledaags woord dat de klank bevat (niet per se vooraan),
// zelfde woord bij meer klanken mag. q/x/y zitten niet in de methode.
export const WORDS = {
  a: 'tas', b: 'bus', c: 'centrum', d: 'doos', e: 'pet', f: 'fiets',
  g: 'gom', h: 'huis', i: 'vis', j: 'jas', k: 'kar', l: 'meel',
  m: 'meel', n: 'kan', o: 'gom', p: 'pak', r: 'kar',
  s: 'tas', t: 'tas', u: 'bus', v: 'vis', w: 'week',
  z: 'zout', ij: 'rijst',
  aa: 'kaas', ee: 'meel', oo: 'doos', uu: 'uur', ie: 'riem', oe: 'boek',
  ui: 'huis', eu: 'neus', ou: 'zout', ei: 'trein', au: 'auto',
  ch: 'licht', ng: 'gang', nk: 'bank', sch: 'school',
};

// Leerpad én lesgever-toetsenbord: de aanleervolgorde van de lesgever
// (letters en klanken door elkaar). 'ie' kwam in de methode twee keer voor
// (riem, fiets) en is hier één item; q/x/y doen niet mee.
export const PATH_ORDER = [
  'a', 't', 's', 'k', 'r', 'm', 'ee', 'l', 'v', 'i', 'aa', 'd', 'oo',
  'n', 'p', 'e', 'j', 'g', 'o', 'ie', 'b', 'u', 'oe', 'sch', 'uu', 'w',
  'h', 'ui', 'ij', 'ch', 'f', 'nk', 'eu', 'ng', 'z', 'ou', 'ei', 'au',
  'c',
];

export const VOWELS = ['a', 'e', 'i', 'o', 'u'];

// Referentiewoorden, elk één keer, in de aanleervolgorde.
export const WOORDEN = [...new Set(PATH_ORDER.map((l) => WORDS[l]))];

// Splitst een woord in oefenitems, langste klank eerst: 'school' -> sch, oo, l.
const BY_LENGTH = [...PATH_ORDER].sort((a, b) => b.length - a.length);
export function segment(word) {
  const out = [];
  let i = 0;
  while (i < word.length) {
    const hit = BY_LENGTH.find((it) => word.startsWith(it, i));
    if (hit) { out.push(hit); i += hit.length; } else i++;
  }
  return out;
}

// Tekengebied: hoogte van het schrijfvak in letter-coördinaten.
export const BOX_H = 300;
