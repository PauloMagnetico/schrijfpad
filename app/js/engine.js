/* Schrijfpad — teken- en beoordelingsmotor.
 * Bemonstert streekpaden tot polylijnen en beoordeelt wat de leerder tekent:
 * beginpunt, richting en volgorde tellen, de vorm mag ruim afwijken.
 */

import { LETTERS } from './letters.js';

const SAMPLE_STEP = 4; // afstand tussen monsterpunten, in letter-coördinaten

const sampleCache = new Map();
let measureSvg = null;

function getMeasureSvg() {
  if (!measureSvg) {
    measureSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    measureSvg.setAttribute('width', '0');
    measureSvg.setAttribute('height', '0');
    measureSvg.style.position = 'absolute';
    measureSvg.style.left = '-9999px';
    document.body.appendChild(measureSvg);
  }
  return measureSvg;
}

// Pad → { pts: [[x,y]…], len } in letter-coördinaten.
export function samplePath(d) {
  if (sampleCache.has(d)) return sampleCache.get(d);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  getMeasureSvg().appendChild(path);
  const len = path.getTotalLength();
  const n = Math.max(2, Math.ceil(len / SAMPLE_STEP));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const p = path.getPointAtLength((len * i) / n);
    pts.push([p.x, p.y]);
  }
  path.remove();
  const out = { pts, len };
  sampleCache.set(d, out);
  return out;
}

function dist(a, b) {
  const dx = a[0] - b[0], dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/* Groepeer de streken van een letter in vloeiende schrijfbewegingen: sluit
 * een streek aan op het eind van de vorige, dan blijft de pen op het blad
 * en vormen ze samen één beweging. Echte penliften blijven aparte groepen:
 * het puntje van de i/j, de streep van de t/f, en elke volgende deelletter
 * van een klank (newLetter). */
export function bewegingen(letter) {
  const strokes = LETTERS[letter].strokes;
  const groups = [];
  let g = null;
  strokes.forEach((s, i) => {
    const pts = samplePath(s.d).pts;
    const sluitAan = g && !g.dot && !s.dot && !s.newLetter
      && dist(pts[0], g.pts[g.pts.length - 1]) <= 3;
    if (!sluitAan) {
      g = { dot: !!s.dot, pts: [], members: [] };
      groups.push(g);
    }
    const from = g.pts.length ? 1 : 0; // gedeeld hoekpunt niet dubbel
    const startIdx = g.pts.length ? g.pts.length - 1 : 0;
    for (let k = from; k < pts.length; k++) g.pts.push(pts[k]);
    g.members.push({ stroke: i, from: startIdx, to: g.pts.length - 1 });
  });
  return groups;
}

/* Eén poging op één letter volgen. De eenheid is de schrijfbeweging (zie
 * bewegingen); de pen mag alleen van het blad tussen twee bewegingen.
 *
 * new Tracer(letter, { tolerance, startRadius })
 *   .beginStroke(pt)  → 'ok' | 'wrongStart'
 *   .move(pt)         → 'ok' | 'offPath' | 'backwards'
 *   .endStroke()      → 'done-stroke' | 'done-letter' | 'tooShort'
 * Houdt fouten bij voor de sterrenscore.
 */
export class Tracer {
  constructor(letter, opts = {}) {
    this.letter = letter;
    this.def = LETTERS[letter];
    this.tol = opts.tolerance || 30;
    this.startRadius = opts.startRadius || 34;
    this.groups = bewegingen(letter);
    this.groupIndex = 0;
    this.errors = { start: 0, direction: 0, offPath: 0, resets: 0 };
    this._loadGroup();
  }

  _loadGroup() {
    const g = this.groups[this.groupIndex];
    this.isDot = g ? g.dot : false;
    this.samples = { pts: g ? g.pts : [] };
    this.progress = 0;        // index in samples.pts tot waar al gevolgd is
    this.active = false;
    this._off = false;        // zijn we nu naast het pad?
  }

  get startPoint() { return this.samples.pts[0]; }
  get done() { return this.groupIndex >= this.groups.length; }

  // In welke streek van de letter zit de pen nu? (voor inktlaag en startbolletje)
  _member() {
    const g = this.groups[this.groupIndex];
    return g.members.find((m) => this.progress <= m.to) || g.members[g.members.length - 1];
  }
  get strokeIndex() {
    if (this.done) return this.def.strokes.length;
    return this._member().stroke;
  }

  beginStroke(p) {
    if (this.done) return 'ok';
    if (this.isDot) {
      const c = this._dotCenter();
      if (dist(p, c) <= this.startRadius + 8) { this.active = true; return 'ok'; }
      this.errors.start++;
      return 'wrongStart';
    }
    if (dist(p, this.startPoint) > this.startRadius) {
      this.errors.start++;
      return 'wrongStart';
    }
    this.active = true;
    this.progress = 0;
    return 'ok';
  }

  _dotCenter() {
    const pts = this.samples.pts;
    let sx = 0, sy = 0;
    for (const p of pts) { sx += p[0]; sy += p[1]; }
    return [sx / pts.length, sy / pts.length];
  }

  move(p) {
    if (!this.active || this.isDot) return 'ok';
    const pts = this.samples.pts;
    // Zoek het dichtstbijzijnde monsterpunt in een venster rond de voortgang.
    const lookAhead = Math.ceil(90 / SAMPLE_STEP);
    const lookBack = Math.ceil(50 / SAMPLE_STEP);
    const from = Math.max(0, this.progress - lookBack);
    const to = Math.min(pts.length - 1, this.progress + lookAhead);
    let best = -1, bestD = Infinity;
    for (let i = from; i <= to; i++) {
      const d = dist(p, pts[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (bestD > this.tol) {
      /* Even van het pad gewiebeld? Pik verderop weer aan in plaats van
       * vast te lopen: zoek ruim vooruit, en als de vinger daar weer bij de
       * lijn zit, schuift de voortgang mee. Zo blijft één uitschuiver in
       * een lange haal (de stok van een D) herstelbaar. */
      const far = Math.min(pts.length - 1, this.progress + Math.ceil(320 / SAMPLE_STEP));
      let b2 = -1, d2 = Infinity;
      for (let i = to + 1; i <= far; i++) {
        const d = dist(p, pts[i]);
        if (d < d2) { d2 = d; b2 = i; }
      }
      if (d2 <= this.tol) {
        if (!this._off) { this.errors.offPath++; this._off = true; }
        this.progress = b2;
        return 'ok';
      }
      if (!this._off) { this.errors.offPath++; this._off = true; }
      return 'offPath';
    }
    this._off = false;
    if (best < this.progress - Math.ceil(26 / SAMPLE_STEP)) {
      this.errors.direction++;
      return 'backwards';
    }
    if (best > this.progress) this.progress = best;
    return 'ok';
  }

  endStroke() {
    if (!this.active) return 'tooShort';
    this.active = false;
    if (this.isDot || this.progress >= (this.samples.pts.length - 1) * 0.9) {
      this.groupIndex++;
      if (this.done) return 'done-letter';
      this._loadGroup();
      return 'done-stroke';
    }
    // Te vroeg van het blad: de hele beweging opnieuw, vloeiend.
    this.errors.resets++;
    this.progress = 0;
    return 'tooShort';
  }

  // Hoe ver in de huidige streek, 0..1 (voor de groene inktlaag).
  fractionDone() {
    if (this.isDot) return this.active ? 1 : 0;
    const m = this._member();
    const span = m.to - m.from;
    if (span <= 0) return 1;
    return Math.min(1, Math.max(0, (this.progress - m.from) / span));
  }

  /* Sterren voor deze letter: beginpunt, richting en bij-de-lijn-blijven
   * tellen elk mee; kleine uitschuivers zijn gratis. */
  stars() {
    const e = this.errors;
    const weighted = e.start * 2 + e.direction * 1.5 + e.resets * 2 + Math.max(0, e.offPath - 4) * 0.5;
    if (weighted <= 1) return 3;
    if (weighted <= 6) return 2;
    return 1;
  }
}

/* Richtingstip voor feedback: waar moet de pen nu naartoe? */
export function nextHint(tracer) {
  if (tracer.done || tracer.isDot) return null;
  const pts = tracer.samples.pts;
  const i = Math.min(pts.length - 1, tracer.progress + Math.ceil(40 / SAMPLE_STEP));
  return pts[i];
}

/* Pointer-event → coördinaten van een (mogelijk getransformeerde) SVG-groep. */
export function svgPoint(svg, group, ev) {
  const p = svg.createSVGPoint();
  p.x = ev.clientX;
  p.y = ev.clientY;
  const m = (group || svg).getScreenCTM();
  if (!m) return [0, 0];
  const out = p.matrixTransform(m.inverse());
  return [out.x, out.y];
}
