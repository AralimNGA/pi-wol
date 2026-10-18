/* Design "Cockpit": Engine-Start-Panel im Stil eines Overhead-Panels.
   START: Schutzklappe hochklappen -> Kippschalter nach oben ZIEHEN (eigene Geste, ein zweiter Tipp reicht nicht;
   Tastatur: Enter/Leertaste/Pfeil hoch). Der Hebel bleibt wie ein Solenoid-Schalter oben, bis der Rechner wach ist,
   springt dann mit einem Klack zurück, und die Klappe fällt zu. STOP: Klappe hoch -> Kippschalter nach unten
   1.5 s halten, sonst federt er zurück. Vertrag: THEMEN.md. */
(() => {
  'use strict';
  const HALTEN_MS = 1500, ZU_MS = 15000, ANIM_MS = 450, ZUG_PX = 22, N2_IDLE = 61.8;
  const STATUS = { aus: 'AUS', an: 'LÄUFT', startet: 'STARTET', stoppt: 'FÄHRT HERUNTER', unbekannt: 'PRÜFE' };

  /* ---------- Klang: nur WebAudio-Synthese ---------- */
  const rauschCache = new WeakMap();
  function rauschPuffer(a) {
    let b = rauschCache.get(a);
    if (!b) {
      const n = a.sampleRate * 2; b = a.createBuffer(1, n, a.sampleRate);
      const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      rauschCache.set(a, b);
    }
    return b;
  }
  function merk(q, n) { q.add(n); n.onended = () => q.delete(n); return n; }
  function huelle(a, ziel, t, spitze, an, ab) {
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(spitze, t + an);
    g.gain.exponentialRampToValueAtTime(0.0001, t + an + ab); g.connect(ziel); return g;
  }
  function knack(a, q, t, freq, pegel, dauer) {            // Rauschimpuls durch Bandpass (Plastik/Metall)
    const s = merk(q, a.createBufferSource()); s.buffer = rauschPuffer(a);
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.3;
    s.connect(f).connect(huelle(a, a.destination, t, pegel, .0015, dauer));
    s.start(t, Math.random() * 1.5); s.stop(t + dauer + .03);
  }
  function ton(a, q, t, f0, f1, pegel, an, dauer, typ) {
    const o = merk(q, a.createOscillator()); o.type = typ || 'sine';
    o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + an + dauer);
    o.connect(huelle(a, a.destination, t, pegel, an, dauer)); o.start(t); o.stop(t + an + dauer + .03);
  }
  const KLANG = {
    klappe(a, q, zu) {                                     // Schutzklappe: harter Snap der Feder
      const t = a.currentTime;
      knack(a, q, t, zu ? 2500 : 3600, .55, .03);
      ton(a, q, t, zu ? 480 : 820, 170, .14, .002, .05, 'triangle');
      if (zu) knack(a, q, t + .014, 1200, .3, .05);
    },
    schalter(a, q, s = 1) {                                // Kippschalter: metallisches Klack mit Körper
      const t = a.currentTime;
      knack(a, q, t, 5600, .45 * s, .012);
      knack(a, q, t + .007, 2000, .6 * s, .028);
      ton(a, q, t + .004, 230, 85, .3 * s, .002, .07);
    },
    feder(a, q) {                                          // zurückfedern
      const t = a.currentTime;
      knack(a, q, t, 4300, .22, .014);
      ton(a, q, t, 340, 150, .08, .002, .05, 'triangle');
    },
    tick(a, q) { ton(a, q, a.currentTime, 2400, 2400, .035, .001, .02, 'triangle'); },
    turbine(a, q, ab) {                                    // Hochlauf (ab=false) bzw. Auslaufen: Heulen + Luftstrom
      const t = a.currentTime, D = ab ? 3.6 : 6.2, T = ab ? 3.2 : 4.4;
      const m = a.createGain(); m.connect(a.destination);
      m.gain.setValueAtTime(0.0001, t);
      if (ab) { m.gain.exponentialRampToValueAtTime(.11, t + .06); m.gain.setTargetAtTime(0.0001, t + .5, .9); }
      else {
        m.gain.exponentialRampToValueAtTime(.13, t + 1.3); m.gain.setValueAtTime(.13, t + 3.8);
        m.gain.exponentialRampToValueAtTime(0.0001, t + D);
      }
      const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600; lp.connect(m);
      const fa = ab ? 2300 : 150, fe = ab ? 130 : 2500;
      [[1, 'sawtooth', .06], [1.5, 'sine', .3], [2.5, 'sine', .07]].forEach(([k, typ, pg]) => {
        const o = merk(q, a.createOscillator()); o.type = typ;
        o.frequency.setValueAtTime(fa * k, t); o.frequency.exponentialRampToValueAtTime(fe * k, t + T);
        const g = a.createGain(); g.gain.value = pg; o.connect(g).connect(lp); o.start(t); o.stop(t + D + .05);
      });
      const s = merk(q, a.createBufferSource()); s.buffer = rauschPuffer(a); s.loop = true;
      const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .7;
      bp.frequency.setValueAtTime(ab ? 1700 : 240, t); bp.frequency.exponentialRampToValueAtTime(ab ? 180 : 1500, t + T);
      const ng = a.createGain(); ng.gain.value = .85; s.connect(bp).connect(ng).connect(m); s.start(t); s.stop(t + D + .05);
      const r = merk(q, a.createOscillator()); r.type = 'sine';
      r.frequency.setValueAtTime(ab ? 85 : 38, t); r.frequency.exponentialRampToValueAtTime(ab ? 32 : 82, t + T);
      const rg = a.createGain(); rg.gain.value = .45; r.connect(rg).connect(m); r.start(t); r.stop(t + D + .05);
    },
    gong(a, q) {                                           // "AVAIL"-Chime
      const t = a.currentTime;
      ton(a, q, t, 1046.5, 1046.5, .11, .004, 1.5);
      ton(a, q, t, 2093, 2093, .025, .004, .8);
      ton(a, q, t + .002, 1568, 1568, .03, .004, 1.0);
    },
    caution(a, q) {                                        // Master-Caution: kurzes Doppelsignal
      const t = a.currentTime;
      [0, .17].forEach(dt => { ton(a, q, t + dt, 760, 760, .12, .006, .12, 'triangle'); ton(a, q, t + dt, 1520, 1520, .035, .006, .1); });
    },
  };

  /* ---------- Instrument (N2-Anzeige) ---------- */
  const winkel = v => -135 + Math.max(-5, Math.min(110, v)) * 270 / 110;   // unter 0: Nadel liegt am Anschlagstift
  function skala() {
    const C = 60, R = 47, rad = d => d * Math.PI / 180, P = (r, d) => [C + Math.sin(rad(d)) * r, C - Math.cos(rad(d)) * r];
    let s = '';
    for (let v = 0; v <= 110; v += 5) {
      const gross = v % 10 === 0, [x1, y1] = P(R, winkel(v)), [x2, y2] = P(gross ? R - 8 : R - 4.5, winkel(v));
      s += `<line class="${gross ? 'ck-tg' : 'ck-tk'}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`;
      if (v % 20 === 0 && v <= 100) { const [x, y] = P(R - 16, winkel(v)); s += `<text class="ck-zahl" x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}">${v / 10}</text>`; }
    }
    const [px, py] = P(R - 3, winkel(-6.5));
    const [ax, ay] = P(R + .5, winkel(0)), [bx, by] = P(R + .5, winkel(100)), [r1x, r1y] = P(R + 2, winkel(104)), [r2x, r2y] = P(R - 9, winkel(104));
    return `<svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="56" class="ck-zifferblatt"/>
      <path class="ck-bogen" d="M${ax.toFixed(2)} ${ay.toFixed(2)} A${R + .5} ${R + .5} 0 1 1 ${bx.toFixed(2)} ${by.toFixed(2)}"/>
      ${s}<line class="ck-rot" x1="${r1x.toFixed(2)}" y1="${r1y.toFixed(2)}" x2="${r2x.toFixed(2)}" y2="${r2y.toFixed(2)}"/>
      <circle class="ck-stift" cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="1.6"/>
      <text class="ck-einheit" x="60" y="76.5">N2</text><text class="ck-einheit ck-klein" x="60" y="104">%RPM</text>
      <rect class="ck-fenster" x="48" y="79" width="35" height="16" rx="2"/>
      <text class="ck-n2" x="80" y="91.5">0.0</text>
      <g class="ck-zeiger-w"><g class="ck-zeiger" transform="rotate(${winkel(-5).toFixed(2)} 60 60)">
        <path class="ck-nadel" d="M58.7 70 L61.3 70 L60.55 15 L60 12.5 L59.45 15 Z"/>
        <path class="ck-nadel-schwanz" d="M58.5 64 L61.5 64 L61.2 69.5 L58.8 69.5 Z"/>
      </g></g>
      <circle cx="60" cy="60" r="6" class="ck-nabe"/><circle cx="58.6" cy="58.4" r="1.6" class="ck-nabe-licht"/>
    </svg>`;
  }

  const NB = ' ';                                       // geschütztes Leerzeichen (keine verwaisten Auslassungspunkte)
  const VORLAGE = `
    <i class="ck-dzus" style="--ck-dreh:14deg;left:9px;top:9px"></i><i class="ck-dzus" style="--ck-dreh:-36deg;right:9px;top:9px"></i>
    <i class="ck-dzus" style="--ck-dreh:72deg;left:9px;bottom:9px"></i><i class="ck-dzus" style="--ck-dreh:-8deg;right:9px;bottom:9px"></i>
    <div class="ck-kopf">
      <div class="ck-titel"><h2 class="ck-name"></h2><div class="ck-info"></div></div>
      <button class="ck-mc" type="button" aria-label="Störungsmeldung quittieren"><span><small>START</small>FAULT</span></button>
    </div>
    <div class="ck-mitte">
      <div class="ck-links">
        <div class="ck-lampen" aria-hidden="true">
          <div class="ck-lampe ck-l-armed"><span>ARMED</span></div>
          <div class="ck-lampe ck-l-start"><span>START<small>VALVE OPEN</small></span></div>
          <div class="ck-lampe ck-l-avail"><span>AVAIL</span></div>
          <div class="ck-lampe ck-l-shut"><span>SHUT<small>DOWN</small></span></div>
        </div>
        <div class="ck-instr" aria-hidden="true">
          <div class="ck-ring">${skala()}<div class="ck-flagge">OFF</div><div class="ck-glas"></div></div>
        </div>
      </div>
      <div class="ck-schalter">
        <div class="ck-gruppe"><span>ENG START</span></div>
        <div class="ck-buehne" aria-hidden="true"><div class="ck-3d">
          <div class="ck-platte"></div>
          <div class="ck-k-schatten"></div>
          <div class="ck-scheibe"></div><div class="ck-mutter"></div><div class="ck-buchse"></div>
          <div class="ck-h-schatten"></div>
          <div class="ck-hebel"><div class="ck-schaft"></div><div class="ck-kappe"></div></div>
          <div class="ck-scharnier"></div>
          <div class="ck-klappe">
            <i class="ck-k-o"></i><i class="ck-k-oi"></i><i class="ck-k-l"></i><i class="ck-k-li"></i><i class="ck-k-r"></i><i class="ck-k-ri"></i><i class="ck-k-u"></i>
            <i class="ck-k-innen"></i><i class="ck-k-front"></i>
          </div>
        </div></div>
        <div class="ck-skala" aria-hidden="true">
          <span class="ck-pos ck-pos-start">START</span><span class="ck-pos ck-pos-off">OFF</span><span class="ck-pos ck-pos-stop">STOP</span>
          <div class="ck-halte"><i></i></div>
          <div class="ck-inop">INOP</div>
        </div>
        <button class="ck-zone ck-z-klappe" type="button" aria-label="Schutzklappe öffnen"></button>
        <button class="ck-zone ck-z-start" type="button" tabindex="-1" aria-label="Kippschalter nach oben: Starten"></button>
        <button class="ck-zone ck-z-stop" type="button" tabindex="-1" aria-label="Kippschalter nach unten 1.5 Sekunden halten: Ausschalten"></button>
      </div>
    </div>
    <div class="ck-display">
      <b class="ck-d-status">PRÜFE</b><span class="ck-d-text">Status wird abgefragt${NB}…</span><span class="ck-d-zeit" aria-hidden="true"></span>
    </div>`;

  PCW.registriere({
    id: 'cockpit',
    name: 'Cockpit',
    karte(el, geraet, api) {
      el.classList.add('ck-karte');
      el.innerHTML = VORLAGE;
      const $ = s => el.querySelector(s);
      $('.ck-name').textContent = geraet.name;
      $('.ck-info').textContent = geraet.info || '';
      el.setAttribute('aria-label', geraet.name);
      const zKlappe = $('.ck-z-klappe'), zStart = $('.ck-z-start'), zStop = $('.ck-z-stop'), mc = $('.ck-mc');
      const dStatus = $('.ck-d-status'), dText = $('.ck-d-text'), dZeit = $('.ck-d-zeit');
      const zeiger = $('.ck-zeiger'), n2Text = $('.ck-n2');

      // zweck: wofür die Klappe geöffnet wurde ('start' im Zustand aus/unbekannt, 'stop' im Zustand an).
      // Passt der Zustand nicht mehr dazu (z. B. direkt nach dem Start), ist nichts scharf und die Klappe fällt zu.
      let z = 'unbekannt', daten = { ...geraet }, offen = false, offenSeit = 0, zweck = null;
      let eingefroren = false, weg = false, frisch = true;
      let halt = null, zug = null, n2 = 0, n2Raf = 0, startSeit = 0, tickSeit = 0, ctx = null, notiz = null;
      const quellen = new Set();
      const T = { zu: 0, schliessen: 0, tick: 0, notiz: 0, mc: 0, ruetteln: 0, test: 0, turbine: 0, gong: 0, druck: 0 };

      const busy = () => z === 'startet' || z === 'stoppt';
      const startArt = () => z === 'aus' || z === 'unbekannt';
      const zweckPasst = () => (zweck === 'start' && startArt()) || (zweck === 'stop' && z === 'an');
      const startBereit = () => offen && zweck === 'start' && startArt();
      const stopBereit = () => offen && zweck === 'stop' && z === 'an' && !!daten.kann_aus;
      const geste = () => { const a = api.audio(); if (a) ctx = a; return ctx; };
      const klang = (name, ...arg) => { if (!ctx || weg || ctx.state === 'closed') return; try { KLANG[name](ctx, quellen, ...arg); } catch (e) { console.warn('Cockpit-Klang', name, e); } };
      // nur schreiben, was sich ändert (aria-live soll nicht bei jedem Poll neu ansagen)
      const text = (n, t) => { if (n.textContent !== t) n.textContent = t; };
      const attr = (n, a, v) => { if (n.getAttribute(a) !== v) n.setAttribute(a, v); };

      /* ----- Anzeige ----- */
      function hinweisText() {
        if (z === 'startet') return `Magic Packet gesendet · bootet${NB}…`;
        if (z === 'stoppt') return 'Herunterfahren ausgelöst';
        if (halt) return `Halten${NB}…`;
        if (z === 'an') {
          if (!daten.kann_aus) return 'Ausschalten ist nicht eingerichtet';
          return stopBereit() ? 'Kippschalter nach unten 1.5 s halten' : 'Zum Ausschalten Schutzklappe hochklappen';
        }
        if (z === 'unbekannt' && !offen) return `Status wird abgefragt${NB}…`;
        return startBereit() ? 'Kippschalter nach oben ziehen' : 'Schutzklappe hochklappen';
      }
      function hebelPos() { return halt ? 'unten' : (z === 'startet' ? 'oben' : 'mitte'); }
      function zeichnen() {
        const ds = el.dataset, sOk = startBereit(), pOk = stopBereit();
        if (ds.zustand !== z) ds.zustand = z;
        if (ds.offen !== String(offen)) ds.offen = String(offen);
        if (ds.hebel !== hebelPos()) ds.hebel = hebelPos();
        if (ds.armed !== String(sOk || pOk)) ds.armed = String(sOk || pOk);
        el.classList.toggle('ck-kein-aus', !daten.kann_aus);
        text(dStatus, STATUS[z] || z);
        if (!notiz) { text(dText, hinweisText()); dText.classList.remove('ck-fehler', 'ck-notiz'); }
        if (z !== 'startet' || !startSeit) text(dZeit, '');
        zStart.tabIndex = offen ? 0 : -1; zStop.tabIndex = offen ? 0 : -1;
        attr(zStart, 'aria-disabled', String(!sOk));
        attr(zStop, 'aria-disabled', String(!pOk));
        attr(zStop, 'aria-label', daten.kann_aus ? 'Kippschalter nach unten 1.5 Sekunden halten: Ausschalten' : 'Ausschalten ist nicht eingerichtet');
        attr(zKlappe, 'aria-label', offen ? 'Schutzklappe schliessen' : 'Schutzklappe öffnen');
        attr(zKlappe, 'aria-disabled', String(busy()));
        text(n2Text, z === 'unbekannt' ? '--.-' : n2.toFixed(1));
      }
      function notizZeigen(t, fehler) {
        notiz = { fehler: !!fehler };
        text(dText, t);
        dText.classList.add('ck-notiz'); dText.classList.toggle('ck-fehler', !!fehler);
        clearTimeout(T.notiz);
        T.notiz = setTimeout(() => { notiz = null; zeichnen(); }, fehler ? 6000 : 3200);
      }
      function notizWeg(auchFehler) {                 // Hinweise gelten nur bis zur nächsten Handlung bzw. zum nächsten Zustand
        if (!notiz || (notiz.fehler && !auchFehler)) return;
        clearTimeout(T.notiz); notiz = null;
      }
      function ruetteln() {
        el.classList.remove('ck-ruetteln'); void el.offsetWidth; el.classList.add('ck-ruetteln');
        clearTimeout(T.ruetteln); T.ruetteln = setTimeout(() => el.classList.remove('ck-ruetteln'), 450);
      }

      /* ----- N2-Zeiger ----- */
      function n2Zeigen(v) {
        n2 = v;
        zeiger.setAttribute('transform', `rotate(${winkel(v < .3 ? -5 : v).toFixed(2)} 60 60)`);
        text(n2Text, z === 'unbekannt' ? '--.-' : v.toFixed(1));
      }
      function n2Fahrt(ziel, ms) {
        cancelAnimationFrame(n2Raf); n2Raf = 0;
        if (eingefroren || weg || api.reduziert() || ms <= 0 || Math.abs(ziel - n2) < .05) { n2Zeigen(ziel); return; }
        const von = n2, t0 = performance.now();
        const schritt = now => {
          const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
          n2Zeigen(von + (ziel - von) * e);
          n2Raf = p < 1 ? requestAnimationFrame(schritt) : 0;
        };
        n2Raf = requestAnimationFrame(schritt);
      }
      function startTick() {
        if (startSeit) {                              // Laufzeit aus api.seit() (Rahmen) oder ab Start in diesem Design
          const s = Math.max(0, Math.floor((Date.now() - startSeit) / 1000));
          text(dZeit, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
        }
        const s2 = (Date.now() - tickSeit) / 1000;
        if (s2 > 4) n2Fahrt(24 + 13 * (1 - Math.exp(-(s2 - 4) / 45)), 950);   // langsames "Motoring", bis der Rechner antwortet
      }

      /* ----- Schutzklappe ----- */
      function zuTimerNeu() {
        clearTimeout(T.zu);
        T.zu = setTimeout(() => {
          if (eingefroren || weg) return;
          if (halt || zug || z === 'startet') { zuTimerNeu(); return; }
          if (offen) schliessen();
        }, ZU_MS);
      }
      function oeffnen() {
        offen = true; offenSeit = Date.now(); zweck = z === 'an' ? 'stop' : 'start';
        notizWeg(false);
        klang('klappe', false); api.vib(12);
        zeichnen(); zuTimerNeu();
      }
      function schliessen() {
        if (!offen) return;
        haltAbbrechen(); zugAbbrechen();
        offen = false; zweck = null; offenSeit = Date.now();
        clearTimeout(T.zu); clearTimeout(T.schliessen);
        if (document.activeElement === zStart || document.activeElement === zStop) zKlappe.focus({ preventScroll: true });
        klang('klappe', true); api.vib(8);
        zeichnen();
      }
      function planeSchliessen(ms) {
        clearTimeout(T.schliessen);
        T.schliessen = setTimeout(() => { if (offen && !halt && !zug && z !== 'startet' && !eingefroren && !weg) schliessen(); }, ms);
      }

      /* ----- Start: Klappe offen, dann Hebel nach oben ziehen (eigene Geste, kein zweiter Tipp) ----- */
      function ausloesen() {
        if (eingefroren || weg || !offen || Date.now() - offenSeit < ANIM_MS) return;
        if (!startArt()) { if (z === 'an') { notizZeigen('Läuft bereits', false); klang('feder'); } return; }
        if (zweck !== 'start') return;
        geste(); clearTimeout(T.zu); notizWeg(true);
        klang('schalter'); api.vib([25, 40, 60]);
        clearTimeout(T.turbine); T.turbine = setTimeout(() => klang('turbine', false), 90);
        api.starten().catch(() => {});        // setzt sofort 'startet' -> Hebel bleibt oben, bis der Rechner wach ist
      }
      function zugStart(e, unten) {
        if (eingefroren || weg || zug || halt || !offen || busy()) return;
        if (Date.now() - offenSeit < ANIM_MS) return;                 // Regel 5: während der Klappen-Animation nichts
        if (!startBereit()) {
          if (z === 'an' && !unten) { notizZeigen('Läuft bereits', false); klang('feder'); }
          return;
        }
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
        geste(); clearTimeout(T.zu); clearTimeout(T.schliessen); notizWeg(false);
        zug = { id: e.pointerId, y0: e.clientY, x0: e.clientX, weg: 0, unten: !!unten };
        el.dataset.zug = 'true'; el.style.setProperty('--ck-zug', '0');
      }
      function zugBewegung(e) {
        if (!zug || e.pointerId !== zug.id) return;
        const dy = zug.y0 - e.clientY;
        zug.weg = Math.max(zug.weg, Math.abs(dy), Math.abs(e.clientX - zug.x0));
        const p = Math.max(0, Math.min(1, dy / ZUG_PX));
        el.style.setProperty('--ck-zug', p.toFixed(3));
        if (p >= 1) { zugAbbrechen(); ausloesen(); }
      }
      function zugAbbrechen() {
        if (!zug) return;
        zug = null;
        delete el.dataset.zug; el.style.removeProperty('--ck-zug');
      }
      function zugEnde(e) {                           // losgelassen, bevor der Hebel oben war: federt zurück
        if (!zug || (e && e.pointerId !== zug.id)) return;
        const { weg: w, unten } = zug;
        zugAbbrechen();
        klang('feder');
        notizZeigen(w >= 6 ? 'Weiter nach oben ziehen' : (unten ? 'Gerät ist aus · zum Starten nach oben ziehen' : 'Zum Starten Kippschalter nach oben ziehen'), false);
        zeichnen(); zuTimerNeu();
      }

      /* ----- Stop (halten) ----- */
      function haltenStart() {
        if (eingefroren || weg || halt || zug || !offen || Date.now() - offenSeit < ANIM_MS) return;
        if (z !== 'an') {
          if (startArt()) { klang('feder'); notizZeigen('Gerät ist aus · Kippschalter nach oben = Start', false); }
          return;
        }
        if (!daten.kann_aus) { notizZeigen('Ausschalten ist nicht eingerichtet', false); ruetteln(); return; }
        if (zweck !== 'stop') return;                 // Klappe wurde nicht für den Stop geöffnet
        geste(); clearTimeout(T.zu); clearTimeout(T.schliessen); notizWeg(true);
        const t0 = performance.now(); let stufe = 0;
        const schritt = now => {                       // nur Anzeige; ausgelöst wird über den Timer
          if (!halt) return;
          const p = Math.min(1, (now - t0) / HALTEN_MS);
          el.style.setProperty('--ck-p', p.toFixed(3));
          const s = Math.floor(p * 3);
          if (s > stufe && p < 1) { stufe = s; klang('tick'); api.vib(8); }
          if (p < 1) halt.raf = requestAnimationFrame(schritt);
        };
        halt = { raf: requestAnimationFrame(schritt), timer: setTimeout(stoppAusloesen, HALTEN_MS) };
        klang('schalter', .7); api.vib(15);
        zeichnen();
      }
      function haltAbbrechen() {
        if (!halt) return;
        cancelAnimationFrame(halt.raf); clearTimeout(halt.timer); halt = null;
        el.style.setProperty('--ck-p', 0);
      }
      function haltenEnde() {
        if (!halt) return;
        haltAbbrechen();
        klang('feder');
        notizZeigen('Zu früh losgelassen · 1.5 s halten', false);
        zeichnen(); zuTimerNeu();
      }
      function stoppAusloesen() {
        if (!halt || z !== 'an' || !offen) { haltAbbrechen(); zeichnen(); return; }
        haltAbbrechen(); notizWeg(true);
        klang('schalter'); api.vib(80);
        klang('turbine', true);
        api.stoppen().catch(() => {});        // setzt sofort 'stoppt'; der Hebel federt zurück
        zeichnen(); planeSchliessen(650);
      }

      /* ----- Zustandswechsel ----- */
      function wechsel(alt, neu) {
        clearInterval(T.tick); T.tick = 0;
        notizWeg(false);                               // Fehlermeldungen bleiben stehen, Hinweise nicht
        if (alt === 'startet') {                       // Solenoid lässt los: Hebel springt zurück
          klang('schalter', .85); api.vib(20);
          if (neu === 'an') { clearTimeout(T.gong); T.gong = setTimeout(() => klang('gong'), 170); }
        }
        if (halt && neu !== 'an') haltAbbrechen();
        if (zug && !startArt()) zugAbbrechen();
        // Klappe passt nicht mehr zum Zustand (z. B. gerade gestartet): nichts ist scharf, sie fällt gleich zu
        if (offen && !busy() && !zweckPasst()) planeSchliessen(alt === 'startet' ? 420 : 300);
        if (neu === 'startet') {
          startSeit = (api.seit && api.seit()) || (frisch ? 0 : Date.now()); tickSeit = Date.now();
          n2Fahrt(frisch ? 27 : 24, frisch ? 1200 : 4200);
          T.tick = setInterval(startTick, 1000); startTick();
        }
        else if (neu === 'an') n2Fahrt(N2_IDLE, alt === 'startet' ? 2600 : 1400);
        else if (neu === 'stoppt') n2Fahrt(14, 3800);
        else n2Fahrt(0, alt === 'stoppt' ? 2600 : 900);
      }

      /* ----- Bedienung ----- */
      zKlappe.addEventListener('click', () => {
        if (eingefroren || Date.now() - offenSeit < ANIM_MS) return;
        geste();
        if (busy()) { ruetteln(); klang('feder'); return; }
        if (offen) { schliessen(); return; }
        if (z === 'an' && !daten.kann_aus) {
          ruetteln(); klang('feder'); api.vib([20, 40, 20]);
          notizZeigen('Ausschalten ist nicht eingerichtet', false); return;
        }
        oeffnen();
      });
      // Start: Zeiger/Touch = Hebel nach oben ziehen; Tastatur/Screenreader = Enter, Leertaste oder Pfeil hoch
      zStart.addEventListener('pointerdown', e => { if (!offen || e.button > 0) return; e.preventDefault(); zugStart(e, false); });
      zStart.addEventListener('click', e => { if (e.detail === 0) ausloesen(); });
      zStart.addEventListener('keydown', e => { if (e.key === 'ArrowUp') { e.preventDefault(); ausloesen(); } });
      zStop.addEventListener('pointerdown', e => {
        if (!offen || e.button > 0) return;
        e.preventDefault();
        if (z !== 'an') { zugStart(e, true); return; }  // im Zustand aus: Hebel lässt sich auch von unten hochziehen
        try { zStop.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
        haltenStart();
      });
      [zStart, zStop].forEach(b => {
        b.addEventListener('pointermove', zugBewegung);
        b.addEventListener('pointerup', zugEnde);
        b.addEventListener('lostpointercapture', zugEnde);
        b.addEventListener('pointercancel', e => { if (zug && e.pointerId === zug.id) { zugAbbrechen(); zeichnen(); zuTimerNeu(); } });
        b.addEventListener('contextmenu', e => e.preventDefault());
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => zStop.addEventListener(t, haltenEnde));
      zStop.addEventListener('keydown', e => {
        if (![' ', 'Enter', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault(); if (!e.repeat) haltenStart();
      });
      zStop.addEventListener('keyup', e => { if ([' ', 'Enter', 'ArrowDown'].includes(e.key)) { e.preventDefault(); haltenEnde(); } });
      zStop.addEventListener('blur', haltenEnde);
      zKlappe.addEventListener('contextmenu', e => e.preventDefault());
      mc.addEventListener('click', () => {
        geste();
        el.classList.add('ck-mc-druck'); clearTimeout(T.druck); T.druck = setTimeout(() => el.classList.remove('ck-mc-druck'), 140);
        if (el.classList.contains('ck-caution')) { el.classList.remove('ck-caution'); clearTimeout(T.mc); }
        klang('feder');
      });

      /* Lampentest beim Einschalten des Designs */
      if (!api.reduziert()) { el.classList.add('ck-lampentest'); T.test = setTimeout(() => el.classList.remove('ck-lampentest'), 650); }
      n2Zeigen(0);
      zeichnen();

      return {
        setze(neu, d) {
          if (eingefroren || weg) return;
          const alt = z; z = neu; if (d) daten = d;
          // Design mitten im Start gewechselt: der Hebel steht oben und hält die Klappe offen
          if (frisch && neu === 'startet') { offen = true; zweck = 'start'; offenSeit = Date.now() - ANIM_MS; }
          if (alt !== z) wechsel(alt, z);
          else if (z === 'an' && !n2Raf) n2Fahrt(N2_IDLE + (Math.random() - .5) * .5, 900);   // Leerlauf pendelt leicht
          frisch = false;
          zeichnen();
        },
        meldung(t, fehler) {
          if (weg) return;
          notizZeigen(t, fehler);
          if (fehler) {
            el.classList.add('ck-caution'); clearTimeout(T.mc);
            T.mc = setTimeout(() => el.classList.remove('ck-caution'), 12000);
            klang('caution'); api.vib([40, 60, 40]);
          }
        },
        vorschau(stufe) {
          eingefroren = true;
          Object.keys(T).forEach(k => { clearTimeout(T[k]); clearInterval(T[k]); });
          cancelAnimationFrame(n2Raf); el.classList.remove('ck-lampentest');
          const map = {
            ruhe: ['aus', false, 0], bereit: ['aus', true, 0], startet: ['startet', true, 27.4],
            an: ['an', false, N2_IDLE], 'an-bereit': ['an', true, N2_IDLE], stoppt: ['stoppt', false, 18.6],
          };
          const [zz, o, wert] = map[stufe] || map.ruhe;
          z = zz; offenSeit = 0; notiz = null;
          offen = o && !(zz === 'an' && !daten.kann_aus);   // nicht abschaltbar: Klappe bleibt zu (gesperrt)
          zweck = offen ? (zz === 'an' ? 'stop' : 'start') : null;
          startSeit = zz === 'startet' ? 1 : 0;
          n2Zeigen(wert); zeichnen();
          if (zz === 'startet') dZeit.textContent = '0:07';
        },
        entfernen() {
          weg = true;
          Object.keys(T).forEach(k => { clearTimeout(T[k]); clearInterval(T[k]); });
          cancelAnimationFrame(n2Raf);
          haltAbbrechen(); zugAbbrechen();
          quellen.forEach(s => { try { s.stop(); } catch (e) { /* schon gestoppt */ } });
          quellen.clear();
          // geteiltes <section> sauber zurückgeben (der Rahmen setzt nur className und Inhalt zurück)
          ['zustand', 'offen', 'hebel', 'armed', 'zug'].forEach(k => { delete el.dataset[k]; });
          el.style.removeProperty('--ck-p'); el.style.removeProperty('--ck-zug');
          if (!el.getAttribute('style')) el.removeAttribute('style');
          el.removeAttribute('aria-label');
        },
      };
    },
  });
})();
