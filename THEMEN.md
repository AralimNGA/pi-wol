# THEMEN.md – Vertrag für Design-Module der Startzentrale (bindend)

Die Weboberfläche (`pi/web/`) besteht aus einem festen Rahmen (`index.html`, `basis.css`, `app.js`) und
austauschbaren Designs. Ein Design = genau zwei Dateien: `pi/web/themes/<id>.js` und `pi/web/themes/<id>.css`.
Feste IDs: `lambo` (Name „Supersportwagen“), `cockpit` („Cockpit“), `atom` („Abschuss“).

## Was ein Design darf und muss

- **Nur die eigenen zwei Dateien ändern.** Rahmen-Änderungen nicht selbst machen, sondern als Wunsch melden.
- **Alles CSS unter `body.thema-<id>`** verschachteln (keine globalen Selektoren, keine `:root`-Variablen ohne
  Präfix, Keyframes mit Präfix `<id>-`). Erlaubt: `body.thema-<id>` selbst (Hintergrund, Schrift),
  `body.thema-<id> .pcw-kopf/.pcw-kicker/h1/.pcw-wahl/.pcw-raster/.pcw-fuss` umstylen. Der Umschalter
  `.pcw-wahl` muss sichtbar, lesbar und bedienbar bleiben.
- **JS als IIFE**, keine globalen Variablen ausser dem Aufruf `PCW.registriere({...})`. Keine externen Dateien,
  keine CDNs, keine Bilder/Fonts von aussen (der Pi kann offline sein). SVG inline, Grafiken mit CSS/SVG.
- **Keine Emojis, keine Markenlogos/Markennamen** (kein Stier, kein „Lamborghini“, keine Airline-/Hersteller-Logos,
  kein echtes Staatswappen). Texte auf Deutsch (Schweizer Schreibweise: ss statt ß, echte Umlaute im UI),
  Beschriftungen im Stil des Vorbilds dürfen Englisch sein (ENGINE START, MASTER ARM, LAUNCH …).

## Registrierung

```js
PCW.registriere({
  id: 'cockpit',
  name: 'Cockpit',
  karte(el, geraet, api) {   // el = leeres <section class="pcw-karte">, das Design füllt es komplett
    // geraet = {id, name, info, wach, kann_aus}
    return {
      setze(zustand, daten) {},    // bei jedem Poll (3 s) und jeder Zustandsänderung, muss idempotent sein
      meldung(text, fehler) {},    // kurze Meldung anzeigen (Fehler vom Server, z. B. "Pi nicht erreichbar")
      vorschau(stufe) {},          // nur Screenshots: Optik fest in eine Stufe setzen (siehe unten)
      entfernen() {},              // Timer, Listener, Audio-Knoten aufräumen (Design-Wechsel)
    };
  },
});
```

`zustand` ∈ `aus` | `an` | `startet` | `stoppt` | `unbekannt` (Rahmen berechnet ihn aus Server-Status + laufender Aktion).

`api` (vom Rahmen):

| | |
|---|---|
| `api.starten()` | Promise `{ok, text}`. Nur wenn `aus`/`unbekannt`. Setzt sofort `startet`, ruft danach `setze()`. |
| `api.stoppen()` | Promise `{ok, text}`. Nur wenn `an` und `kann_aus`. Setzt sofort `stoppt`. |
| `api.zustand()`, `api.daten()` | aktueller Stand |
| `api.seit()` | Startzeitpunkt (ms) der laufenden Aktion `startet`/`stoppt`, sonst `null` – auch nach Designwechsel |
| `api.audio()` | gemeinsamer `AudioContext` (nur in einer Nutzergeste aufrufen; kann `null` sein) |
| `api.vib(muster)` | Vibration (Handy), still wenn nicht verfügbar |
| `api.reduziert()` | `prefers-reduced-motion` aktiv |

## Sicherheitsregeln (für alle Designs gleich)

1. **Start braucht zwei Schritte**: erst entsichern (Klappe, Schutzbügel, Schlüssel …), dann auslösen.
   Ein einzelner Tipp oder ein Fehlklick darf nie ein Gerät starten.
2. **Stop braucht mindestens zwei Schritte UND ein Halten von ≥ 1.5 s** (oder einen gleichwertig bewussten
   Schritt, z. B. Schlüssel drehen + halten). Ist `kann_aus` false: Stop sichtbar gesperrt mit Hinweis
   „Ausschalten ist nicht eingerichtet“.
3. Entsicherung fällt nach spätestens 15 s ohne Aktion von selbst zurück.
4. Während `startet`/`stoppt` keine zweite Aktion auslösbar.
5. Klicks während einer laufenden Entsicherungs-Animation (≤ 450 ms) werden ignoriert (sonst Doppeltipp-Fehler).

## Zustände, die sichtbar unterscheidbar sein müssen

`aus` · `an` · `startet` (läuft, bis der Server „wach“ meldet, bis zu 3 min) · `stoppt` · `unbekannt` (noch kein Status),
dazu je Design „entsichert“ (bereit). Gerätename + `info` sichtbar. Bedienbar per Maus, Touch und Tastatur
(Buttons mit `aria-label`, sichtbarer Fokus). Handy 375 px breit ohne horizontales Scrollen, Desktop bis 880 px
Rasterbreite (zwei Karten nebeneinander). `prefers-reduced-motion` respektieren.

## Vorschau-Stufen (`vorschau(stufe)`, nur für Screenshots)

`ruhe` (aus, gesichert) · `bereit` (aus, entsichert) · `startet` · `an` (an, gesichert) · `an-bereit`
(an, entsichert für Stop) · `stoppt`. Die Stufe bleibt stehen (keine Auto-Rücksicherung in der Vorschau).

## Testen

```bash
cd pi/web && python3 -m http.server 8712            # oder: Server läuft schon
open "http://localhost:8712/?demo&thema=cockpit"    # Demo: Render-PC aus (Stop erlaubt), ThinkPad an (Stop gesperrt)
node tools/shot.mjs --url "http://localhost:8712/?demo&thema=cockpit&vorschau=bereit" --out shots/cockpit-bereit.png --w 1280 --h 900
node tools/shot.mjs --url "..." --out shots/x-mobil.png --w 375 --h 812 --dpr 2 --mobile --full
```
Im Demo-Modus wird ein gestartetes Gerät nach 6 s „wach“, ein gestopptes nach 4 s „aus“.
