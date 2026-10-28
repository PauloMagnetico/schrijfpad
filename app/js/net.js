/* Schrijfpad — verbinding met de sessieserver (WebSocket).
 * Fase 1: sessies zonder geheugen. De server bewaart niets; valt de
 * verbinding weg, dan proberen we opnieuw aan te sluiten met dezelfde code.
 */

export class Session {
  constructor() {
    this.ws = null;
    this.handlers = {};
    this.closedByUs = false;
    this._rejoin = null;
  }

  on(type, fn) { this.handlers[type] = fn; return this; }
  _emit(type, msg) { if (this.handlers[type]) this.handlers[type](msg); }

  connect() {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => { this.ws = ws; resolve(); };
      ws.onerror = () => reject(new Error('geen verbinding'));
      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        this._emit(msg.type, msg);
      };
      ws.onclose = () => {
        this.ws = null;
        if (!this.closedByUs) {
          this._emit('disconnected', {});
          if (this._rejoin) setTimeout(() => this._tryRejoin(), 1500);
        }
      };
    });
  }

  async _tryRejoin() {
    if (this.closedByUs) return;
    try {
      await this.connect();
      this.send(this._rejoin);
    } catch {
      setTimeout(() => this._tryRejoin(), 3000);
    }
  }

  send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  // Leerkracht: start een sessie; antwoord komt als 'created' { code }.
  create() { this.send({ type: 'create' }); }

  // Leerder: sluit aan; antwoord 'joined' of 'badCode'.
  join(code, name) {
    this._rejoin = { type: 'join', code, name };
    this.send(this._rejoin);
  }

  // Leerkracht: stuur een opdracht naar alle leerders.
  assign(letters, slant, lines, help) { this.send({ type: 'assign', letters, slant, lines, help }); }

  // Leerder: meld voortgang (stap, letter, sterren).
  progress(letter, step, stars) { this.send({ type: 'progress', letter, step, stars }); }

  end() { this.send({ type: 'end' }); }

  close() {
    this.closedByUs = true;
    if (this.ws) this.ws.close();
  }
}
