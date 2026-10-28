/* Schrijfpad sessieserver — fase 1: sessies zonder geheugen.
 * Serveert de statische app en relayeert sessieverkeer via WebSocket.
 * Alles leeft in het geheugen van dit proces; er is geen database en
 * bij het stoppen van een sessie (of de server) is alles weg.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const APP_DIR = path.join(__dirname, '..', 'app');

/* ---------- statische bestanden ---------------------------------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(`ok, ${sessions.size} sessies\n`);
    return;
  }
  let p = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  if (p === '/' || p === '\\') p = '/index.html';
  const file = path.join(APP_DIR, p);
  if (!file.startsWith(APP_DIR)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) {
      // SPA: onbekende paden zonder extensie → index.html
      if (!path.extname(p)) {
        fs.readFile(path.join(APP_DIR, 'index.html'), (e2, idx) => {
          if (e2) { res.writeHead(404); res.end('niet gevonden'); return; }
          res.writeHead(200, { 'content-type': MIME['.html'] });
          res.end(idx);
        });
        return;
      }
      res.writeHead(404); res.end('niet gevonden');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': path.extname(file) === '.woff2' ? 'public, max-age=604800' : 'no-cache',
    });
    res.end(data);
  });
});

/* ---------- sessies ------------------------------------------------------ */
// code → { teacher: ws|null, teacherAway: timestamp|null, learners: Map(id → {ws,name,avatar}), assignment }
const sessions = new Map();

const TEACHER_GRACE_MS = 10 * 60 * 1000;  // leerkracht mag 10 min wegvallen
const SWEEP_EVERY_MS = 60 * 1000;

function newCode() {
  let code;
  do {
    code = String(crypto.randomInt(100000, 1000000));
  } while (sessions.has(code));
  return code;
}

function send(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

function roster(s) {
  return [...s.learners.entries()].map(([id, l]) => ({
    id, name: l.name, avatar: l.avatar, connected: l.ws !== null,
  }));
}

function endSession(code, s) {
  for (const l of s.learners.values()) send(l.ws, { type: 'ended' });
  sessions.delete(code);
  console.log(`sessie ${code} gestopt (${s.learners.size} leerders)`);
}

setInterval(() => {
  const now = Date.now();
  for (const [code, s] of sessions) {
    if (!s.teacher && s.teacherAway && now - s.teacherAway > TEACHER_GRACE_MS) {
      endSession(code, s);
    }
  }
}, SWEEP_EVERY_MS).unref();

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  // Per verbinding: rol wordt bepaald door het eerste bericht.
  let role = null;       // 'teacher' | 'learner'
  let code = null;
  let learnerId = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (typeof msg !== 'object' || !msg) return;

    if (msg.type === 'create') {
      code = newCode();
      role = 'teacher';
      sessions.set(code, { teacher: ws, teacherAway: null, learners: new Map(), assignment: null });
      send(ws, { type: 'created', code });
      console.log(`sessie ${code} gestart`);
      return;
    }

    if (msg.type === 'join') {
      const s = sessions.get(String(msg.code));
      if (!s) { send(ws, { type: 'badCode' }); return; }
      role = 'learner';
      code = String(msg.code);
      learnerId = crypto.randomUUID();
      const name = String(msg.name || '').slice(0, 40);
      const avatar = String(msg.avatar || 'zon').slice(0, 20);
      s.learners.set(learnerId, { ws, name, avatar });
      send(ws, { type: 'joined', assignment: s.assignment });
      send(s.teacher, { type: 'roster', learners: roster(s) });
      return;
    }

    const s = code && sessions.get(code);
    if (!s) return;

    if (role === 'teacher') {
      if (msg.type === 'assign') {
        const letters = Array.isArray(msg.letters) ? msg.letters.map(String).slice(0, 60) : [];
        const help = ['dots', 'start', 'none'].includes(msg.help) ? msg.help : 'start';
        s.assignment = { letters, slant: !!msg.slant, lines: Number(msg.lines) || 0, help };
        for (const l of s.learners.values()) {
          send(l.ws, { type: 'assign', ...s.assignment });
        }
      } else if (msg.type === 'end') {
        endSession(code, s);
        code = null;
      }
    } else if (role === 'learner') {
      if (msg.type === 'progress') {
        send(s.teacher, {
          type: 'progress',
          id: learnerId,
          letter: String(msg.letter || '').slice(0, 4),
          step: String(msg.step || '').slice(0, 60),
          stars: Math.max(0, Math.min(3, Number(msg.stars) || 0)),
        });
      }
    }
  });

  ws.on('close', () => {
    const s = code && sessions.get(code);
    if (!s) return;
    if (role === 'teacher' && s.teacher === ws) {
      s.teacher = null;
      s.teacherAway = Date.now();
    } else if (role === 'learner' && learnerId) {
      const l = s.learners.get(learnerId);
      if (l && l.ws === ws) {
        l.ws = null;
        send(s.teacher, { type: 'roster', learners: roster(s) });
      }
    }
  });
});

server.listen(PORT, () => console.log(`schrijfpad op :${PORT}`));
