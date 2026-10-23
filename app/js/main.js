/* Letterpad — schermen en routering. Eén pagina, hash-routes:
 * #start #join #home #watch #trace #write #teacher
 */

import { LETTERS, WORDS, PATH_ORDER, VOWELS, GUIDES, BOX_H } from './letters.js';
import { Tracer, samplePath, svgPoint, nextHint } from './engine.js';
import { Session } from './net.js';

const { ASC, XH, BL, DSC } = GUIDES;
const app = document.getElementById('app');

/* ---------- toestand (fase 1: niets wordt bewaard) ------------------- */
const store = {
  mode: 'solo',            // 'solo' | 'session'
  name: '', avatar: 'zon', code: '',
  session: null,           // Session (leerder) of null
  assignment: null,        // { letters, slant, lines } van de leerkracht
  lines: 4, slant: false,  // weergave: komt in een sessie van de leerkracht
  help: 'start',           // hulp bij het schrijven: 'dots' | 'start' | 'none'
  progress: {},            // letter -> { stars }
  currentLetter: null,
  anim: null,              // lopende animatie (om te stoppen)
};

function letterList() {
  if (store.mode === 'session' && store.assignment && store.assignment.letters.length) {
    return store.assignment.letters;
  }
  return PATH_ORDER;
}
function nextLetter() {
  return letterList().find((l) => !store.progress[l]) || letterList()[0];
}
function wordFor(letter) { return WORDS[letter.toLowerCase()] || ''; }

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
    maan: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    bloem: '<circle cx="12" cy="12" r="3"/><path d="M12 9a3 3 0 1 0-3-3 3 3 0 1 0-3 3 3 3 0 1 0 3 3 3 3 0 1 0 3 3 3 3 0 1 0 3-3 3 3 0 1 0 3-3 3 3 0 1 0-3-3 3 3 0 0 0-3 3"/>',
    wolk: '<path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.5 2A4 4 0 0 0 7 19z"/>',
    vis: '<path d="M6.5 12c2-3.5 5-5 11.5-5-1 2-1 8 0 10-6.5 0-9.5-1.5-11.5-5z"/><path d="M6.5 12 2 8v8z"/><circle cx="14" cy="11" r="1"/>',
    hart: '<path d="M12 21 4.3 13.3a5 5 0 0 1 7-7.1l.7.7.7-.7a5 5 0 0 1 7 7.1z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

const AVATARS = [
  { id: 'zon', bg: '#FDEBD8', ink: '#8A4200' },
  { id: 'blad', bg: '#E6F4EC', ink: '#1E6B43' },
  { id: 'ster', bg: '#E8EEFC', ink: '#163C9E' },
  { id: 'maan', bg: '#EEF1F6', ink: '#172033' },
  { id: 'bloem', bg: '#FDE8F0', ink: '#9B2C5D' },
  { id: 'wolk', bg: '#E8F4FA', ink: '#1C5D7A' },
  { id: 'vis', bg: '#E6F4EC', ink: '#1E6B43' },
  { id: 'hart', bg: '#FDEBD8', ink: '#8A4200' },
];
function avatarDef(id) { return AVATARS.find((a) => a.id === id) || AVATARS[0]; }

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

function screenStart() {
  const s = h(`<div class="screen">
    <div class="topbar"><span></span></div>
    <div style="padding: 12px 24px 0; display:flex; flex-direction:column; align-items:center; gap:14px; text-align:center">
      <div class="letterfont" style="display:flex; gap:4px; font-size:64px; line-height:1">
        <span>a</span><span style="color:#2357D9">b</span><span>c</span>
      </div>
      <h1 style="font-size:30px">Letterpad</h1>
      <p style="font-size:17px; color:var(--muted)">Leer schrijven, letter per letter.</p>
    </div>
    <div style="padding:36px 20px 0; display:flex; flex-direction:column; gap:14px">
      <a href="#join" style="min-height:128px; padding:20px; box-sizing:border-box; border-radius:24px; background:var(--primary); color:#fff; text-decoration:none; display:flex; align-items:center; gap:18px">
        <span style="width:64px; height:64px; flex-shrink:0; border-radius:18px; background:#fff; display:flex; align-items:center; justify-content:center">${icon('qr', 34, '#2357D9')}</span>
        <span style="display:flex; flex-direction:column; gap:4px">
          <span style="font-size:23px; font-weight:700">Aansluiten</span>
          <span style="font-size:16px">Ik heb een code van de leerkracht</span>
        </span>
      </a>
      <a href="#teacher" style="min-height:128px; padding:20px; box-sizing:border-box; border-radius:24px; background:#fff; border:2px solid var(--border); color:var(--ink); text-decoration:none; display:flex; align-items:center; gap:18px">
        <span style="width:64px; height:64px; flex-shrink:0; border-radius:18px; background:var(--orange-bg); display:flex; align-items:center; justify-content:center">${icon('screen', 34, '#8A4200')}</span>
        <span style="display:flex; flex-direction:column; gap:4px">
          <span style="font-size:23px; font-weight:700">Sessie starten</span>
          <span style="font-size:16px; color:var(--muted)">Ik ben leerkracht</span>
        </span>
      </a>
    </div>
    <div style="margin-top:auto; padding:16px 20px 32px; display:flex; justify-content:center">
      <a href="#home" id="solo" style="min-height:48px; display:flex; align-items:center; font-size:17px">Alleen oefenen</a>
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
      <p style="font-size:17px; color:var(--muted)">Vraag de code aan je leerkracht.</p>
    </div>
    <div class="card" style="margin:18px 20px 0; display:flex; flex-direction:column; gap:14px">
      <button id="scan" class="btn small" style="border:2px solid var(--primary); background:var(--primary-soft); color:var(--primary-dark); display:none">${icon('qr', 24)} Scan de QR-code</button>
      <div id="of" style="display:none; align-items:center; gap:10px; color:var(--muted); font-size:15px">
        <span style="flex-grow:1; height:1px; background:var(--border)"></span>of typ de code<span style="flex-grow:1; height:1px; background:var(--border)"></span>
      </div>
      <div class="codeboxes" id="boxes" role="button" tabindex="0" aria-label="Sessiecode, zes cijfers"></div>
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
      <a href="#home" id="solo" style="min-height:48px; display:flex; align-items:center; justify-content:center; font-size:16px">Alleen oefenen</a>
    </div>
    <video id="qrvideo" style="display:none"></video>
  </div>`);

  const boxes = s.querySelector('#boxes');
  const input = s.querySelector('#codeinput');
  input.value = code;
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

  // QR scannen: alleen tonen als de browser het kan.
  if ('BarcodeDetector' in window && navigator.mediaDevices) {
    const scanBtn = s.querySelector('#scan');
    scanBtn.style.display = 'flex';
    s.querySelector('#of').style.display = 'flex';
    scanBtn.addEventListener('click', async () => {
      const video = s.querySelector('#qrvideo');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        video.style.cssText = 'display:block; position:fixed; inset:0; width:100%; height:100%; object-fit:cover; z-index:60';
        await video.play();
        const det = new BarcodeDetector({ formats: ['qr_code'] });
        const stopCam = () => { stream.getTracks().forEach((t) => t.stop()); video.style.display = 'none'; };
        video.addEventListener('click', stopCam, { once: true });
        const tick = async () => {
          if (!video.srcObject || video.style.display === 'none') return;
          try {
            const codes = await det.detect(video);
            for (const c of codes) {
              const m = c.rawValue.match(/(\d{6})/);
              if (m) { code = m[1]; input.value = code; renderBoxes(); stopCam(); return; }
            }
          } catch { /* volgende poging */ }
          requestAnimationFrame(tick);
        };
        tick();
      } catch { toast('Camera niet beschikbaar'); }
    });
  }

  s.querySelector('#solo').addEventListener('click', () => { store.mode = 'solo'; });
  s.querySelector('#go').addEventListener('click', async () => {
    const name = s.querySelector('#voornaam').value.trim();
    if (code.length !== 6) { toast('Typ de code van 6 cijfers'); input.focus(); return; }
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

/* ---------- mijn leerpad ------------------------------------------------ */
function screenHome() {
  const letters = letterList();
  const current = nextLetter();
  const doneCount = letters.filter((l) => store.progress[l]).length;
  const av = avatarDef(store.avatar);
  const inSession = store.mode === 'session';
  const title = inSession ? esc(store.name) : 'Oefenen';
  const sub = inSession
    ? `${icon('users', 14, 'currentColor', 2.4)} Sessie ${store.code.replace(/(\d{3})(\d{3})/, '$1 $2')}`
    : 'Alleen oefenen';

  const s = h(`<div class="screen">
    <div class="topbar" style="padding:20px 20px 12px">
      <div style="display:flex; align-items:center; gap:12px">
        <div style="width:48px; height:48px; border-radius:24px; background:${av.bg}; display:flex; align-items:center; justify-content:center">${icon(av.id, 26, av.ink)}</div>
        <div style="display:flex; flex-direction:column">
          <span style="font-size:20px; font-weight:700">${title}</span>
          <span style="font-size:14px; color:${inSession ? 'var(--green-ink)' : 'var(--muted)'}; display:flex; align-items:center; gap:4px">${sub}</span>
        </div>
      </div>
      <span id="spk"></span>
    </div>
    <div style="margin:8px 20px 0; padding:22px; border-radius:24px; background:var(--primary); color:#fff; display:flex; align-items:center; gap:18px">
      <div class="letterfont" style="width:96px; height:96px; flex-shrink:0; border-radius:20px; background:#fff; color:var(--ink); font-size:${current.length > 1 ? 48 : 72}px; line-height:1; display:flex; align-items:center; justify-content:center">${current}</div>
      <div style="display:flex; flex-direction:column; gap:10px; flex-grow:1">
        <span style="font-size:15px">Letter van vandaag</span>
        <button id="startbtn" class="btn small" style="align-self:flex-start; background:#fff; color:var(--primary); padding:0 20px">${icon('play', 20, 'var(--primary)')} Start</button>
      </div>
    </div>
    <div style="padding:24px 20px 8px; display:flex; align-items:baseline; justify-content:space-between">
      <h1 style="font-size:20px">Mijn leerpad</h1>
      <span style="font-size:15px; color:var(--muted)">${doneCount} van ${letters.length} letters</span>
    </div>
    <div id="list" style="flex-grow:1; padding:4px 20px 16px; display:flex; flex-direction:column; gap:10px"></div>
    <nav class="navbar" style="grid-template-columns:repeat(3, minmax(0,1fr))">
      <a href="#home" class="current">${icon('path')} Leerpad</a>
      <button id="navwords" style="opacity:.45">${icon('pencil')} Woorden</button>
      <a href="${inSession ? '#home' : '#join'}" id="navses" ${inSession ? 'class="current"' : ''}>${icon('users')} Sessie</a>
    </nav>
  </div>`);

  s.querySelector('#startbtn').addEventListener('click', () => openLetter(current));
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
      <span style="flex-grow:1; font-size:17px; color:${state === 'next' ? 'var(--muted)' : 'var(--ink)'}">${wordFor(l)}</span>
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
  const dots = [1, 2, 3].map((i) => `<span class="${i <= step ? 'on' : ''}"></span>`).join('');
  const bar = h(`<div class="topbar">
    <a class="iconbtn" href="${backHash}" aria-label="${backLabel}">${icon('back')}</a>
    <div class="stepdots" aria-label="Stap ${step} van 3">${dots}</div>
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

  const hear = h('<span style="width:48px"></span>');
  const s = h(`<div class="screen">
    <div id="top"></div>
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
    <div style="padding:16px 20px 0; display:flex; justify-content:center; gap:12px">
      <button id="again" class="btn ghost small">${icon('redo', 20)} Opnieuw</button>
      <button id="slower" class="chip" style="min-height:52px; border-radius:26px; padding:0 22px; font-weight:700; font-size:16px">${icon('slow', 20)} Trager</button>
    </div>
    <div class="bottombar">
      <a href="#trace" class="btn primary" aria-label="Nu jij: zelf overtrekken" style="flex-grow:1">${icon('arrow', 30, 'currentColor', 2.5)}</a>
    </div>
  </div>`);

  s.querySelector('#top').replaceWith(lessonTop('#home', 'Terug naar mijn leerpad', 1, hear));

  // Animatie: streek per streek, met pennetje.
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
      return { p, len, dot: !!st.dot };
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
      if (t0 === null) { t0 = ts + pause; markerG.innerHTML = startDotMarkup(letter, i, false); markerG.appendChild(pen); }
      const el = (ts - t0) / 1000;
      const dist = Math.max(0, el) * speed;
      const done = Math.min(st.len, dist);
      st.p.style.strokeDashoffset = st.len - done;
      const pt = st.p.getPointAtLength(done);
      pen.setAttribute('cx', pt.x); pen.setAttribute('cy', pt.y);
      if (done >= st.len) { i++; t0 = null; pause = 350; }
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

  const spacer = h('<span style="width:48px"></span>');
  const s = h(`<div class="screen">
    <div id="top"></div>
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
    <div id="fb" class="feedback idle" role="status">
      <span id="fbicon">${icon('checkcircle', 28, 'var(--green-ink)', 2.2)}</span>
      <div style="display:flex; flex-direction:column; gap:2px">
        <span class="fb-title" id="fbtitle">Begin bij het oranje bolletje</span>
      </div>
    </div>
    <div class="card" style="margin:16px 20px 0; padding:14px 16px; display:flex; align-items:center; justify-content:space-between">
      <span style="font-size:15px; color:var(--muted)">Probeer 3 keer</span>
      <div id="chips" style="display:flex; gap:10px"></div>
    </div>
    <div class="bottombar">
      <a href="#write" id="next" class="btn primary" aria-label="Verder naar schrijven" style="flex-grow:1; opacity:.45; pointer-events:none">${icon('arrow', 30, 'currentColor', 2.5)}</a>
    </div>
  </div>`);
  s.querySelector('#top').replaceWith(lessonTop('#watch', 'Terug naar kijken', 2, spacer));

  const svg = s.querySelector('#canvas');
  const letterG = s.querySelector('#letter');
  const inkG = s.querySelector('#ink');
  const markerG = s.querySelector('#marker');
  const fb = s.querySelector('#fb');
  const fbtitle = s.querySelector('#fbtitle');
  const fbicon = s.querySelector('#fbicon');

  function setFb(kind, title) {
    fb.className = `feedback ${kind}`;
    fbtitle.textContent = title;
    fbicon.innerHTML = kind === 'good' ? icon('checkcircle', 28, 'var(--green-ink)', 2.2) : icon('redo', 26, 'var(--orange-ink)', 2.2);
  }

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
      const st = attempts[i] !== undefined ? 'done' : i === attempts.length ? 'now' : 'later';
      const css = {
        done: 'background:var(--green-bg); color:var(--green-ink)',
        now: 'border:2px solid var(--primary); box-sizing:border-box; color:var(--primary); background:#fff',
        later: 'background:var(--neutral); color:var(--muted)',
      }[st];
      chips.appendChild(h(`<span class="letterfont" aria-label="Poging ${i + 1}" style="width:44px; height:44px; border-radius:12px; ${css}; font-size:${letter.length > 1 ? 20 : 28}px; display:flex; align-items:center; justify-content:center">${letter}</span>`));
    }
  }
  updateChips();

  const nextBtn = s.querySelector('#next');
  function unlockNext() { nextBtn.style.opacity = '1'; nextBtn.style.pointerEvents = 'auto'; }

  function resetAttempt() {
    tracer = new Tracer(letter);
    drawing = false;
    updateInk();
    setFb('idle', 'Begin bij het oranje bolletje');
  }

  function finishAttempt() {
    const stars = tracer.stars();
    attempts.push(stars);
    updateChips();
    const txt = stars === 3 ? 'Super! Drie sterren!' : stars === 2 ? 'Goed zo! Twee sterren.' : 'Gelukt! Eén ster.';
    setFb('good', txt);
    unlockNext();
    const best = Math.max(...attempts);
    report(letter, `Overtrekken · ${letter}`, best);
    store.traceStars = best;
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
    if (r === 'wrongStart') {
      setFb('hint', 'Begin bij het oranje bolletje');
    } else {
      drawing = true;
      setFb('good', 'Goed begonnen!');
    }
    updateInk();
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!drawing) return;
    const r = tracer.move(svgPoint(svg, letterG, ev));
    if (r === 'offPath') setFb('hint', 'Blijf bij de lijn');
    else if (r === 'backwards') setFb('hint', 'Andere kant op');
    else if (tracer.fractionDone() > 0.15) setFb('good', 'Goed bezig!');
    updateInk();
  });
  svg.addEventListener('pointerup', () => {
    if (!drawing) return;
    drawing = false;
    const r = tracer.endStroke();
    if (r === 'done-letter') { updateInk(); finishAttempt(); }
    else if (r === 'done-stroke') { setFb('good', 'Goed zo!'); updateInk(); }
    else { setFb('hint', 'Bijna! Nog eens vanaf het bolletje'); tracer.progress = 0; updateInk(); }
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

  const spacer = h('<span style="width:48px"></span>');
  const s = h(`<div class="screen">
    <div id="top"></div>
    <div class="drawbox">
      <svg id="canvas" viewBox="${viewBoxFor(vbW, def.w)}" aria-label="Schrijfvak: schrijf de letter ${letter} drie keer, één keer per beurt">
        <g transform="translate(-400,0)">${guidesMarkup(vbW + 800, store.lines, store.slant)}</g>
        <g id="slot" transform="${letterTransform(vbW, def.w, store.slant)}"></g>
      </svg>
    </div>
    <div id="fb" class="feedback idle" role="status">
      <span id="fbicon">${icon('checkcircle', 28, 'var(--green-ink)', 2.2)}</span>
      <div style="display:flex; flex-direction:column; gap:2px">
        <span class="fb-title" id="fbtitle">Schrijf de letter</span>
      </div>
    </div>
    <div class="card" style="margin:16px 20px 0; padding:14px 16px; display:flex; align-items:center; justify-content:space-between">
      <span style="font-size:15px; color:var(--muted)">Probeer 3 keer</span>
      <div id="chips" style="display:flex; gap:10px"></div>
    </div>
    <div class="bottombar">
      <button id="erase" class="iconbtn" style="width:60px; height:60px; border-radius:30px; border:2px solid var(--border)" aria-label="Uitvegen en opnieuw beginnen">${icon('eraser')}</button>
      <button id="doneBtn" class="btn primary" style="flex-grow:1" disabled>${icon('check', 22, 'currentColor', 2.5)} Klaar</button>
    </div>
  </div>`);
  s.querySelector('#top').replaceWith(lessonTop('#trace', 'Terug naar overtrekken', 3, spacer));

  const svg = s.querySelector('#canvas');
  const slotG = s.querySelector('#slot');
  const fb = s.querySelector('#fb');
  const fbtitle = s.querySelector('#fbtitle');
  const fbicon = s.querySelector('#fbicon');
  function setFb(kind, title) {
    fb.className = 'feedback ' + kind;
    fbtitle.textContent = title;
    fbicon.innerHTML = kind === 'hint' ? icon('redo', 26, 'var(--orange-ink)', 2.2) : icon('checkcircle', 28, 'var(--green-ink)', 2.2);
  }

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
      const st = i < attempts.length ? 'done' : i === attempts.length ? 'now' : 'later';
      const css = {
        done: 'background:var(--green-bg); color:var(--green-ink)',
        now: 'border:2px solid var(--primary); box-sizing:border-box; color:var(--primary); background:#fff',
        later: 'background:var(--neutral); color:var(--muted)',
      }[st];
      chips.appendChild(h(`<span class="letterfont" aria-label="Keer ${i + 1}" style="width:44px; height:44px; border-radius:12px; ${css}; font-size:${letter.length > 1 ? 20 : 28}px; display:flex; align-items:center; justify-content:center">${letter}</span>`));
    }
  }

  const doneBtn = s.querySelector('#doneBtn');

  function nextAttempt() {
    rawInk = [];
    tracer = new Tracer(letter, { tolerance: 52, startRadius: 56 });
    drawing = false;
    renderSlot();
    setFb('idle', 'Schrijf de letter');
  }

  function finishAttempt() {
    attempts.push(1);
    updateChips();
    if (attempts.length >= 3) {
      setFb('good', 'Alles geschreven. Knap!');
      doneBtn.disabled = false;
    } else {
      setFb('good', 'Goed zo!');
      setTimeout(nextAttempt, 900);
    }
  }

  svg.addEventListener('pointerdown', (ev) => {
    if (attempts.length >= 3) return;
    svg.setPointerCapture(ev.pointerId);
    const p = svgPoint(svg, slotG, ev);
    const r = tracer.beginStroke(p);
    if (r === 'wrongStart') {
      // Na een misser tonen we het startpunt ook zonder hulp.
      setFb('hint', 'Begin bij het bolletje');
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
    const r = tracer.move(p);
    if (r === 'backwards') setFb('hint', 'Andere kant op');
  });
  svg.addEventListener('pointerup', () => {
    if (!drawing) return;
    drawing = false;
    const r = tracer.endStroke();
    if (r === 'done-letter') finishAttempt();
    else if (r === 'done-stroke') { setFb('good', 'Goed zo!'); renderSlot(); }
    else {
      setFb('hint', 'Probeer nog eens');
      rawInk.pop();
      updateRawInk();
    }
  });

  s.querySelector('#erase').addEventListener('click', () => {
    if (attempts.length >= 3) return;
    nextAttempt();
  });

  doneBtn.addEventListener('click', () => {
    const stars = store.traceStars || 1;
    store.progress[letter] = { stars };
    report(letter, 'Klaar', stars);
    location.hash = '#home';
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
    code: null, learners: new Map(), started: new Date(),
  };
  const ses = new Session();

  const s = h(`<div class="screen wide">
    <header style="background:var(--card); padding:14px 24px; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; border-radius:0 0 24px 24px">
      <div style="display:flex; align-items:center; gap:12px">
        <span class="letterfont" style="font-size:28px; line-height:1; color:var(--primary)">a</span>
        <span style="font-size:18px; font-weight:700">Letterpad</span>
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
              <span style="font-size:14px; color:var(--muted)">letterpad.local → Aansluiten</span>
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
          <div style="display:flex; flex-wrap:wrap; gap:8px">
            <button class="chip" data-preset="vowels">Klinkers</button>
            <button class="chip" data-preset="consonants">Medeklinkers</button>
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

  /* -- lettertoetsen (azerty) -- */
  const kb = s.querySelector('#kb');
  const ROWS = ['azertyuiop'.split(''), 'qsdfghjklm'.split(''), ['SHIFT', 'w', 'x', 'c', 'v', 'b', 'n', 'ij']];
  function cs(c) { return state.upper ? c.toUpperCase() : c; }
  function renderKb() {
    kb.innerHTML = '';
    ROWS.forEach((row) => {
      const r = document.createElement('div');
      r.style.cssText = 'display:grid; grid-template-columns:repeat(10, minmax(0,1fr)); gap:6px';
      row.forEach((c) => {
        if (c === 'SHIFT') {
          const b = h(`<button class="letterkey" aria-label="Hoofdletters" aria-pressed="${state.upper}" style="grid-column:span 2; ${state.upper ? 'background:var(--primary); color:#fff' : ''}">${icon('shift', 26)}</button>`);
          b.addEventListener('click', () => { state.upper = !state.upper; renderKb(); });
          r.appendChild(b);
          return;
        }
        if (c === 'ij' && state.upper) {
          r.appendChild(h('<span></span>'));
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
    });
  }
  const countEl2 = s.querySelector('#count');
  function updateCount() {
    const n = state.picked.length;
    countEl2.textContent = n === 1 ? '1 letter gekozen' : `${n} letters gekozen`;
  }
  renderKb(); updateCount();

  s.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    const all = [...'abcdefghijklmnopqrstuvwxyz'.split(''), 'ij'];
    const map = {
      vowels: VOWELS, consonants: all.filter((c) => !VOWELS.includes(c) && c !== 'ij'), all, none: [],
    };
    state.picked = map[b.dataset.preset].map(cs);
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
        <span style="color:var(--green-ink); font-weight:700">${l.stars ? '★'.repeat(l.stars) : '–'}</span>
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
    if (msg.stars) l.stars = Math.max(l.stars || 0, msg.stars);
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
      <p style="font-size:22px; color:var(--muted)">Ga naar <strong>letterpad.local</strong> en tik op Aansluiten</p>
      <button class="btn ghost small" id="closeov">Sluiten</button>
    </div>`);
    const qsvg = ov.querySelector('svg');
    if (qsvg) { qsvg.style.width = '100%'; qsvg.style.height = '100%'; }
    ov.querySelector('#closeov').addEventListener('click', () => { ov.remove(); document.exitFullscreen?.(); });
    document.body.appendChild(ov);
    ov.requestFullscreen?.();
  });

  s.querySelector('#stopses').addEventListener('click', () => {
    if (!confirm('Sessie stoppen? Alle resultaten verdwijnen.')) return;
    ses.end();
    ses.close();
    location.hash = '#start';
  });
  s.querySelector('#leave').addEventListener('click', () => { ses.close(); });

  s.cleanup = () => { ses.close(); };
  return s;
}

/* ---------- router ------------------------------------------------------ */
const routes = {
  start: screenStart, join: screenJoin, home: screenHome,
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
