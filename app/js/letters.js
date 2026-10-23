/* Letterpad — streekdata voor lopend blokschrift.
 *
 * Coördinatenstelsel (y naar beneden), gedeeld door alle letters:
 *   ASC  =  50  bovenlijn (stokletters, hoofdletters)
 *   XH   = 120  x-hoogte (romphoogte)
 *   BL   = 210  basislijn
 *   DSC  = 270  onderlijn (staartletters)
 * De breedte (w) verschilt per letter. Elke streek is een SVG-pad dat in de
 * schrijfrichting loopt; de volgorde van de strokes is de schrijfvolgorde.
 * Een streek met dot:true is een punt (tikken, niet slepen).
 */

export const GUIDES = { ASC: 50, XH: 120, BL: 210, DSC: 270 };

const ASC = 50, XH = 120, BL = 210, DSC = 270;
const R = 45;          // straal van de romp-cirkel (a, o, d, …)
const CY = (XH + BL) / 2; // 165, middelpunt van de romp

// Punt op een cirkel; hoek in graden, 0° = rechts, 90° = onder (y naar beneden).
function pt(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function fx(n) { return Math.round(n * 10) / 10; }

/* Cirkelboog van hoek a0 naar a1. ccw=true: tegen de klok in (hoek daalt),
 * zoals de romp van a/c/d/o wordt geschreven. Wordt opgesplitst in bogen
 * van ≤120° zodat de SVG-boogvlaggen eenduidig zijn. */
function arc(cx, cy, r, a0, a1, ccw, move) {
  let out = '';
  const [sx, sy] = pt(cx, cy, r, a0);
  if (move) out += `M ${fx(sx)} ${fx(sy)} `;
  const total = ccw ? a0 - a1 : a1 - a0;
  const steps = Math.max(1, Math.ceil(total / 120));
  for (let i = 1; i <= steps; i++) {
    const a = ccw ? a0 - (total * i) / steps : a0 + (total * i) / steps;
    const [x, y] = pt(cx, cy, r, a);
    out += `A ${r} ${r} 0 0 ${ccw ? 0 : 1} ${fx(x)} ${fx(y)} `;
  }
  return out;
}

// Uitzwaai (verbindingshaaltje) rechts op de basislijn, vanaf punt (x, BL).
function exit(x) {
  return `Q ${x + 2} ${BL + 8} ${x + 16} ${BL - 4}`;
}

// Punt (bolletje) van i en j: klein rondje om op te tikken.
function dot(x, y) {
  return { d: `M ${x - 4} ${y} A 4 4 0 1 1 ${x + 4} ${y} A 4 4 0 1 1 ${x - 4} ${y}`, dot: true };
}

/* ---- kleine letters -------------------------------------------------- */

// Romp tegen de klok in: start rechtsboven (−50°), rond tot aan de stok (0°).
function bowlCCW(cx) {
  return arc(cx, CY, R, -50, -360, true, true);
}

const lower = {
  a: { w: 108, strokes: [
    { d: bowlCCW(R) + `L 90 ${XH} L 90 ${BL} ` + exit(90) },
  ]},
  b: { w: 102, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL} L 10 ${CY} ` + arc(55, CY, R, 180, 450, false) },
  ]},
  c: { w: 92, strokes: [
    { d: arc(R, CY, R, -40, -320, true, true) },
  ]},
  d: { w: 108, strokes: [
    { d: bowlCCW(R) + `L 90 ${ASC} L 90 ${BL} ` + exit(90) },
  ]},
  e: { w: 92, strokes: [
    { d: `M 2 152 L 88 152 ` + arc(R, CY, R, -16.8, -320, true, false) },
  ]},
  f: { w: 72, strokes: [
    { d: `M 62 66 Q 60 ${ASC} 45 ${ASC} Q 28 ${ASC} 28 68 L 28 ${BL}` },
    { d: `M 6 ${XH} L 56 ${XH}` },
  ]},
  g: { w: 106, strokes: [
    { d: bowlCCW(R) + `L 90 ${XH} L 90 248 Q 90 ${DSC} 70 ${DSC} Q 54 ${DSC} 50 258` },
  ]},
  h: { w: 100, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL} L 10 156 C 10 126, 88 126, 88 156 L 88 ${BL} ` + exit(88) },
  ]},
  i: { w: 36, strokes: [
    { d: `M 16 ${XH} L 16 ${BL} ` + exit(16) },
    dot(16, 94),
  ]},
  j: { w: 56, strokes: [
    { d: `M 34 ${XH} L 34 248 Q 34 ${DSC} 16 ${DSC} Q 4 ${DSC} 2 260` },
    dot(34, 94),
  ]},
  k: { w: 94, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL}` },
    { d: `M 72 ${XH + 6} L 13 174 L 76 ${BL}` },
  ]},
  l: { w: 36, strokes: [
    { d: `M 16 ${ASC} L 16 ${BL} ` + exit(16) },
  ]},
  m: { w: 158, strokes: [
    { d: `M 10 ${XH} L 10 ${BL} L 10 152 C 10 124, 78 124, 78 152 L 78 ${BL} L 78 152 C 78 124, 146 124, 146 152 L 146 ${BL} ` + exit(146) },
  ]},
  n: { w: 100, strokes: [
    { d: `M 10 ${XH} L 10 ${BL} L 10 152 C 10 124, 88 124, 88 152 L 88 ${BL} ` + exit(88) },
  ]},
  o: { w: 96, strokes: [
    { d: arc(R, CY, R, -50, -410, true, true) + `Q 82 124 92 128` },
  ]},
  p: { w: 102, strokes: [
    { d: `M 10 ${XH} L 10 ${DSC} L 10 ${CY} ` + arc(55, CY, R, 180, 450, false) },
  ]},
  q: { w: 106, strokes: [
    { d: bowlCCW(R) + `L 90 ${XH} L 90 258 Q 90 ${DSC} 104 262` },
  ]},
  r: { w: 72, strokes: [
    { d: `M 10 ${XH} L 10 ${BL} L 10 154 C 10 126, 52 118, 64 134` },
  ]},
  s: { w: 84, strokes: [
    { d: `M 70 138 C 62 120, 20 116, 13 138 C 7 158, 68 160, 72 184 C 75 206, 24 214, 11 192` },
  ]},
  t: { w: 72, strokes: [
    { d: `M 28 84 L 28 194 Q 28 212 48 204` },
    { d: `M 6 ${XH} L 58 ${XH}` },
  ]},
  u: { w: 100, strokes: [
    { d: `M 10 ${XH} L 10 180 Q 10 ${BL} 46 ${BL} Q 88 ${BL} 88 178 L 88 ${XH} L 88 ${BL} ` + exit(88) },
  ]},
  v: { w: 92, strokes: [
    { d: `M 8 ${XH} L 46 ${BL} L 84 ${XH}` },
  ]},
  w: { w: 144, strokes: [
    { d: `M 6 ${XH} L 39 ${BL} L 70 ${XH} L 101 ${BL} L 134 ${XH}` },
  ]},
  x: { w: 92, strokes: [
    { d: `M 8 ${XH} L 84 ${BL}` },
    { d: `M 84 ${XH} L 8 ${BL}` },
  ]},
  y: { w: 100, strokes: [
    { d: `M 10 ${XH} L 10 178 Q 10 206 44 206 Q 78 206 86 184 L 88 ${XH} L 88 248 Q 88 ${DSC} 68 ${DSC} Q 54 ${DSC} 50 258` },
  ]},
  z: { w: 88, strokes: [
    { d: `M 8 ${XH} L 78 ${XH} L 8 ${BL} L 78 ${BL}` },
  ]},
};

// ij als eigen "letter" (Nederlands digraaf): i en j naast elkaar.
lower.ij = { w: 104, strokes: [
  { d: `M 16 ${XH} L 16 ${BL} ` + exit(16) },
  { d: `M 78 ${XH} L 78 248 Q 78 ${DSC} 60 ${DSC} Q 48 ${DSC} 46 260` },
  dot(16, 94),
  dot(78, 94),
]};

/* ---- hoofdletters ---------------------------------------------------- */

// Hoofdletter-ellips (C, G, O, Q): rx 55, ry 80, middelpunt (60, 130).
function capArc(a0, a1, ccw, move) {
  const rx = 55, ry = 80, cx = 60, cy = 130;
  const p = (deg) => {
    const a = (deg * Math.PI) / 180;
    return [fx(cx + rx * Math.cos(a)), fx(cy + ry * Math.sin(a))];
  };
  let out = '';
  const [sx, sy] = p(a0);
  if (move) out += `M ${sx} ${sy} `;
  const total = ccw ? a0 - a1 : a1 - a0;
  const steps = Math.max(1, Math.ceil(total / 120));
  for (let i = 1; i <= steps; i++) {
    const a = ccw ? a0 - (total * i) / steps : a0 + (total * i) / steps;
    const [x, y] = p(a);
    out += `A ${rx} ${ry} 0 0 ${ccw ? 0 : 1} ${x} ${y} `;
  }
  return out;
}

const upper = {
  A: { w: 116, strokes: [
    { d: `M 56 ${ASC} L 10 ${BL}` },
    { d: `M 56 ${ASC} L 102 ${BL}` },
    { d: `M 28 152 L 84 152` },
  ]},
  B: { w: 102, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL}` },
    { d: `M 10 ${ASC} C 78 ${ASC}, 78 128, 10 128 C 86 128, 86 ${BL}, 10 ${BL}` },
  ]},
  C: { w: 122, strokes: [
    { d: capArc(-38, -322, true, true) },
  ]},
  D: { w: 112, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL}` },
    { d: `M 10 ${ASC} C 100 ${ASC}, 100 ${BL}, 10 ${BL}` },
  ]},
  E: { w: 100, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL}` },
    { d: `M 10 ${ASC} L 92 ${ASC}` },
    { d: `M 10 130 L 78 130` },
    { d: `M 10 ${BL} L 92 ${BL}` },
  ]},
  F: { w: 100, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL}` },
    { d: `M 10 ${ASC} L 92 ${ASC}` },
    { d: `M 10 130 L 74 130` },
  ]},
  G: { w: 122, strokes: [
    { d: capArc(-38, -322, true, true) + `L 115 158 L 68 158` },
  ]},
  H: { w: 112, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL}` },
    { d: `M 102 ${ASC} L 102 ${BL}` },
    { d: `M 10 130 L 102 130` },
  ]},
  I: { w: 36, strokes: [
    { d: `M 16 ${ASC} L 16 ${BL}` },
  ]},
  J: { w: 90, strokes: [
    { d: `M 72 ${ASC} L 72 182 Q 72 ${BL} 46 ${BL} Q 24 ${BL} 20 190` },
  ]},
  K: { w: 104, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL}` },
    { d: `M 96 ${ASC} L 13 136 L 96 ${BL}` },
  ]},
  L: { w: 96, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL} L 88 ${BL}` },
  ]},
  M: { w: 128, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL}` },
    { d: `M 10 ${ASC} L 60 162 L 110 ${ASC}` },
    { d: `M 110 ${ASC} L 110 ${BL}` },
  ]},
  N: { w: 116, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL}` },
    { d: `M 10 ${ASC} L 104 ${BL} L 104 ${ASC}` },
  ]},
  O: { w: 122, strokes: [
    { d: capArc(-50, -410, true, true) },
  ]},
  P: { w: 100, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL}` },
    { d: `M 10 ${ASC} C 86 ${ASC}, 86 136, 10 136` },
  ]},
  Q: { w: 124, strokes: [
    { d: capArc(-50, -410, true, true) },
    { d: `M 80 172 L 116 216` },
  ]},
  R: { w: 106, strokes: [
    { d: `M 10 ${ASC} L 10 ${BL}` },
    { d: `M 10 ${ASC} C 86 ${ASC}, 86 136, 10 136` },
    { d: `M 52 138 L 98 ${BL}` },
  ]},
  S: { w: 112, strokes: [
    { d: `M 94 78 C 80 48, 22 50, 16 82 C 10 114, 96 116, 100 160 C 104 200, 28 218, 10 180` },
  ]},
  T: { w: 112, strokes: [
    { d: `M 56 ${ASC} L 56 ${BL}` },
    { d: `M 6 ${ASC} L 106 ${ASC}` },
  ]},
  U: { w: 112, strokes: [
    { d: `M 10 ${ASC} L 10 158 Q 10 ${BL} 55 ${BL} Q 100 ${BL} 100 158 L 100 ${ASC}` },
  ]},
  V: { w: 112, strokes: [
    { d: `M 8 ${ASC} L 56 ${BL} L 104 ${ASC}` },
  ]},
  W: { w: 146, strokes: [
    { d: `M 6 ${ASC} L 39 ${BL} L 71 ${ASC} L 103 ${BL} L 136 ${ASC}` },
  ]},
  X: { w: 108, strokes: [
    { d: `M 10 ${ASC} L 98 ${BL}` },
    { d: `M 98 ${ASC} L 10 ${BL}` },
  ]},
  Y: { w: 112, strokes: [
    { d: `M 8 ${ASC} L 56 134` },
    { d: `M 104 ${ASC} L 56 134 L 56 ${BL}` },
  ]},
  Z: { w: 108, strokes: [
    { d: `M 10 ${ASC} L 98 ${ASC} L 10 ${BL} L 98 ${BL}` },
  ]},
};

export const LETTERS = Object.assign({}, lower, upper);

// Voorbeeldwoord en (waar nuttig) klankzin per kleine letter.
export const WORDS = {
  a: 'appel', b: 'bus', c: 'citroen', d: 'deur', e: 'ezel', f: 'fiets',
  g: 'geit', h: 'huis', i: 'inkt', j: 'jas', k: 'kat', l: 'lamp',
  m: 'maan', n: 'neus', o: 'oog', p: 'pen', q: 'quiz', r: 'roos',
  s: 'sok', t: 'tas', u: 'uil', v: 'vis', w: 'wolk', x: 'xylofoon',
  y: 'yoghurt', z: 'zon', ij: 'ijs',
};

// Leerpad: volgorde op motorische moeilijkheid, niet a–z.
export const PATH_ORDER = [
  'i', 'l', 't', 'a', 'o', 'd', 'e', 'u', 'n', 'm', 'r', 'h', 'b', 'p',
  'v', 'w', 'c', 's', 'g', 'j', 'y', 'f', 'k', 'x', 'z', 'ij',
];

export const VOWELS = ['a', 'e', 'i', 'o', 'u'];

// Tekengebied: hoogte van het schrijfvak in letter-coördinaten.
export const BOX_H = 300;
