#!/usr/bin/env node
/* Zet de Loblosch-schrijftrajecten (lopend blokschrift, syboor.eu) om naar
 * Letterpad-streekdata.
 *
 * Bron: tools/loblosch-anim/<letter>.svg (kleine letters en ij) en
 * U_<LETTER>.svg (hoofdletters en IJ) — de animatiepagina's van
 * https://syboor.eu/handschrift/trajecten/animatie_loblosch. Elke
 * <path id="stroke-…"> is één streek in schrijfrichting; data-dot="1" is
 * een puntje (i, j, ij), paden met id "overlap-…" zijn decor en vervallen.
 *
 * Animatiestelsel (y omhoog, hartlijnen van de streken): grondlijn 30,
 * romplijn 398, stok-top 684, staart-onderkant −256. Letterpad (y omlaag):
 * BL 210, XH 120, ASC 50, DSC 270. De romp schaalt exact (90/368); de
 * stok- en staartzone krijgen hun eigen factor zodat de hartlijnen precies
 * op onze liniatuur landen (staarten daardoor ~15% gedrongener dan in het
 * originele font).
 *
 * Gebruik: node tools/gen-strokes.mjs   → schrijft app/js/strokes.js
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, 'loblosch-anim');
const OUT = join(HERE, '..', 'app', 'js', 'strokes.js');

const BLA = 30, XTA = 398, ASCA = 684, DSCA = -256; // referenties in de animatie
const S = 90 / (XTA - BLA);  // rompfactor, ook voor x
const BEARING = 8;           // linker/rechter zijruimte in letterpad-eenheden

const fx = (n) => Math.round(n * 10) / 10;
function mapY(y) {
  if (y > XTA) return 120 - (y - XTA) * (70 / (ASCA - XTA));
  if (y < BLA) return 210 + (BLA - y) * (60 / (BLA - DSCA));
  return 210 - (y - BLA) * S;
}

/* SVG-paddata → absolute segmenten [{c:'M'|'L'|'C'|'Q', pts:[[x,y]…]}]. */
function parsePath(d) {
  const toks = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [];
  const segs = [];
  let i = 0, cmd = '', cur = [0, 0], start = [0, 0], prevC = null, prevQ = null;
  const num = () => parseFloat(toks[i++]);
  const isCmd = (t) => /^[A-Za-z]$/.test(t);
  while (i < toks.length) {
    if (isCmd(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const pt = () => { const x = num(), y = num(); return rel ? [cur[0] + x, cur[1] + y] : [x, y]; };
    switch (C) {
      case 'M': {
        cur = pt(); start = cur;
        segs.push({ c: 'M', pts: [cur] });
        cmd = rel ? 'l' : 'L'; // vervolgcoördinaten zijn lijnen
        prevC = prevQ = null;
        break;
      }
      case 'L': cur = pt(); segs.push({ c: 'L', pts: [cur] }); prevC = prevQ = null; break;
      case 'H': { const x = num(); cur = [rel ? cur[0] + x : x, cur[1]]; segs.push({ c: 'L', pts: [cur] }); prevC = prevQ = null; break; }
      case 'V': { const y = num(); cur = [cur[0], rel ? cur[1] + y : y]; segs.push({ c: 'L', pts: [cur] }); prevC = prevQ = null; break; }
      case 'C': { const c1 = pt(), c2 = pt(), p = pt(); segs.push({ c: 'C', pts: [c1, c2, p] }); cur = p; prevC = c2; prevQ = null; break; }
      case 'S': {
        const c1 = prevC ? [2 * cur[0] - prevC[0], 2 * cur[1] - prevC[1]] : cur;
        const c2 = pt(), p = pt();
        segs.push({ c: 'C', pts: [c1, c2, p] }); cur = p; prevC = c2; prevQ = null; break;
      }
      case 'Q': { const c1 = pt(), p = pt(); segs.push({ c: 'Q', pts: [c1, p] }); cur = p; prevQ = c1; prevC = null; break; }
      case 'T': {
        const c1 = prevQ ? [2 * cur[0] - prevQ[0], 2 * cur[1] - prevQ[1]] : cur;
        const p = pt();
        segs.push({ c: 'Q', pts: [c1, p] }); cur = p; prevQ = c1; prevC = null; break;
      }
      case 'Z': cur = start; segs.push({ c: 'L', pts: [cur] }); prevC = prevQ = null; break;
      default: throw new Error(`padcommando ${cmd} niet ondersteund`);
    }
  }
  return segs;
}

function strokesFromSvg(text, name) {
  const g = text.match(/<g class="strokes"[^>]*>([\s\S]*?)<\/g>/);
  if (!g) throw new Error(`${name}: geen strokes-groep`);
  const out = [];
  const re = /<path\b([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(g[1]))) {
    const attrs = m[1];
    const id = (attrs.match(/id="([^"]*)"/) || [])[1] || '';
    if (!id.startsWith('stroke')) continue;
    const d = (attrs.match(/d="([^"]*)"/) || [])[1];
    out.push({ segs: parsePath(d), dot: /data-dot="1"/.test(attrs) });
  }
  if (!out.length) throw new Error(`${name}: geen streken`);
  return out;
}

function convertLetter(strokes) {
  // Inktgrens in x over alle streken, dan naar letterpad-stelsel.
  let minX = Infinity, maxX = -Infinity;
  for (const st of strokes) for (const seg of st.segs) for (const [x] of seg.pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const mapP = ([x, y]) => [fx(BEARING + (x - minX) * S), fx(mapY(y))];
  const defs = strokes.map((st) => {
    if (st.dot) {
      const [x, y] = mapP(st.segs[0].pts[0]);
      return { d: `M ${fx(x - 4)} ${y} A 4 4 0 1 1 ${fx(x + 4)} ${y} A 4 4 0 1 1 ${fx(x - 4)} ${y}`, dot: true };
    }
    const d = st.segs.map((seg) => {
      const p = seg.pts.map(mapP);
      if (seg.c === 'M' || seg.c === 'L') return `${seg.c} ${p[0][0]} ${p[0][1]}`;
      if (seg.c === 'Q') return `Q ${p[0][0]} ${p[0][1]} ${p[1][0]} ${p[1][1]}`;
      return `C ${p[0][0]} ${p[0][1]} ${p[1][0]} ${p[1][1]} ${p[2][0]} ${p[2][1]}`;
    }).join(' ');
    return { d };
  });
  return { w: Math.round((maxX - minX) * S + 2 * BEARING), strokes: defs };
}

const lower = {}, upper = {};
for (const file of readdirSync(SRC).sort()) {
  if (!file.endsWith('.svg')) continue;
  const name = file.replace(/\.svg$/, '');
  const text = readFileSync(join(SRC, file), 'utf8');
  const def = convertLetter(strokesFromSvg(text, name));
  if (name.startsWith('U_')) upper[name.slice(2)] = def;
  else lower[name] = def;
}

const show = (obj) => Object.entries(obj).map(([k, v]) => {
  const strokes = v.strokes.map((s) => `    { d: '${s.d}'${s.dot ? ', dot: true' : ''} },`).join('\n');
  return `  ${/^[a-zA-Z]+$/.test(k) ? k : `'${k}'`}: { w: ${v.w}, strokes: [\n${strokes}\n  ]},`;
}).join('\n');

writeFileSync(OUT, `/* GEGENEREERD door tools/gen-strokes.mjs — niet met de hand bewerken.
 * Schrijftrajecten naar het lopend blokschrift (Loblosch, syboor.eu),
 * geschaald naar het Letterpad-stelsel (romp 120–210, staart tot 270).
 * Elke streek loopt in schrijfrichting; dot:true is een tik-puntje.
 */

export const lower = {
${show(lower)}
};

export const upper = {
${show(upper)}
};
`);
console.log(`geschreven: ${OUT} — ${Object.keys(lower).length} kleine letters, ${Object.keys(upper).length} hoofdletters`);
