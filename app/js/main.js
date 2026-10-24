/* Schrijfpad — schermen en routering. Eén pagina, hash-routes:
 * #start #join #home #watch #trace #write #teacher
 */

import { LETTERS, WORDS, PATH_ORDER, WOORDEN, segment, GUIDES, BOX_H } from './letters.js';
import { Tracer, samplePath, svgPoint, nextHint } from './engine.js';
import { Session } from './net.js';

const { ASC, XH, BL, DSC } = GUIDES;
const app = document.getElementById('app');

/* ---------- toestand (fase 1: niets wordt bewaard) ------------------- */
const store = {
  mode: 'solo',            // 'solo' | 'session'
  name: '', code: '',
  session: null,           // Session (leerder) of null
  assignment: null,        // { letters, slant, lines } van de leerkracht
  lines: 4, slant: false,  // weergave: komt in een sessie van de leerkracht
  help: 'start',           // hulp bij het schrijven: 'dots' | 'start' | 'none'
  progress: {},            // letter -> { stars }
  currentLetter: null,
  anim: null,              // lopende animatie (om te stoppen)
  soloLetters: null,       // letters van de gekozen oefenwoorden (alleen oefenen)
  soloVorm: null,          // oefenvorm: 'leerpad' of 'geheugen'
  oefenModus: 'woorden',   // oefenpagina: 'letters' of 'woorden' kiezen
  oefenWoorden: [],        // aangeduide referentiewoorden op de oefenpagina
  oefenLetters: [],        // aangeduide losse letters/klanken op de oefenpagina
};

function letterList() {
  if (store.mode === 'session' && store.assignment && store.assignment.letters.length) {
    return store.assignment.letters;
  }
  if (store.mode === 'solo' && store.soloLetters) return store.soloLetters;
  return PATH_ORDER;
}
function nextLetter() {
  return letterList().find((l) => !store.progress[l]) || letterList()[0];
}
function wordFor(letter) { return WORDS[letter.toLowerCase()] || ''; }
// De geoefende letter telkens vet in het voorbeeldwoord.
function wordMarkup(letter) {
  const l = letter.toLowerCase();
  return wordFor(letter).split(l).join(`<b>${l}</b>`);
}
// Referentiewoord ("a van tas") boven de oefening, de klank vet gedrukt.
function refWord(letter) {
  const w = wordMarkup(letter);
  return w ? `<div class="letterfont" style="text-align:center; font-size:28px; padding:0 20px 6px">${w}</div>` : '';
}

/* ---------- kleine hulpjes -------------------------------------------- */
function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------- pictogrammen ---------------------------------------------- */
function icon(name, size = 24, color = 'currentColor', sw = 2) {
  const paths = {
    speaker: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    qr: '<path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3"/><rect x="7" y="7" width="4" height="4"/><rect x="13" y="13" width="4" height="4"/><path d="M13 7h4v3M7 17v-3h3"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    redo: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    slow: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M10 2h4"/>',
    eraser: '<path d="m7 21-4-4 11-11 7 7-7 8z"/><path d="M10 21h11"/><path d="m9 10 6 6"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    checkcircle: '<circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    path: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    shift: '<path d="M12 3 3 12h5v8h8v-8h5z"/>',
    screen: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    zon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    blad: '<path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15z"/><path d="M5 19 13 11"/>',
    ster: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    geheugen: '<path d="M9 22v-3.2C6.6 17.3 5 14.8 5 12a7 7 0 0 1 14 0c0 .9-.2 1.8-.5 2.6l1.5 2.4-2 .6V22"/><g stroke-width="1.4"><circle cx="10" cy="9.6" r="2.2"/><circle cx="10" cy="9.6" r="0.7"/><path d="M12.2 9.6h1.1M7.8 9.6H6.7M11.1 11.5l.55.96M8.9 7.7l-.55-.96M8.9 11.5l-.55.96M11.1 7.7l.55-.96"/><circle cx="14.2" cy="13" r="1.7"/><circle cx="14.2" cy="13" r="0.6"/><path d="M15.4 14.2l.64.64M13 14.2l-.64.64M13 11.8l-.64-.64M15.4 11.8l.64-.64"/></g>',
    maan: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    bloem: '<circle cx="12" cy="12" r="3"/><path d="M12 9a3 3 0 1 0-3-3 3 3 0 1 0-3 3 3 3 0 1 0 3 3 3 3 0 1 0 3 3 3 3 0 1 0 3-3 3 3 0 1 0 3-3 3 3 0 1 0-3-3 3 3 0 0 0-3 3"/>',
    wolk: '<path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.5 2A4 4 0 0 0 7 19z"/>',
    vis: '<path d="M6.5 12c2-3.5 5-5 11.5-5-1 2-1 8 0 10-6.5 0-9.5-1.5-11.5-5z"/><path d="M6.5 12 2 8v8z"/><circle cx="14" cy="11" r="1"/>',
    hart: '<path d="M12 21 4.3 13.3a5 5 0 0 1 7-7.1l.7.7.7-.7a5 5 0 0 1 7 7.1z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

/* ---------- letters tekenen ------------------------------------------- */

// Hulplijnen over de volledige breedte van het vak.
function guidesMarkup(vbW, lines, slant) {
  let out = '';
  if (lines >= 2) out += `<rect x="0" y="${XH}" width="${vbW}" height="${BL - XH}" fill="#EEF3FF"/>`;
  if (lines >= 4) {
    out += `<line x1="0" y1="${ASC}" x2="${vbW}" y2="${ASC}" stroke="#C7D0DE" stroke-width="1.5" stroke-dasharray="6 6"/>`;
    out += `<line x1="0" y1="${DSC}" x2="${vbW}" y2="${DSC}" stroke="#C7D0DE" stroke-width="1.5" stroke-dasharray="6 6"/>`;
  }
  if (lines >= 2) out += `<line x1="0" y1="${XH}" x2="${vbW}" y2="${XH}" stroke="#9AA7BC" stroke-width="1.5"/>`;
  out += `<line x1="0" y1="${BL}" x2="${vbW}" y2="${BL}" stroke="#172033" stroke-width="2"/>`;
  if (slant) {
    for (let x = 40; x < vbW + 60; x += 90) {
      out += `<line x1="${x}" y1="${BL + 14}" x2="${x + 24}" y2="${ASC - 14}" stroke="#D9E0EB" stroke-width="1.5"/>`;
    }
  }
  return out;
}

// Zichtbaar venster van het vak: zoom in op de letter zodat die zo groot
// mogelijk is; CSS (max-height op .drawbox svg) houdt het vak op het scherm.
function viewBoxFor(vbW, w) {
  const vis = Math.min(vbW, Math.max(w + 70, 260));
  return `${((vbW - vis) / 2).toFixed(1)} 0 ${vis} ${BOX_H}`;
}

// Transform voor een lettergroep: centreren + eventueel schuin (−8°).
function letterTransform(vbW, w, slant, scale = 1) {
  const ox = (vbW - w * scale) / 2;
  const sk = slant ? ` matrix(1,0,-0.1405,1,${(0.1405 * BL).toFixed(1)},0)` : '';
  return `translate(${ox},0)${sk}${scale !== 1 ? ` scale(${scale})` : ''}`;
}

function strokePaths(letter, attrs) {
  return LETTERS[letter].strokes
    .map((s) => `<path d="${s.d}" fill="none" ${attrs(s)}/>`)
    .join('');
}

// Startpunt (oranje bolletje met nummer) van streek i.
function startDotMarkup(letter, i, pulse) {
  const s = LETTERS[letter].strokes[i];
  const { pts } = samplePath(s.d);
  let [x, y] = pts[0];
  if (s.dot) { x = pts[Math.floor(pts.length / 2)][0]; y = pts[0][1]; }
  const n = LETTERS[letter].strokes.length > 1 ? `<text x="${x}" y="${y + 5}" text-anchor="middle" font-family="Atkinson Hyperlegible, sans-serif" font-size="15" font-weight="700" fill="#FFFFFF">${i + 1}</text>` : '';
  return `<g class="${pulse ? 'pulse' : ''}"><circle cx="${x}" cy="${y}" r="14" fill="#C25E00"/>${n}</g>`;
}

/* ---------- voortgang melden aan de leerkracht ------------------------- */
function report(letter, step, stars) {
  if (store.mode === 'session' && store.session) store.session.progress(letter, step, stars || 0);
}

/* ====================================================================== */
/* Schermen                                                               */
/* ====================================================================== */

// Gevulde silhouetten voor het startscherm: op kaartformaat duidelijker
// dan lijn-iconen. De voorste persoon krijgt een randje in de kaartkleur
// zodat de groep leesbaar blijft waar de silhouetten overlappen.
function personFilled(size, color) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" aria-hidden="true"><circle cx="12" cy="7" r="4.2"/><path d="M4.5 21v-1.2c0-3.4 3.4-6 7.5-6s7.5 2.6 7.5 6V21z"/></svg>`;
}
function groupFilled(size, color, edge) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" aria-hidden="true">
    <circle cx="4.9" cy="8.8" r="2.8"/><path d="M.8 20v-.8c0-2.4 1.8-4.1 4.1-4.1s4.1 1.7 4.1 4.1v.8z"/>
    <circle cx="19.1" cy="8.8" r="2.8"/><path d="M15 20v-.8c0-2.4 1.8-4.1 4.1-4.1s4.1 1.7 4.1 4.1v.8z"/>
    <g stroke="${edge}" stroke-width="1.6"><circle cx="12" cy="6.8" r="3.9"/><path d="M6 21v-1c0-3.2 2.6-5.5 6-5.5s6 2.3 6 5.5v1z"/></g>
  </svg>`;
}

// Logo: de schrijfletter a, overtrokken door een schuine hand met
// wijsvinger. De vingertop raakt precies het staarteinde van de letterlijn.
function logoMarkup(height) {
  const w = Math.round((height * 176) / 196);
  return `<svg width="${w}" height="${height}" viewBox="112 100 176 196" aria-hidden="true">
    <path d="M 197 125.6 C 186.3 120 175.8 120 170.6 120 C 158 120 147.7 124.5 140 134.7 C 134.9 141.5 131 151.5 131 165 C 131 178.9 133.2 188.2 138.3 196.5 C 143.9 205.6 149.8 210 160.8 210 C 169.8 210 179.3 205.3 185.4 196.8 C 191.8 187.9 197 182.9 197 165 L 197 125.6 M 197 125.6 L 197 196.8 C 197 206.1 200.5 210 206.8 210 C 213.4 210 219 201.4 219 201.4" fill="none" stroke="#2357D9" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <g transform="rotate(32 219 201)">
      <path d="M 210 210 a 9 9 0 0 1 18 0 v 26 c 1 -6 11 -6 12 0 c 1 -6 11 -6 12 0 c 1 -5 9 -5 10 0 v 14 a 20 20 0 0 1 -20 20 h -14 a 22 22 0 0 1 -22 -22 z" fill="#172033" stroke="#fff" stroke-width="7" stroke-linejoin="round" paint-order="stroke"/>
    </g>
  </svg>`;
}

function screenStart() {
  const s = h(`<div class="screen">
    <div class="topbar"><span></span></div>
    <div style="padding: 12px 24px 0; display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center">
      ${logoMarkup(110)}
      <h1 style="font-size:30px">Schrijfpad</h1>
      <p style="font-size:17px; color:var(--muted)">Leer schrijven, letter per letter.</p>
    </div>
    <div style="padding:36px 20px 0; display:flex; flex-direction:column; gap:14px">
      <a href="#oefen" id="solo" aria-label="Alleen oefenen" style="min-height:128px; padding:20px; box-sizing:border-box; border-radius:24px; background:var(--primary); color:#fff; text-decoration:none; display:flex; align-items:center; justify-content:center">
        ${personFilled(76, '#fff')}
      </a>
      <a href="#join" aria-label="Aansluiten bij een sessie" style="min-height:128px; padding:20px; box-sizing:border-box; border-radius:24px; background:#fff; border:2px solid var(--border); color:var(--ink); text-decoration:none; display:flex; align-items:center; justify-content:center">
        ${groupFilled(84, '#2357D9', '#fff')}
      </a>
    </div>
    <div style="margin-top:auto; padding:16px 20px 32px; display:flex; justify-content:center">
      <a href="#teacher" style="min-height:48px; display:flex; align-items:center; font-size:17px; color:var(--muted)">Sessie starten · Ik ben leerkracht</a>
    </div>
  </div>`);
  s.querySelector('#solo').addEventListener('click', () => { store.mode = 'solo'; });
  return s;
}

/* ---------- aansluiten -------------------------------------------------- */
function screenJoin() {
  let code = store.code || '';
  const s = h(`<div class="screen">
    <div class="topbar">
      <a class="iconbtn" href="#start" aria-label="Terug naar het startscherm">${icon('back')}</a>
      <span id="spk"></span>
    </div>
    <div style="padding:8px 20px 0; display:flex; flex-direction:column; gap:6px">
      <h1 style="font-size:26px">Aansluiten</h1>
    </div>
    <div class="card" style="margin:18px 20px 0; display:flex; flex-direction:column; gap:14px">
      <div id="keuze" style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
        <button id="scan" style="display:none; min-height:88px; border-radius:16px; border:2px solid var(--border); background:#fff; color:var(--ink); font-family:inherit; font-size:15px; font-weight:700; cursor:pointer; flex-direction:column; align-items:center; justify-content:center; gap:8px">${icon('qr', 30, '#2357D9')}<span>Scan de QR-code</span></button>
        <button id="typ" style="min-height:88px; border-radius:16px; border:2px solid var(--border); background:#fff; color:var(--ink); font-family:inherit; font-size:15px; font-weight:700; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px"><span class="letterfont" style="font-size:24px; line-height:1; color:var(--primary)">123</span><span>Typ de code</span></button>
      </div>
      <div class="codeboxes" id="boxes" role="button" tabindex="0" aria-label="Sessiecode, zes cijfers" style="display:none"></div>
      <input id="codeinput" inputmode="numeric" autocomplete="one-time-code" maxlength="6"
        style="position:absolute; width:1px; height:1px; opacity:0" aria-label="Sessiecode">
    </div>
    <div class="card" style="margin:16px 20px 0; display:flex; flex-direction:column; gap:14px">
      <div style="display:flex; flex-direction:column; gap:6px">
        <label for="voornaam" style="font-size:15px; color:var(--muted)">Voornaam</label>
        <input id="voornaam" class="textfield" autocomplete="given-name" value="${esc(store.name)}">
      </div>
    </div>
    <div class="bottombar" style="flex-direction:column; gap:8px">
      <button id="go" class="btn primary" aria-label="Aansluiten">${icon('arrow', 30, 'currentColor', 2.5)}</button>
      <a href="#oefen" id="solo" style="min-height:48px; display:flex; align-items:center; justify-content:center; font-size:16px">Alleen oefenen</a>
    </div>
    <video id="qrvideo" style="display:none"></video>
  </div>`);

  const boxes = s.querySelector('#boxes');
  const input = s.querySelector('#codeinput');
  const scanBtn = s.querySelector('#scan');
  const typBtn = s.querySelector('#typ');
  input.value = code;
  function showBoxes() { boxes.style.display = 'grid'; }
  function choose(btn) {
    [scanBtn, typBtn].forEach((b) => {
      const on = b === btn;
      b.setAttribute('aria-pressed', String(on));
      b.style.borderColor = on ? 'var(--primary)' : 'var(--border)';
      b.style.background = on ? 'var(--primary-soft)' : '#fff';
    });
  }
  function renderBoxes() {
    boxes.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      boxes.appendChild(h(`<span class="${i === Math.min(code.length, 5) ? 'active' : ''}">${code[i] || ''}</span>`));
    }
  }
  renderBoxes();
  boxes.addEventListener('click', () => input.focus());
  input.addEventListener('input', () => {
    code = input.value.replace(/\D/g, '').slice(0, 6);
    input.value = code;
    renderBoxes();
  });

  // QR scannen: alleen als de browser het kan. De camera opent pas wanneer
  // de leerling zelf voor "Scan de QR-code" kiest.
  const canScan = 'BarcodeDetector' in window && navigator.mediaDevices;
  async function startScan() {
    const video = s.querySelector('#qrvideo');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;
      video.style.cssText = 'display:block; position:fixed; inset:0; width:100%; height:100%; object-fit:cover; z-index:60';
      await video.play();
      const sluit = h(`<button class="iconbtn" aria-label="Camera sluiten" style="position:fixed; top:20px; right:16px; z-index:61">${icon('close')}</button>`);
      document.body.appendChild(sluit);
      const det = new BarcodeDetector({ formats: ['qr_code'] });
      const stopCam = () => {
        stream.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
        video.style.display = 'none';
        sluit.remove();
        removeEventListener('hashchange', stopCam);
      };
      sluit.addEventListener('click', stopCam, { once: true });
      video.addEventListener('click', stopCam, { once: true });
      addEventListener('hashchange', stopCam);
      const tick = async () => {
        if (!video.srcObject || video.style.display === 'none') return;
        try {
          const codes = await det.detect(video);
          for (const c of codes) {
            const m = c.rawValue.match(/(\d{6})/);
            if (m) { code = m[1]; input.value = code; showBoxes(); renderBoxes(); stopCam(); return; }
          }
        } catch { /* volgende poging */ }
        requestAnimationFrame(tick);
      };
      tick();
    } catch { toast('Camera niet beschikbaar'); }
  }
  // Op een computer telt een getypt cijfer meteen mee, zonder eerst het
  // cijfervak aan te klikken; het naamveld houdt zijn eigen invoer (na klik).
  // Enter sluit aan zodra code en naam zijn ingevuld.
  function globalKeys(ev) {
    if (!document.body.contains(s)) { removeEventListener('keydown', globalKeys); return; }
    if (ev.key === 'Enter') { ev.preventDefault(); s.querySelector('#go').click(); return; }
    const t = ev.target;
    if (t === input || (t && t.id === 'voornaam')) return;
    if (/^\d$/.test(ev.key)) {
      choose(typBtn); showBoxes();
      code = (code + ev.key).slice(0, 6);
      input.value = code;
      renderBoxes();
      ev.preventDefault();
    } else if (ev.key === 'Backspace') {
      code = code.slice(0, -1);
      input.value = code;
      renderBoxes();
      ev.preventDefault();
    }
  }
  addEventListener('keydown', globalKeys);

  typBtn.addEventListener('click', () => { choose(typBtn); showBoxes(); input.focus(); });
  if (canScan) {
    scanBtn.style.display = 'flex';
    scanBtn.addEventListener('click', () => { choose(scanBtn); startScan(); });
  } else {
    // Zonder QR-ondersteuning valt er niets te kiezen: meteen de code typen.
    s.querySelector('#keuze').style.display = 'none';
    showBoxes();
  }
  if (code) showBoxes();

  s.querySelector('#solo').addEventListener('click', () => { store.mode = 'solo'; });
  s.querySelector('#go').addEventListener('click', async () => {
    const name = s.querySelector('#voornaam').value.trim();
    if (code.length !== 6) { toast('Typ de code van 6 cijfers'); showBoxes(); input.focus(); return; }
    if (!name) { toast('Typ je voornaam'); s.querySelector('#voornaam').focus(); return; }
    store.name = name;
    store.code = code;
    const ses = new Session();
    ses.on('joined', (msg) => {
      store.mode = 'session';
      store.session = ses;
      store.assignment = msg.assignment || null;
      store.progress = {};
      if (store.assignment) {
        store.lines = store.assignment.lines;
        store.slant = store.assignment.slant;
        store.help = store.assignment.help || 'start';
      }
      toast('Aangesloten!');
      location.hash = '#home';
    });
    ses.on('badCode', () => { toast('Die code klopt niet. Vraag het nog eens.'); });
    ses.on('assign', (msg) => {
      store.assignment = { letters: msg.letters, slant: msg.slant, lines: msg.lines, help: msg.help };
      store.lines = msg.lines; store.slant = msg.slant; store.help = msg.help || 'start';
      store.progress = {};
      toast('Nieuwe opdracht van de leerkracht');
      if (location.hash === '#home') render(); else location.hash = '#home';
    });
    ses.on('ended', () => {
      toast('De sessie is gestopt');
      store.mode = 'solo'; store.session = null; store.assignment = null;
      ses.close();
      render();
    });
    ses.on('disconnected', () => toast('Verbinding kwijt, opnieuw proberen…'));
    try {
      await ses.connect();
      ses.join(code, name);
    } catch { toast('Geen verbinding met de server'); }
  });
  return s;
}

/* ---------- alleen oefenen: letters of woorden kiezen --------------------- */
// Individuele oefensessie (geen leerpad): de leerling kiest bovenaan met
// een icoontje voor losse letters ("a") of woorden ("tas"), duidt er één
// of meer aan en gaat met de blauwe Volgende-knop naar de aparte
// typekeuzepagina (#oefentype).
function screenOefen() {
  let modus = store.oefenModus || 'woorden';
  let gekozenW = [...(store.oefenWoorden || [])];
  let gekozenL = [...(store.oefenLetters || [])];
  const s = h(`<div class="screen">
    <div class="topbar">
      <a class="iconbtn" href="#start" aria-label="Terug naar het startscherm">${icon('back')}</a>
      <button id="volgende" class="iconbtn" aria-label="Volgende" style="background:var(--primary); color:#fff; opacity:.45; pointer-events:none">${icon('arrow', 26, 'currentColor', 2.5)}</button>
    </div>
    <div style="padding:8px 20px 0">
      <!-- Schakelaar, duidelijk anders dan de keuzeknoppen eronder. -->
      <div role="group" aria-label="Wat wil je oefenen?" style="display:grid; grid-template-columns:1fr 1fr; border:2px solid var(--primary); border-radius:28px; overflow:hidden; background:#fff">
        <button id="kiesletters" aria-label="Letters oefenen" class="letterfont" style="min-height:52px; font-size:26px; line-height:1; border:none; background:transparent; cursor:pointer">a</button>
        <button id="kieswoorden" aria-label="Woorden oefenen" class="letterfont" style="min-height:52px; font-size:22px; line-height:1; border:none; background:transparent; cursor:pointer">tas</button>
      </div>
    </div>
    <div id="inhoud" style="padding:18px 20px 24px"></div>
  </div>`);
  const inhoud = s.querySelector('#inhoud');
  const volgende = s.querySelector('#volgende');
  const kiesL = s.querySelector('#kiesletters');
  const kiesW = s.querySelector('#kieswoorden');
  // Terug op de keuzepagina: een eventueel lopende woordoefening vervalt.
  store.soloLetters = null;
  store.currentLetter = null;

  const selectie = () => (modus === 'letters' ? gekozenL : gekozenW);
  function updateVolgende() {
    const aan = selectie().length > 0;
    volgende.style.opacity = aan ? '1' : '.45';
    volgende.style.pointerEvents = aan ? 'auto' : 'none';
  }

  function toggleKnop(b, on) {
    b.setAttribute('aria-pressed', String(on));
    b.style.background = on ? 'var(--primary)' : '';
    b.style.color = on ? '#fff' : '';
  }
  // De schakelaar zelf: gevulde helft = actief, andere helft wit met blauwe letter.
  function modusKnop(b, on) {
    b.setAttribute('aria-pressed', String(on));
    b.style.background = on ? 'var(--primary)' : 'transparent';
    b.style.color = on ? '#fff' : 'var(--primary)';
  }

  function renderRaster() {
    modusKnop(kiesL, modus === 'letters');
    modusKnop(kiesW, modus === 'woorden');
    updateVolgende();
    inhoud.innerHTML = '';
    if (modus === 'letters') {
      // Losse letters en klanken in de aanleervolgorde.
      const grid = h('<div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:8px"></div>');
      PATH_ORDER.forEach((l) => {
        const b = h(`<button class="card letterfont" style="min-height:56px; padding:0; font-size:28px; line-height:1; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center">${l}</button>`);
        const kleur = () => toggleKnop(b, gekozenL.includes(l));
        kleur();
        b.addEventListener('click', () => {
          gekozenL = gekozenL.includes(l) ? gekozenL.filter((x) => x !== l) : [...gekozenL, l];
          kleur(); updateVolgende();
        });
        grid.appendChild(b);
      });
      inhoud.appendChild(grid);
      return;
    }
    // Overzichtelijk raster: alle woordknoppen even groot, zelfde letter.
    const grid = h('<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px"></div>');
    WOORDEN.forEach((w) => {
      const b = h(`<button class="card letterfont" style="min-height:60px; padding:0 8px; font-size:min(32px, 8.5vw); line-height:1; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center">${w}</button>`);
      const kleur = () => toggleKnop(b, gekozenW.includes(w));
      kleur();
      b.addEventListener('click', () => {
        gekozenW = gekozenW.includes(w) ? gekozenW.filter((x) => x !== w) : [...gekozenW, w];
        kleur(); updateVolgende();
      });
      grid.appendChild(b);
    });
    inhoud.appendChild(grid);
  }

  kiesL.addEventListener('click', () => { modus = 'letters'; renderRaster(); });
  kiesW.addEventListener('click', () => { modus = 'woorden'; renderRaster(); });
  renderRaster();

  volgende.addEventListener('click', () => {
    if (!selectie().length) return;
    store.oefenModus = modus;
    store.oefenWoorden = gekozenW;
    store.oefenLetters = gekozenL;
    location.hash = '#oefentype';
  });
  return s;
}

/* ---------- alleen oefenen: type oefening -------------------------------- */
// Aparte pagina: het type oefening voor de gekozen woorden. "Letters" is
// actief; de andere tegels werkt de lesgever hier verder uit.
// Woord met de opgegeven letters/klanken vet (langste eerst, zodat 'aa'
// niet door 'a' doorbroken wordt).
function markeerLetters(woord, letters) {
  const vet = new Array(woord.length).fill(false);
  [...letters].sort((a, b) => b.length - a.length).forEach((l) => {
    let i = woord.indexOf(l);
    while (i >= 0) {
      for (let k = i; k < i + l.length; k++) vet[k] = true;
      i = woord.indexOf(l, i + l.length);
    }
  });
  let uit = '';
  let open = false;
  for (let i = 0; i < woord.length; i++) {
    if (vet[i] && !open) { uit += '<b>'; open = true; }
    if (!vet[i] && open) { uit += '</b>'; open = false; }
    uit += esc(woord[i]);
  }
  return open ? `${uit}</b>` : uit;
}

function screenOefenType() {
  const modus = store.oefenModus || 'woorden';
  // Oefenrij: de gekozen letters, of de letters en klanken van alle
  // gekozen woorden, zonder dubbels.
  const rij = [];
  if (modus === 'letters') rij.push(...(store.oefenLetters || []));
  else (store.oefenWoorden || []).forEach((w) => segment(w).forEach((l) => { if (!rij.includes(l)) rij.push(l); }));
  if (!rij.length) { location.hash = '#oefen'; return h('<div class="screen"></div>'); }
  // Kop: bij losse letters tonen we hun referentiewoorden met de gekozen
  // letter(s) vet; bij woorden gewoon de gekozen woorden.
  let kopHtml;
  if (modus === 'letters') {
    const perWoord = [];
    rij.forEach((l) => {
      const w = wordFor(l);
      let e = perWoord.find((x) => x.w === w);
      if (!e) { e = { w, ls: [] }; perWoord.push(e); }
      e.ls.push(l);
    });
    kopHtml = perWoord.map(({ w, ls }) => markeerLetters(w, ls)).join(', ');
  } else {
    kopHtml = esc((store.oefenWoorden || []).join(', '));
  }

  const s = h(`<div class="screen">
    <div class="topbar">
      <a class="iconbtn" href="#oefen" aria-label="Terug naar de keuze">${icon('back')}</a>
      <span style="width:48px"></span>
    </div>
    <div style="padding:8px 20px 0">
      <h1 style="font-size:24px"><span class="letterfont">${kopHtml}</span></h1>
    </div>
    <div style="padding:18px 20px 24px; display:grid; grid-template-columns:1fr 1fr; gap:14px">
      <button id="leerpad" aria-label="Leerpad met deze letters: kijken, overtrekken en schrijven" class="card" style="min-height:140px; border:none; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:12px">
        ${icon('path', 56, 'var(--primary)')}
        <span style="font-size:16px; font-weight:700">Leerpad</span>
      </button>
      <button id="geheugen" aria-label="Geheugenoefening: schrijf de letters na elkaar uit het hoofd" class="card" style="min-height:140px; border:none; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:12px">
        ${icon('geheugen', 56, 'var(--orange)')}
        <span style="font-size:16px; font-weight:700">Geheugen</span>
      </button>
      <div aria-label="Meer oefeningen volgen nog" style="min-height:140px; border-radius:24px; border:2px dashed var(--border); display:flex; align-items:center; justify-content:center; color:var(--line); font-size:40px">+</div>
    </div>
  </div>`);
  function startVorm(vorm) {
    store.mode = 'solo';
    store.soloVorm = vorm;
    store.soloLetters = rij;
    store.progress = {};
    if (vorm === 'leerpad') {
      // Eigen leerpad, los van een sessie: zelfde overzicht en flow.
      store.help = 'start';
      store.currentLetter = null;
      location.hash = '#home';
    } else {
      // Geheugen: meteen schrijven, zonder voorbeeld of startpunthulp;
      // alleen het referentiewoord bovenaan blijft als steun.
      store.help = 'none';
      store.currentLetter = rij[0];
      location.hash = '#write';
    }
  }
  s.querySelector('#leerpad').addEventListener('click', () => startVorm('leerpad'));
  s.querySelector('#geheugen').addEventListener('click', () => startVorm('geheugen'));
  return s;
}

/* ---------- mijn leerpad ------------------------------------------------ */
function screenHome() {
  const letters = letterList();
  const current = letters.find((l) => !store.progress[l]) || null;
  const doneCount = letters.filter((l) => store.progress[l]).length;
  const inSession = store.mode === 'session';
  const title = inSession ? esc(store.name) : 'Oefenen';
  const sub = inSession
    ? `${icon('users', 14, 'currentColor', 2.4)} Sessie ${store.code.replace(/(\d{3})(\d{3})/, '$1 $2')}`
    : 'Alleen oefenen';

  const s = h(`<div class="screen">
    <div class="topbar" style="padding:20px 20px 12px">
      <div style="display:flex; align-items:center; gap:12px">
        ${inSession ? '' : `<a class="iconbtn" href="#oefen" aria-label="Terug naar de oefeningen">${icon('back')}</a>`}
        <div style="display:flex; flex-direction:column">
          <span style="font-size:20px; font-weight:700">${title}</span>
          <span style="font-size:14px; color:${inSession ? 'var(--green-ink)' : 'var(--muted)'}; display:flex; align-items:center; gap:4px">${sub}</span>
        </div>
      </div>
      <span id="spk"></span>
    </div>
    ${current ? `<div style="margin:8px 20px 0; padding:22px; border-radius:24px; background:var(--primary); color:#fff; display:flex; align-items:center; gap:18px">
      <div class="letterfont" style="width:96px; height:96px; flex-shrink:0; border-radius:20px; background:#fff; color:var(--ink); font-size:${current.length > 1 ? 48 : 72}px; line-height:1; display:flex; align-items:center; justify-content:center">${current}</div>
      <div style="display:flex; flex-direction:column; gap:10px; flex-grow:1">
        <span style="font-size:15px">Volgende letter</span>
        <button id="startbtn" class="btn small" style="align-self:flex-start; background:#fff; color:var(--primary); padding:0 20px">${icon('play', 20, 'var(--primary)')} Start</button>
      </div>
    </div>` : `<div style="margin:8px 20px 0; padding:22px; border-radius:24px; background:var(--green-bg); color:var(--green-ink); display:flex; align-items:center; gap:18px">
      <div class="letterfont" style="width:96px; height:96px; flex-shrink:0; border-radius:20px; background:#fff; font-size:56px; line-height:1; display:flex; align-items:center; justify-content:center">★</div>
      <span style="font-size:18px; font-weight:700">Alles geoefend! Tik op een letter om te herhalen.</span>
    </div>`}
    <div style="padding:24px 20px 8px; display:flex; align-items:baseline; justify-content:space-between">
      <h1 style="font-size:20px">${inSession ? 'Mijn leerpad' : 'Letters'}</h1>
      <span style="font-size:15px; color:var(--muted)">${doneCount} van ${letters.length} letters</span>
    </div>
    <div id="list" style="flex-grow:1; padding:4px 20px 16px; display:flex; flex-direction:column; gap:10px"></div>
    <nav class="navbar" style="grid-template-columns:repeat(2, minmax(0,1fr))">
      <a href="#home" class="current">${icon('path')} Letterpad</a>
      <button id="navwords" style="opacity:.45">${icon('pencil')} Woorden</button>
    </nav>
  </div>`);

  const startBtn = s.querySelector('#startbtn');
  if (startBtn) startBtn.addEventListener('click', () => openLetter(current));
  s.querySelector('#navwords').addEventListener('click', () => toast('Woorden oefenen komt binnenkort'));

  const list = s.querySelector('#list');
  letters.forEach((l) => {
    const p = store.progress[l];
    const isNow = l === current && !p;
    const state = p ? 'done' : isNow ? 'now' : 'next';
    const tile = { done: 'background:var(--green-bg); color:var(--ink)', now: 'background:var(--primary); color:#fff', next: 'background:var(--neutral); color:var(--muted)' }[state];
    const status = p ? '★'.repeat(p.stars) : isNow ? 'Nu' : 'Straks';
    const statusInk = p ? 'var(--green-ink)' : isNow ? 'var(--primary)' : 'var(--muted)';
    const row = h(`<button style="min-height:60px; padding:8px 16px 8px 8px; border:none; border-radius:16px; background:var(--card); display:flex; align-items:center; gap:14px; cursor:pointer; text-align:left">
      <span class="letterfont" style="width:48px; height:48px; border-radius:12px; ${tile}; font-size:${l.length > 1 ? 24 : 32}px; line-height:1; display:flex; align-items:center; justify-content:center">${l}</span>
      <span style="flex-grow:1; font-size:17px; color:${state === 'next' ? 'var(--muted)' : 'var(--ink)'}">${wordMarkup(l)}</span>
      <span style="font-size:15px; color:${statusInk}; font-weight:700">${status}</span>
    </button>`);
    row.addEventListener('click', () => openLetter(l));
    list.appendChild(row);
  });
  return s;
}

function openLetter(l) {
  store.currentLetter = l;
  location.hash = '#watch';
}

/* ---------- gedeelde kop van de oefenschermen -------------------------- */
function lessonTop(backHash, backLabel, step, rightBtn) {
  // step 0: geen stappenbolletjes (de geheugenoefening heeft maar één stap).
  const dots = [1, 2, 3].map((i) => `<span class="${i <= step ? 'on' : ''}"></span>`).join('');
  const bar = h(`<div class="topbar">
    <a class="iconbtn" href="${backHash}" aria-label="${backLabel}">${icon('back')}</a>
    ${step ? `<div class="stepdots" aria-label="Stap ${step} van 3">${dots}</div>` : '<span></span>'}
    <span id="right"></span>
  </div>`);
  bar.querySelector('#right').replaceWith(rightBtn);
  return bar;
}

/* ---------- kijken ------------------------------------------------------ */
function screenWatch() {
  const letter = store.currentLetter || nextLetter();
  const def = LETTERS[letter];
  const vbW = Math.max(350, def.w + 80);
  let speed = 130; // eenheden per seconde

  // Kleine blauwe verder-knop rechtsboven: zo blijft onderaan ruimte vrij
  // en kan de letter groter in beeld.
  const verder = h(`<a href="#trace" class="iconbtn" aria-label="Nu jij: zelf overtrekken" style="background:var(--primary); color:#fff">${icon('arrow', 26, 'currentColor', 2.5)}</a>`);
  const s = h(`<div class="screen">
    <div id="top"></div>
    ${refWord(letter)}
    <div class="drawbox">
      <svg id="canvas" viewBox="${viewBoxFor(vbW, def.w)}" role="img" aria-label="De letter ${letter} tekent zichzelf op de lijnen, vanaf het oranje startpunt">
        <g id="guides" transform="translate(-400,0)">${guidesMarkup(vbW + 800, store.lines, store.slant)}</g>
        <g id="letter" transform="${letterTransform(vbW, def.w, store.slant)}">
          ${strokePaths(letter, () => 'stroke="#D5DCE8" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"')}
          <g id="ink"></g>
          <g id="marker"></g>
        </g>
      </svg>
    </div>
    <div style="padding:16px 20px 28px; display:flex; justify-content:center; gap:12px">
      <button id="again" class="btn ghost small">${icon('redo', 20)} Opnieuw</button>
      <button id="slower" class="chip" style="min-height:52px; border-radius:26px; padding:0 22px; font-weight:700; font-size:16px">${icon('slow', 20)} Trager</button>
    </div>
  </div>`);

  const soloOefening = store.mode === 'solo' && store.soloLetters && store.soloVorm !== 'leerpad';
  s.querySelector('#top').replaceWith(lessonTop(
    soloOefening ? '#oefentype' : '#home',
    soloOefening ? 'Terug naar de typekeuze' : 'Terug naar mijn leerpad',
    1, verder,
  ));

  // Animatie: alle streken vloeien zonder pauze in elkaar over, met pennetje.
  const svg = s.querySelector('#canvas');
  const inkG = s.querySelector('#ink');
  const markerG = s.querySelector('#marker');
  function stopAnim() { if (store.anim) { cancelAnimationFrame(store.anim); store.anim = null; } }
  function animate() {
    stopAnim();
    inkG.innerHTML = '';
    markerG.innerHTML = '';
    const strokes = def.strokes.map((st) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', st.d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', '#2357D9');
      p.setAttribute('stroke-width', st.dot ? 10 : 12);
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      inkG.appendChild(p);
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      return { p, len, dot: !!st.dot, newLetter: !!st.newLetter };
    });
    let i = 0, t0 = null, pause = 0;
    markerG.innerHTML = startDotMarkup(letter, 0, false);
    const pen = h(`<svg><circle r="9" fill="#C25E00" stroke="#fff" stroke-width="3"/></svg>`).firstElementChild;
    function frame(ts) {
      if (i >= strokes.length) {
        store.anim = null;
        pen.remove();
        return;
      }
      const st = strokes[i];
      if (t0 === null) { t0 = ts + pause; pause = 0; markerG.innerHTML = startDotMarkup(letter, i, false); markerG.appendChild(pen); }
      const el = (ts - t0) / 1000;
      const dist = Math.max(0, el) * speed;
      const done = Math.min(st.len, dist);
      st.p.style.strokeDashoffset = st.len - done;
      const pt = st.p.getPointAtLength(done);
      pen.setAttribute('cx', pt.x); pen.setAttribute('cy', pt.y);
      if (done >= st.len) {
        i++;
        if (i < strokes.length && strokes[i].newLetter) {
          // Tussen de letters van een klank wél even pauzeren.
          t0 = null; pause = 350;
        } else {
          // Binnen een letter loopt de beweging vloeiend door de penliften
          // heen: de rest van deze beeldtijd telt meteen mee.
          t0 = done < dist && st.len > 0 ? ts - ((dist - st.len) / speed) * 1000 : null;
          if (i < strokes.length && t0 !== null) { markerG.innerHTML = startDotMarkup(letter, i, false); markerG.appendChild(pen); }
        }
      }
      store.anim = requestAnimationFrame(frame);
    }
    store.anim = requestAnimationFrame(frame);
  }
  s.querySelector('#again').addEventListener('click', animate);
  s.querySelector('#slower').addEventListener('click', (e) => {
    speed = speed === 130 ? 60 : 130;
    e.currentTarget.setAttribute('aria-pressed', speed === 60 ? 'true' : 'false');
    animate();
  });
  setTimeout(animate, 250);
  report(letter, `Kijken · ${letter}`);
  return s;
}

/* ---------- overtrekken ------------------------------------------------- */
function screenTrace() {
  const letter = store.currentLetter || nextLetter();
  const def = LETTERS[letter];
  const vbW = Math.max(350, def.w + 80);
  const attempts = []; // sterren per afgewerkte poging (max 3)
  let tracer = new Tracer(letter);
  let drawing = false;

  // Verder-knop klein rechtsboven; ontgrendelt na de eerste poging.
  const nextBtn = h(`<a href="#write" id="next" class="iconbtn" aria-label="Verder naar schrijven" style="background:var(--primary); color:#fff; opacity:.45; pointer-events:none">${icon('arrow', 26, 'currentColor', 2.5)}</a>`);
  const s = h(`<div class="screen">
    <div id="top"></div>
    ${refWord(letter)}
    <div class="drawbox">
      <svg id="canvas" viewBox="${viewBoxFor(vbW, def.w)}" aria-label="Overtrekvak voor de letter ${letter}">
        <g transform="translate(-400,0)">${guidesMarkup(vbW + 800, store.lines, store.slant)}</g>
        <g id="letter" transform="${letterTransform(vbW, def.w, store.slant)}">
          ${strokePaths(letter, (st) => `stroke="#D5DCE8" stroke-width="${st.dot ? 18 : 26}" stroke-linecap="round" stroke-linejoin="round"`)}
          <g id="ink"></g>
          <g id="marker"></g>
        </g>
      </svg>
    </div>
    <div class="card" style="margin:16px 20px 24px; padding:14px 16px; display:flex; align-items:center; justify-content:center">
      <div id="chips" style="display:flex; gap:10px"></div>
    </div>
  </div>`);
  s.querySelector('#top').replaceWith(lessonTop('#watch', 'Terug naar kijken', 2, nextBtn));

  const svg = s.querySelector('#canvas');
  const letterG = s.querySelector('#letter');
  const inkG = s.querySelector('#ink');
  const markerG = s.querySelector('#marker');

  // Groene inkt: het model wordt onthuld tot waar de leerling zit.
  const inkPaths = def.strokes.map((st) => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', st.d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', '#1E8A54');
    p.setAttribute('stroke-width', st.dot ? 12 : 10);
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    const len = samplePath(st.d).len;
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
    inkG.appendChild(p);
    return { p, len };
  });

  function updateInk() {
    inkPaths.forEach((ip, idx) => {
      let frac = 0;
      if (idx < tracer.strokeIndex) frac = 1;
      else if (idx === tracer.strokeIndex && !tracer.done) frac = tracer.fractionDone();
      ip.p.style.strokeDashoffset = ip.len * (1 - frac);
    });
    markerG.innerHTML = tracer.done ? '' : startDotMarkup(letter, tracer.strokeIndex, !drawing && tracer.fractionDone() === 0);
  }
  updateInk();

  const chips = s.querySelector('#chips');
  function updateChips() {
    chips.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      // Een zwakke poging (1 ster) kleurt oranje, een goede groen.
      const st = attempts[i] !== undefined ? (attempts[i] > 1 ? 'done' : 'weak') : i === attempts.length ? 'now' : 'later';
      const css = {
        done: 'background:var(--green-bg); color:var(--green-ink)',
        weak: 'background:var(--orange-bg); color:var(--orange-ink)',
        now: 'border:2px solid var(--primary); box-sizing:border-box; color:var(--primary); background:#fff',
        later: 'background:var(--neutral); color:var(--muted)',
      }[st];
      const label = st === 'weak' ? `Poging ${i + 1}: niet goed` : st === 'done' ? `Poging ${i + 1}: goed` : `Poging ${i + 1}`;
      chips.appendChild(h(`<span class="letterfont" aria-label="${label}" style="width:44px; height:44px; border-radius:12px; ${css}; font-size:${letter.length > 1 ? 20 : 28}px; display:flex; align-items:center; justify-content:center">${letter}</span>`));
    }
  }
  updateChips();

  function unlockNext() { nextBtn.style.opacity = '1'; nextBtn.style.pointerEvents = 'auto'; }

  function resetAttempt() {
    tracer = new Tracer(letter);
    drawing = false;
    updateInk();
  }

  function finishAttempt() {
    const stars = tracer.stars();
    attempts.push(stars);
    updateChips();
    unlockNext();
    const best = Math.max(...attempts);
    report(letter, `Overtrekken · ${letter}`, best);
    if (attempts.length >= 3) {
      setTimeout(() => { location.hash = '#write'; }, 1200);
    } else {
      setTimeout(resetAttempt, 900);
    }
  }

  svg.addEventListener('pointerdown', (ev) => {
    if (tracer.done || attempts.length >= 3) return;
    svg.setPointerCapture(ev.pointerId);
    const p = svgPoint(svg, letterG, ev);
    const r = tracer.beginStroke(p);
    if (r !== 'wrongStart') drawing = true;
    updateInk();
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!drawing) return;
    tracer.move(svgPoint(svg, letterG, ev));
    updateInk();
  });
  svg.addEventListener('pointerup', () => {
    if (!drawing) return;
    drawing = false;
    const r = tracer.endStroke();
    if (r === 'done-letter') { updateInk(); finishAttempt(); }
    else if (r === 'done-stroke') { updateInk(); }
    else { tracer.progress = 0; updateInk(); }
  });

  report(letter, `Overtrekken · ${letter}`);
  return s;
}

/* ---------- zelf schrijven ---------------------------------------------- */
function screenWrite() {
  const letter = store.currentLetter || nextLetter();
  const def = LETTERS[letter];
  const vbW = Math.max(350, def.w + 80);
  const help = store.help || 'start'; // bepaald door de leerkracht; alleen oefenen: startpunten
  const attempts = [];
  let tracer = new Tracer(letter, { tolerance: 52, startRadius: 56 });
  let drawing = false;
  let rawInk = []; // eigen pen-spoor van deze beurt

  // Klaar-knop klein rechtsboven.
  const doneBtn = h(`<button class="iconbtn" aria-label="Klaar, terug naar mijn leerpad" style="background:var(--primary); color:#fff">${icon('check', 26, 'currentColor', 2.5)}</button>`);
  const s = h(`<div class="screen">
    <div id="top"></div>
    ${refWord(letter)}
    <div class="drawbox">
      <svg id="canvas" viewBox="${viewBoxFor(vbW, def.w)}" aria-label="Schrijfvak: schrijf de letter ${letter} drie keer, één keer per beurt">
        <g transform="translate(-400,0)">${guidesMarkup(vbW + 800, store.lines, store.slant)}</g>
        <g id="slot" transform="${letterTransform(vbW, def.w, store.slant)}"></g>
      </svg>
    </div>
    <div class="card" style="margin:16px 20px 24px; padding:14px 16px; display:flex; align-items:center; justify-content:center">
      <div id="chips" style="display:flex; gap:10px"></div>
    </div>
  </div>`);
  const geheugen = store.mode === 'solo' && store.soloLetters && store.soloVorm === 'geheugen';
  s.querySelector('#top').replaceWith(lessonTop(
    geheugen ? '#oefentype' : '#trace',
    geheugen ? 'Terug naar de typekeuze' : 'Terug naar overtrekken',
    geheugen ? 0 : 3, doneBtn,
  ));

  const svg = s.querySelector('#canvas');
  const slotG = s.querySelector('#slot');

  function renderSlot() {
    let inner = '';
    if (help === 'dots') inner += strokePaths(letter, (st) => `stroke="#B9C4D6" stroke-width="${st.dot ? 8 : 6}" stroke-dasharray="2 12" stroke-linecap="round" stroke-linejoin="round"`);
    if (help !== 'none' && !tracer.done) inner += startDotMarkup(letter, tracer.strokeIndex, !drawing);
    inner += '<g class="rawink"></g>';
    slotG.innerHTML = inner;
    updateRawInk();
  }

  function updateRawInk() {
    const ri = slotG.querySelector('.rawink');
    if (!ri) return;
    ri.innerHTML = rawInk
      .map((seg) => `<path d="M ${seg.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ')}" fill="none" stroke="#2357D9" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join('');
  }

  const chips = s.querySelector('#chips');
  function updateChips() {
    chips.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      // Elke beurt telt: goed wordt groen, niet goed genoeg wordt oranje.
      const st = attempts[i] !== undefined ? (attempts[i] > 1 ? 'done' : 'weak') : i === attempts.length ? 'now' : 'later';
      const css = {
        done: 'background:var(--green-bg); color:var(--green-ink)',
        weak: 'background:var(--orange-bg); color:var(--orange-ink)',
        now: 'border:2px solid var(--primary); box-sizing:border-box; color:var(--primary); background:#fff',
        later: 'background:var(--neutral); color:var(--muted)',
      }[st];
      const label = st === 'weak' ? `Keer ${i + 1}: niet goed` : st === 'done' ? `Keer ${i + 1}: goed` : `Keer ${i + 1}`;
      chips.appendChild(h(`<span class="letterfont" aria-label="${label}" style="width:44px; height:44px; border-radius:12px; ${css}; font-size:${letter.length > 1 ? 20 : 28}px; display:flex; align-items:center; justify-content:center">${letter}</span>`));
    }
  }

  function nextAttempt() {
    rawInk = [];
    tracer = new Tracer(letter, { tolerance: 52, startRadius: 56 });
    drawing = false;
    renderSlot();
    updateChips();
  }

  const soloOefening = () => store.mode === 'solo' && store.soloLetters;
  function goNextLetter() {
    // Geheugenvorm: de rij meteen verder afwerken, zonder tussenstop.
    if (soloOefening() && store.soloVorm === 'geheugen') {
      const next = letterList().find((l) => !store.progress[l]);
      if (next) { store.currentLetter = next; location.hash = '#write'; return; }
      store.soloLetters = null;
      store.currentLetter = null;
      location.hash = '#oefen';
      return;
    }
    // Letter afgerond: terug naar het leerpad; daar staat de volgende klaar.
    store.currentLetter = null;
    location.hash = '#home';
  }

  // Sterren = het aantal goede (groene) schrijfbeurten.
  function greenCount() { return attempts.filter((st) => st > 1).length; }

  function finishAttempt() {
    const stars = tracer.stars();
    // Even de grijze vorm over de eigen letter: zo zie je zelf hoe het ging.
    slotG.insertAdjacentHTML('beforeend', `<g class="ghost">${strokePaths(letter, (st) => `stroke="#C7CFDD" stroke-width="${st.dot ? 18 : 26}" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"`)}</g>`);
    // Precies drie beurten: elke beurt telt, ook een mindere (oranje blokje).
    attempts.push(stars);
    updateChips();
    if (attempts.length >= 3) {
      store.progress[letter] = { stars: greenCount() };
      report(letter, 'Klaar', greenCount());
      // Automatisch door naar de volgende letter; pas terug naar het
      // leerpad wanneer alles af is.
      setTimeout(goNextLetter, 1600);
    } else {
      setTimeout(nextAttempt, 1600);
    }
  }

  // Klaar-knop: rondt de letter af en keert terug naar mijn leerpad.
  // Wie vroeger stopt, krijgt evenveel sterren als er blokjes groen zijn.
  doneBtn.addEventListener('click', () => {
    if (!store.progress[letter]) {
      store.progress[letter] = { stars: greenCount() };
      report(letter, 'Klaar', greenCount());
    }
    store.currentLetter = null;
    if (soloOefening() && store.soloVorm !== 'leerpad') { store.soloLetters = null; location.hash = '#oefen'; }
    else location.hash = '#home';
  });

  svg.addEventListener('pointerdown', (ev) => {
    if (attempts.length >= 3) return;
    svg.setPointerCapture(ev.pointerId);
    const p = svgPoint(svg, slotG, ev);
    const r = tracer.beginStroke(p);
    if (r === 'wrongStart') {
      // Na een misser tonen we het startpunt ook zonder hulp.
      if (help === 'none') {
        const old = slotG.querySelector('.hintdot');
        if (old) old.remove();
        slotG.insertAdjacentHTML('beforeend', `<g class="hintdot">${startDotMarkup(letter, tracer.strokeIndex, true)}</g>`);
      }
      return;
    }
    drawing = true;
    rawInk.push([p]);
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!drawing) return;
    const p = svgPoint(svg, slotG, ev);
    rawInk[rawInk.length - 1].push(p);
    updateRawInk();
    tracer.move(p);
  });
  svg.addEventListener('pointerup', () => {
    if (!drawing) return;
    drawing = false;
    const r = tracer.endStroke();
    if (r === 'done-letter') finishAttempt();
    else if (r === 'done-stroke') renderSlot();
    else {
      rawInk.pop();
      updateRawInk();
    }
  });

  renderSlot();
  updateChips();
  report(letter, `Schrijven · ${letter}`);
  return s;
}

/* ---------- leerkracht --------------------------------------------------- */
function screenTeacher() {
  const state = {
    picked: ['a'], upper: false, slant: false, lines: 4, help: 'start',
    kb: 'klank', words: [],   // 'klank' = losse letters/klanken, 'woord' = referentiewoorden
    code: null, learners: new Map(), started: new Date(),
  };
  const ses = new Session();

  const s = h(`<div class="screen wide">
    <header style="background:var(--card); padding:14px 24px; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; border-radius:0 0 24px 24px">
      <div style="display:flex; align-items:center; gap:12px">
        ${logoMarkup(34)}
        <span style="font-size:18px; font-weight:700">Schrijfpad</span>
        <span style="padding:4px 10px; border-radius:12px; background:var(--orange-bg); color:var(--orange-ink); font-size:14px; font-weight:700">Leerkracht</span>
      </div>
      <nav style="display:flex; align-items:center; gap:8px">
        <span style="min-height:44px; padding:0 14px; border-radius:22px; background:var(--primary-soft); color:var(--primary-dark); font-weight:700; display:flex; align-items:center">Sessie</span>
        <a href="#start" id="leave" style="min-height:44px; padding:0 14px; border-radius:22px; color:var(--muted); text-decoration:none; display:flex; align-items:center">Verlaten</a>
      </nav>
    </header>
    <div style="max-width:1360px; margin:0 auto; padding:24px; box-sizing:border-box; display:flex; flex-wrap:wrap; gap:24px; align-items:flex-start; width:100%">
      <div style="flex:1 1 480px; display:flex; flex-direction:column; gap:20px; min-width:0">
        <div class="card" style="padding:24px; display:flex; flex-direction:column; gap:16px">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px">
            <div style="display:flex; flex-direction:column; gap:2px">
              <span style="font-size:14px; color:var(--muted)">Jouw sessie</span>
              <h1 style="font-size:24px" id="started">Starten…</h1>
            </div>
            <span id="status" style="padding:6px 12px; border-radius:14px; background:var(--neutral); color:var(--muted); font-size:14px; font-weight:700; display:flex; align-items:center; gap:6px">
              <span style="width:8px; height:8px; border-radius:4px; background:var(--muted)"></span>Verbinden…
            </span>
          </div>
          <div style="padding:20px; border-radius:18px; background:var(--bg); display:flex; align-items:center; gap:20px; flex-wrap:wrap">
            <div id="qrbox" role="img" aria-label="QR-code om aan te sluiten" style="width:132px; height:132px; flex-shrink:0; border-radius:12px; background:#fff; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:14px; overflow:hidden">QR-code</div>
            <div style="display:flex; flex-direction:column; gap:6px">
              <span style="font-size:15px; color:var(--muted)">Code voor de leerlingen</span>
              <span id="codeview" style="font-size:44px; font-weight:700; letter-spacing:0.08em">··· ···</span>
              <span style="font-size:14px; color:var(--muted)">schrijfpad.local → Aansluiten</span>
            </div>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:10px">
            <button id="bigscreen" class="btn primary small" style="flex:1 1 160px">Toon op groot scherm</button>
            <button id="stopses" class="btn ghost small" style="flex:1 1 120px">Sessie stoppen</button>
          </div>
          <p style="font-size:14px; color:var(--muted)">Stop je de sessie, dan verdwijnen alle resultaten. Er wordt niets bewaard.</p>
        </div>

        <div class="card" style="padding:24px; display:flex; flex-direction:column; gap:14px">
          <div style="display:flex; align-items:baseline; justify-content:space-between; gap:12px">
            <h2 style="font-size:19px">Opdracht voor de klas</h2>
            <span id="count" style="font-size:15px; color:var(--muted)"></span>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center">
            <button class="chip" data-kb="klank">Per klank</button>
            <button class="chip" data-kb="woord">Per woord</button>
            <span style="flex-grow:1"></span>
            <button class="chip" data-preset="all">Alles</button>
            <button class="chip" data-preset="none">Wissen</button>
          </div>
          <div id="kb" style="padding:10px; border-radius:16px; background:#E3E8F0; display:flex; flex-direction:column; gap:6px"></div>
          <div style="display:flex; flex-wrap:wrap; gap:16px; align-items:center">
            <div style="display:flex; align-items:center; gap:8px">
              <span style="font-size:14px; font-weight:700; color:var(--muted)">Stand</span>
              <button class="chip" data-slant="false">Rechtop</button>
              <button class="chip" data-slant="true">Schuin</button>
            </div>
            <div style="display:flex; align-items:center; gap:8px">
              <span style="font-size:14px; font-weight:700; color:var(--muted)">Lijnen</span>
              <button class="chip" data-lines="0">Geen</button>
              <button class="chip" data-lines="2">2</button>
              <button class="chip" data-lines="4">4</button>
            </div>
            <div style="display:flex; align-items:center; gap:8px">
              <span style="font-size:14px; font-weight:700; color:var(--muted)">Hulp</span>
              <button class="chip" data-help="dots">Stippels</button>
              <button class="chip" data-help="start">Startpunten</button>
              <button class="chip" data-help="none">Geen</button>
            </div>
          </div>
          <button id="sendbtn" class="btn small" style="background:var(--ink); color:#fff">${icon('send', 20)} Stuur naar alle leerlingen</button>
        </div>
      </div>

      <div style="flex:999 1 520px; min-width:0">
        <div class="card" style="padding:24px; display:flex; flex-direction:column; gap:14px">
          <span id="joined" style="align-self:flex-end; font-size:15px; color:var(--muted)">0 aangesloten</span>
          <div style="overflow-x:auto">
            <div style="min-width:420px; display:flex; flex-direction:column">
              <div style="display:grid; grid-template-columns:2fr 1.5fr 1fr; gap:12px; padding:8px 12px; font-size:14px; font-weight:700; color:var(--muted)">
                <span>Leerling</span><span>Bezig met</span><span>Resultaat</span>
              </div>
              <div id="rows"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`);

  /* -- toetsen in de aanleervolgorde van de lesgever, klanken incluis -- */
  const kb = s.querySelector('#kb');
  const KEYS = [...PATH_ORDER, 'SHIFT'];
  // Hoofdletters bestaan voor losse letters en voor ij (IJ); klanken niet.
  function cs(c) { return state.upper && (c.length === 1 || c === 'ij') ? c.toUpperCase() : c; }
  // Kiest de lesgever per woord, dan zet een aangeklikt woord vanzelf al
  // zijn letters en klanken klaar in het letterpad.
  function pickFromWords() {
    const out = [];
    state.words.forEach((w) => segment(w).forEach((l) => { if (!out.includes(l)) out.push(l); }));
    state.picked = out;
  }
  function renderKb() {
    kb.innerHTML = '';
    if (state.kb === 'woord') {
      const r = document.createElement('div');
      r.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px';
      WOORDEN.forEach((w) => {
        const on = state.words.includes(w);
        const b = h(`<button class="letterkey" aria-pressed="${on}" style="padding:0 16px; font-size:22px"><span style="display:inline-block; ${state.slant ? 'transform:skewX(-12deg)' : ''}">${w}</span></button>`);
        b.addEventListener('click', () => {
          state.words = on ? state.words.filter((x) => x !== w) : [...state.words, w];
          pickFromWords(); renderKb(); updateCount();
        });
        r.appendChild(b);
      });
      kb.appendChild(r);
      return;
    }
    const r = document.createElement('div');
    r.style.cssText = 'display:grid; grid-template-columns:repeat(10, minmax(0,1fr)); gap:6px';
    KEYS.forEach((c) => {
      if (c === 'SHIFT') {
        const b = h(`<button class="letterkey" aria-label="Hoofdletters" aria-pressed="${state.upper}" style="grid-column:span 2; ${state.upper ? 'background:var(--primary); color:#fff' : ''}">${icon('shift', 26)}</button>`);
        b.addEventListener('click', () => { state.upper = !state.upper; renderKb(); });
        r.appendChild(b);
        return;
      }
      const label = cs(c);
      const on = state.picked.includes(label);
      const b = h(`<button class="letterkey" aria-pressed="${on}"><span style="display:inline-block; ${state.slant ? 'transform:skewX(-12deg)' : ''}">${label}</span></button>`);
      b.addEventListener('click', () => {
        state.picked = on ? state.picked.filter((x) => x !== label) : [...state.picked, label];
        renderKb(); updateCount();
      });
      r.appendChild(b);
    });
    kb.appendChild(r);
  }
  const countEl2 = s.querySelector('#count');
  function updateCount() {
    const n = state.picked.length;
    countEl2.textContent = n === 1 ? '1 gekozen' : `${n} gekozen`;
  }
  function syncKbChips() {
    s.querySelectorAll('[data-kb]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kb === state.kb)));
  }
  renderKb(); updateCount(); syncKbChips();

  s.querySelectorAll('[data-kb]').forEach((b) => b.addEventListener('click', () => {
    state.kb = b.dataset.kb;
    syncKbChips(); renderKb();
  }));
  s.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.preset === 'all') {
      if (state.kb === 'woord') { state.words = [...WOORDEN]; pickFromWords(); }
      else state.picked = PATH_ORDER.map(cs);
    } else {
      state.words = []; state.picked = [];
    }
    renderKb(); updateCount();
  }));
  function syncOptChips() {
    s.querySelectorAll('[data-slant]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.slant === String(state.slant))));
    s.querySelectorAll('[data-lines]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.lines) === state.lines)));
    s.querySelectorAll('[data-help]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.help === state.help)));
  }
  s.querySelectorAll('[data-slant]').forEach((b) => b.addEventListener('click', () => { state.slant = b.dataset.slant === 'true'; renderKb(); syncOptChips(); }));
  s.querySelectorAll('[data-lines]').forEach((b) => b.addEventListener('click', () => { state.lines = Number(b.dataset.lines); syncOptChips(); }));
  s.querySelectorAll('[data-help]').forEach((b) => b.addEventListener('click', () => { state.help = b.dataset.help; syncOptChips(); }));
  syncOptChips();

  /* -- leerlingen -- */
  const rowsEl = s.querySelector('#rows');
  const joinedEl = s.querySelector('#joined');
  function renderRows() {
    const list = [...state.learners.values()];
    joinedEl.textContent = `${list.filter((l) => l.connected).length} aangesloten`;
    rowsEl.innerHTML = list.length
      ? ''
      : '<p style="padding:16px 12px; color:var(--muted); font-size:15px; border-top:1px solid #E3E8F0">Nog niemand aangesloten. Toon de code op het grote scherm.</p>';
    list.forEach((l, i) => {
      const bg = ['#FDEBD8', '#E6F4EC', '#E8EEFC', '#EEF1F6'][i % 4];
      const klaar = l.step === 'Klaar';
      rowsEl.appendChild(h(`<div style="display:grid; grid-template-columns:2fr 1.5fr 1fr; gap:12px; align-items:center; padding:10px 12px; border-top:1px solid #E3E8F0; font-size:16px; ${l.connected ? '' : 'opacity:.45'}">
        <span style="display:flex; align-items:center; gap:10px"><span style="width:32px; height:32px; border-radius:16px; background:${bg}; flex-shrink:0"></span>${esc(l.name)}${l.connected ? '' : ' (weg)'}</span>
        <span style="color:${klaar ? 'var(--green-ink)' : 'var(--ink)'}; font-weight:${klaar ? 700 : 400}">${klaar ? 'Klaar ✓' : esc(l.step || '—')}</span>
        <span style="color:var(--green-ink); font-weight:700">${l.lastStars === undefined ? '–' : '★'.repeat(l.lastStars) + '☆'.repeat(3 - l.lastStars)}</span>
      </div>`));
    });
  }
  renderRows();

  /* -- verbinding -- */
  const statusEl = s.querySelector('#status');
  function setStatus(ok, label) {
    statusEl.innerHTML = `<span style="width:8px; height:8px; border-radius:4px; background:${ok ? '#1E8A54' : 'var(--muted)'}"></span>${label}`;
    statusEl.style.background = ok ? 'var(--green-bg)' : 'var(--neutral)';
    statusEl.style.color = ok ? 'var(--green-ink)' : 'var(--muted)';
  }
  ses.on('created', (msg) => {
    state.code = msg.code;
    const pretty = msg.code.replace(/(\d{3})(\d{3})/, '$1 $2');
    s.querySelector('#codeview').textContent = pretty;
    s.querySelector('#started').textContent = `Gestart om ${state.started.getHours()}:${String(state.started.getMinutes()).padStart(2, '0')}`;
    setStatus(true, 'Sessie loopt');
    const url = `${location.origin}/?s=${msg.code}`;
    const qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    s.querySelector('#qrbox').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    const qsvg = s.querySelector('#qrbox svg');
    if (qsvg) { qsvg.style.width = '100%'; qsvg.style.height = '100%'; }
  });
  ses.on('roster', (msg) => {
    msg.learners.forEach((l) => {
      const prev = state.learners.get(l.id) || {};
      state.learners.set(l.id, { ...prev, ...l });
    });
    for (const [id, l] of state.learners) {
      if (!msg.learners.find((x) => x.id === id)) l.connected = false;
    }
    renderRows();
  });
  ses.on('progress', (msg) => {
    const l = state.learners.get(msg.id);
    if (!l) return;
    l.step = msg.step;
    // Alleen het eindresultaat van een afgeronde letter telt (sterren =
    // groene schrijfblokjes); tussenstanden van kijken/overtrekken niet.
    // Ook 0 sterren is een effectief resultaat.
    if (msg.step === 'Klaar' && msg.letter) {
      l.results = l.results || {};
      l.results[msg.letter] = msg.stars || 0;
      l.lastStars = msg.stars || 0;
    }
    renderRows();
  });
  ses.on('disconnected', () => setStatus(false, 'Verbinding kwijt…'));
  ses.connect()
    .then(() => ses.create())
    .catch(() => setStatus(false, 'Server niet bereikbaar'));

  s.querySelector('#sendbtn').addEventListener('click', () => {
    if (!state.picked.length) { toast('Kies eerst een paar letters'); return; }
    ses.assign(state.picked, state.slant, state.lines, state.help);
    toast(`Opdracht gestuurd: ${state.picked.join(', ')}`);
  });

  s.querySelector('#bigscreen').addEventListener('click', () => {
    if (!state.code) return;
    const pretty = state.code.replace(/(\d{3})(\d{3})/, '$1 $2');
    const qrHtml = s.querySelector('#qrbox').innerHTML;
    const ov = h(`<div class="overlay">
      <div class="letterfont" style="display:flex; gap:4px; font-size:56px"><span>a</span><span style="color:var(--primary)">b</span><span>c</span></div>
      <div style="width:min(44vh,70vw); aspect-ratio:1; background:#fff; border-radius:24px; padding:16px; box-sizing:border-box">${qrHtml}</div>
      <div style="font-size:min(14vw,110px); font-weight:700; letter-spacing:.08em">${pretty}</div>
      <p style="font-size:22px; color:var(--muted)">Ga naar <strong>schrijfpad.local</strong> en tik op Aansluiten</p>
      <button class="btn ghost small" id="closeov">Sluiten</button>
    </div>`);
    const qsvg = ov.querySelector('svg');
    if (qsvg) { qsvg.style.width = '100%'; qsvg.style.height = '100%'; }
    ov.querySelector('#closeov').addEventListener('click', () => { ov.remove(); document.exitFullscreen?.(); });
    document.body.appendChild(ov);
    ov.requestFullscreen?.();
  });

  // Resultatenrapport voor de pdf: per leerling de beste score per letter.
  function buildReport() {
    const when = new Date().toLocaleString('nl-BE');
    const code = state.code ? state.code.replace(/(\d{3})(\d{3})/, '$1 $2') : '';
    const blocks = [...state.learners.values()].map((l) => {
      const res = Object.entries(l.results || {});
      const items = res.length
        ? res.map(([ltr, st]) => `<span style="display:inline-block; margin:2px 14px 2px 0"><strong style="font-family:'Andika',sans-serif; font-size:18px">${esc(ltr)}</strong> ${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span>`).join('')
        : '<em>nog geen afgewerkte letters</em>';
      return `<div style="padding:10px 0; border-bottom:1px solid #bbb; break-inside:avoid">
        <strong style="font-size:17px">${esc(l.name)}</strong>${l.connected ? '' : ' (weggegaan)'}
        <div style="margin-top:4px">${items}</div>
      </div>`;
    }).join('');
    return `<h1 style="font-size:24px; margin:0 0 4px">Schrijfpad — resultaten</h1>
      <p style="margin:0 0 16px">Sessie ${code} · ${when}</p>
      ${blocks || '<p>Er was niemand aangesloten.</p>'}`;
  }

  s.querySelector('#stopses').addEventListener('click', () => {
    const ov = h(`<div class="overlay" style="background:rgba(23,32,51,.5); padding:24px; box-sizing:border-box">
      <div style="background:#fff; border-radius:24px; padding:28px; width:min(420px,100%); box-sizing:border-box; display:flex; flex-direction:column; gap:12px">
        <h2 style="margin:0; font-size:22px">Sessie stoppen?</h2>
        <p style="margin:0 0 6px; font-size:16px; color:var(--muted)">De resultaten verdwijnen daarna. Bewaar ze eerst als pdf als je ze wil houden.</p>
        <button id="pdfbtn" class="btn primary small">Bewaar als pdf</button>
        <button id="stopnow" class="btn small" style="background:var(--ink); color:#fff">Stoppen zonder bewaren</button>
        <button id="cancelstop" class="btn ghost small">Terug</button>
      </div>
    </div>`);
    ov.querySelector('#pdfbtn').addEventListener('click', () => {
      document.getElementById('printsheet').innerHTML = buildReport();
      window.print();
      ov.querySelector('#stopnow').textContent = 'Sessie stoppen';
    });
    ov.querySelector('#stopnow').addEventListener('click', () => {
      ov.remove();
      ses.end();
      ses.close();
      location.hash = '#start';
    });
    ov.querySelector('#cancelstop').addEventListener('click', () => ov.remove());
    document.body.appendChild(ov);
  });
  s.querySelector('#leave').addEventListener('click', () => { ses.close(); });

  s.cleanup = () => { ses.close(); };
  return s;
}

/* ---------- router ------------------------------------------------------ */
const routes = {
  start: screenStart, join: screenJoin, oefen: screenOefen, oefentype: screenOefenType, home: screenHome,
  watch: screenWatch, trace: screenTrace, write: screenWrite, teacher: screenTeacher,
};

let currentScreen = null;
function render() {
  if (store.anim) { cancelAnimationFrame(store.anim); store.anim = null; }
  if (currentScreen && currentScreen.cleanup) currentScreen.cleanup();
  const name = (location.hash || '#start').slice(1);
  const fn = routes[name] || screenStart;
  const el = fn();
  currentScreen = el;
  app.innerHTML = '';
  app.appendChild(el);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);
window.__lp = store; // debughaakje

// ?s=CODE in de URL (QR-code van de leerkracht) → meteen naar aansluiten.
const qs = new URLSearchParams(location.search);
if (qs.get('s') && /^\d{6}$/.test(qs.get('s'))) {
  store.code = qs.get('s');
  history.replaceState(null, '', location.pathname + '#join');
}
render();
