# Schrijfpad

Leer schrijven in lopend blokschrift, letter per letter. Een moderne versie van
de letteranimaties van syboor.eu: de letter tekent zichzelf, daarna overtrekt
en schrijft de leerling met de vinger of een stylus en krijgt meteen feedback
op **beginpunt, richting en volgorde**. Gemaakt voor volwassen leerlingen en
hun lesgever.

Gratis, zonder accounts, werkt offline (PWA).

- **Alleen oefenen:** kies letters of woorden, daarna een eigen leerpad of de
  geheugenoefening. Werkt overal, ook op GitHub Pages:
  <https://paulomagnetico.github.io/schrijfpad/>
- **Groepssessie (fase 1, zonder geheugen):** de lesgever start een sessie en
  krijgt een cijfercode + QR, leerlingen sluiten aan, resultaten verschijnen
  live, en bij het stoppen verdwijnt alles. Er is geen database. Sessies
  hebben de sessieserver (`server/`) nodig en werken dus niet op Pages.

## Structuur

- `app/` — de webapp (vanilla JS + SVG, geen build-stap)
  - `js/strokes.js` — streekdata, gegenereerd uit de Loblosch-animaties van
    syboor.eu (`tools/gen-strokes.mjs`, bron in `tools/loblosch-anim/`)
  - `js/letters.js` — klanken, referentiewoorden en aanleervolgorde
  - `js/engine.js` — overtrek-motor: bewegingen, beginpunt, richting, sterren
  - `js/main.js` — schermen en routering (hash-routes)
  - `js/net.js` — WebSocket-sessieclient
- `server/server.js` — statische server + sessierelais (Node + ws);
  sessies leven alleen in het geheugen
- `.github/workflows/pages.yml` — publiceert `app/` op GitHub Pages

## Draaien

```sh
cd server && npm install && node server.js   # http://localhost:8080
```

Of met Docker (op WerkBak, achter de gedeelde Caddy-proxy):

```sh
docker compose up -d --build   # → http://schrijfpad.local (en :8083 direct)
```

`schrijfpad.local` wordt op het LAN aangekondigd door de user-unit
`schrijfpad-mdns.service` (avahi) en gerouteerd door de `proxy`-container
(`~/proxy/Caddyfile`). Het oude adres `letterpad.local` stuurt door.

## Later (bewust nog niet in fase 1)

- Groepssessies zonder eigen server (bv. sessierelais op Cloudflare Workers)
- Voortgang bewaren op het toestel; blijvende klassen met login
- Geluid (opgenomen klanken; de robotstem van de Web Speech API beviel niet)
- Verbonden schrift en verbindingshalen
- Uitleg in het Arabisch, Tigrinya, Oekraïens, Dari…

## Lettermodel

De lettervormen en schrijfvolgorde volgen het lopend blokschrift (Loblosch)
van [syboor.eu](https://syboor.eu/handschrift/trajecten/animatie_loblosch).
De licentie voor hergebruik is nog niet bevestigd door de eigenaar.
