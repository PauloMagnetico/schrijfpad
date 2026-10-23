# Letterpad

Leer schrijven in een nieuw alfabet, letter per letter. Een moderne versie van
de letteranimaties van syboor.eu voor lopend blokschrift: de letter tekent
zichzelf, daarna overtrekt en schrijft de leerling met de vinger of een stylus
en krijgt meteen feedback op **beginpunt, richting en volgorde**.

Gratis, zonder accounts, werkt offline (PWA). **Fase 1: sessies zonder
geheugen** — de leerkracht start een sessie en krijgt een cijfercode + QR,
leerders sluiten aan, resultaten verschijnen live, en bij het stoppen van de
sessie verdwijnt alles. Er is geen database.

## Structuur

- `app/` — de webapp (vanilla JS + SVG, geen build-stap)
  - `js/letters.js` — streekdata: elk letterpad is een SVG-pad in
    schrijfrichting, met de schrijfvolgorde als volgorde van de strokes
  - `js/engine.js` — overtrek-motor: beginpunt, richting, volgorde, sterren
  - `js/main.js` — schermen en routering (hash-routes)
  - `js/net.js` — WebSocket-sessieclient
- `server/server.js` — statische server + sessierelais (Node + ws);
  sessies leven alleen in het geheugen

## Draaien

```sh
cd server && npm install && node server.js   # http://localhost:8080
```

Of met Docker (op WerkBak, achter de gedeelde Caddy-proxy):

```sh
docker compose up -d --build   # → http://letterpad.local (en :8083 direct)
```

`letterpad.local` wordt op het LAN aangekondigd door de user-unit
`letterpad-mdns.service` (avahi) en gerouteerd door de `proxy`-container
(`~/proxy/Caddyfile`).

## Later (bewust nog niet in fase 1)

- Voortgang bewaren op het toestel; blijvende klassen met login
- Geluid (opgenomen klanken; de robotstem van de Web Speech API beviel niet)
- Oefenbladen afdrukken
- Verbonden schrift en verbindingshalen; eigen woorden
- Uitleg in het Arabisch, Tigrinya, Oekraïens, Dari…
- Licentievraag syboor.eu: de streekdata hier is zelf geschreven, maar het
  lettermodel afstemmen op het origineel vergt een antwoord van de eigenaar.
