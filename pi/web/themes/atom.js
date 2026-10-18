/* Design "Abschuss": Kalter-Krieg-Startkonsole. Grosser roter Pilzknopf unter klappbarer Schutzhaube,
   Schluesselschalter SAFE/ARM, Countdown 3-2-1, Rundumleuchte, Schablonenschrift aus eigenen SVG-Glyphen.
   Ablauf Start: Schluessel ARM -> Haube hoch -> LAUNCH -> 3-2-1 (abbrechbar) -> api.starten().
   Ablauf Stop:  Schluessel ARM -> SHUTDOWN 1.5 s halten. Vertrag: THEMEN.md. */
(() => {
  'use strict';
  const HALTEN_MS = 1500, ZU_MS = 15000, ANIM_MS = 450, ZAEHLEN = 3, NACH_ZUENDUNG_MS = 1200,
    ABBRUCH_FEST_MS = 2000, WEG_TOLERANZ = 24, SEGMENTE = 5;
  let zaehler = 0;

  /* ---------- Schablonenschrift: Glyphen als Mittellinien, Stege = Luecken zwischen den Strichen ---------- */
  const S = 2, H = 10, h = S / 2, G = .9, SP = 1.2, R0 = 1.6;
  const GL = {};
  function def(zeichen, W, f, rad) {
    const l = h, r = W - h, t = h, b = H - h, m = H / 2, c = W / 2, x0 = l + h + G;
    GL[zeichen] = { W, rad: rad || R0, linien: f({ l, r, t, b, m, c, x0, W }) };
  }
  const O_ = ({ l, r, t, b, c }) => [[[c - G / 2, t], [l, t], [l, b], [c - G / 2, b]], [[c + G / 2, t], [r, t], [r, b], [c + G / 2, b]]];
  def('A', 6.8, ({ l, r, t, m, c }) => [[[l, H], [l, t], [c - G / 2, t]], [[c + G / 2, t], [r, t], [r, H]], [[l, m + .5], [r - h - G, m + .5]]]);
  def('B', 6.8, ({ l, r, t, b, m, x0 }) => [[[l, 0], [l, H]], [[x0, t], [r, t], [r, b], [x0, b]], [[x0, m], [r, m]]]);
  def('C', 6.6, ({ l, r, t, b }) => [[[r, t + 2.4], [r, t], [l, t], [l, b], [r, b], [r, b - 2.4]]]);
  def('D', 6.8, ({ l, r, t, b, x0 }) => [[[l, 0], [l, H]], [[x0, t], [r, t], [r, b], [x0, b]]], 2.6);
  def('E', 6, ({ l, t, b, m, x0, W }) => [[[l, 0], [l, H]], [[x0, t], [W, t]], [[x0, m], [W - .7, m]], [[x0, b], [W, b]]]);
  def('F', 6, ({ l, t, m, x0, W }) => [[[l, 0], [l, H]], [[x0, t], [W, t]], [[x0, m], [W - .7, m]]]);
  def('G', 6.8, ({ l, r, t, b, m, c }) => [[[r, t + 2.4], [r, t], [l, t], [l, b], [r, b], [r, m], [c, m]]]);
  def('H', 6.8, ({ l, r, m }) => [[[l, 0], [l, H]], [[r, 0], [r, H]], [[l, m], [r, m]]]);
  def('I', S, ({ c }) => [[[c, 0], [c, H]]]);
  def('J', 6.2, ({ l, r, b }) => [[[r, 0], [r, b], [l, b], [l, b - 2.6]]]);
  def('K', 6.6, ({ l, r, t, b, m, x0 }) => [[[l, 0], [l, H]], [[r + .3, t - .4], [x0 + .2, m, 's'], [r + .3, b + .4]]]);
  def('L', 5.8, ({ l, b, W }) => [[[l, 0], [l, b], [W, b]]]);
  def('M', 8.6, ({ l, r, t, m, c }) => [[[l, H], [l, t], [c, m + .8, 's'], [r, t], [r, H]]]);
  def('N', 7, ({ l, r }) => [[[l, 0], [l, H]], [[r, 0], [r, H]], [[l + h + G * .55, .15], [r - h - G * .55, H - .15]]]);
  def('O', 6.8, O_);
  def('P', 6.6, ({ l, r, t, m, x0 }) => [[[l, 0], [l, H]], [[x0, t], [r, t], [r, m + .4], [x0, m + .4]]]);
  def('Q', 6.8, a => O_(a).concat([[[a.r - 1.4, a.b - 1.4], [a.W + .3, H + .5]]]));
  def('R', 6.8, ({ l, r, t, m, c, x0 }) => [[[l, 0], [l, H]], [[x0, t], [r, t], [r, m + .4], [x0, m + .4]], [[c + .2, m + .4], [r + .2, H]]]);
  def('S', 6.6, ({ l, r, t, b, m, W }) => [[[W, t], [l, t], [l, m], [r, m], [r, b], [0, b]]]);
  def('T', 6.6, ({ t, c, W }) => [[[0, t], [W, t]], [[c, t + h + G], [c, H]]]);
  def('U', 6.8, ({ l, r, b }) => [[[l, 0], [l, b], [r, b], [r, 0]]]);
  def('V', 6.8, ({ l, r, m, c }) => [[[l, 0], [l, m - .6], [c, H - .4, 's'], [r, m - .6], [r, 0]]]);
  def('W', 11, ({ l, r, m, c }) => {       // zwei V-Haelften, Mittelspitze mit Steg-Luecke
    const q1 = (l + c) / 2, q3 = (c + r) / 2;
    return [[[l, 0], [l, m - 1.2], [q1, H - .4, 's'], [c - 1.4, m - .8]], [[c + 1.4, m - .8], [q3, H - .4, 's'], [r, m - 1.2], [r, 0]]];
  });
  def('X', 6.8, ({ l, r, t, b }) => [[[l, t - .5], [r, b + .5]], [[r, t - .5], [l, b + .5]]]);
  def('Y', 6.8, ({ l, r, m, c }) => [[[l, 0], [l, m - .4], [r, m - .4], [r, 0]], [[c, m - .4], [c, H]]]);
  def('Z', 6.6, ({ l, r, t, b, W }) => [[[0, t], [r, t, 's'], [l, b, 's'], [W, b]]]);
  def('0', 6.8, O_);
  def('1', 4.6, ({ t, c }) => [[[.3, t + 2], [c + .6, t, 's'], [c + .6, H]]]);
  def('2', 6.6, ({ l, r, t, b, m, W }) => [[[0, t], [r, t], [r, m], [l, m], [l, b], [W, b]]]);
  def('3', 6.6, ({ l, r, t, b, m }) => [[[0, t], [r, t], [r, b], [0, b]], [[l + .5, m], [r - h - G, m]]]);
  def('4', 6.8, ({ l, r, m }) => [[[l, 0], [l, m + 1], [r - h - G, m + 1]], [[r, 0], [r, H]]]);
  def('5', 6.6, ({ l, r, t, b, m, W }) => [[[W, t], [l, t], [l, m], [r, m], [r, b], [0, b]]]);
  def('6', 6.8, ({ l, r, t, b, m, x0, W }) => [[[W, t], [l, t], [l, b], [r, b], [r, m], [x0, m]]]);
  def('7', 6.4, ({ r, t }) => [[[0, t], [r, t], [r, H]]]);
  def('8', 6.8, a => O_(a).concat([[[a.l, a.m], [a.r, a.m]]]));
  def('9', 6.8, ({ l, r, t, b, m }) => [[[r - h - G, m], [l, m], [l, t], [r, t], [r, b], [0, b]]]);
  def('-', 4.4, ({ m, W }) => [[[0, m], [W, m]]]);
  def('.', S, ({ c }) => [[[c, H - S], [c, H]]]);
  def(':', S, ({ c, m }) => [[[c, m - 3], [c, m - 3 + S]], [[c, H - S], [c, H]]]);
  def('/', 5.4, ({ l, r }) => [[[l, H], [r, 0]]]);
  def('+', 6.4, ({ l, r, m, c }) => [[[c, m - 2.6], [c, m + 2.6]], [[l - .4, m], [r + .4, m]]]);
  def(' ', 3, () => []);
  [['Ä', 'A'], ['Ö', 'O'], ['Ü', 'U']].forEach(([u, g]) => {
    const basis = GL[g], c = basis.W / 2;
    GL[u] = { W: basis.W, rad: basis.rad, linien: basis.linien.concat([[[c - 1.7, -2.8], [c - 1.7, -.9]], [[c + 1.7, -2.8], [c + 1.7, -.9]]]) };
  });

  const f2 = n => Math.round(n * 100) / 100;
  function linie(pts, rad) {
    let d = `M${f2(pts[0][0])} ${f2(pts[0][1])}`;
    const last = pts.length - 1;
    for (let i = 1; i <= last; i++) {
      const p = pts[i];
      if (i < last && !p[2]) {
        const a = pts[i - 1], n = pts[i + 1];
        const d1 = Math.hypot(p[0] - a[0], p[1] - a[1]), d2 = Math.hypot(n[0] - p[0], n[1] - p[1]);
        const rr = Math.min(rad, i === 1 ? d1 * .8 : d1 / 2, i + 1 === last ? d2 * .8 : d2 / 2);
        const p1 = [p[0] - (p[0] - a[0]) / d1 * rr, p[1] - (p[1] - a[1]) / d1 * rr];
        const p2 = [p[0] + (n[0] - p[0]) / d2 * rr, p[1] + (n[1] - p[1]) / d2 * rr];
        d += `L${f2(p1[0])} ${f2(p1[1])}Q${f2(p[0])} ${f2(p[1])} ${f2(p2[0])} ${f2(p2[1])}`;
      } else d += `L${f2(p[0])} ${f2(p[1])}`;
    }
    return d;
  }
  function schablone(text, klasse) {
    let x = 0, d = '';
    const zeichen = String(text).toUpperCase().replace(/ß/g, 'SS');
    for (const ch of zeichen) {
      const g = GL[ch] || GL[' '];
      g.linien.forEach(pts => { d += linie(pts.map(p => [p[0] + x, p[1], p[2]]), g.rad); });
      x += g.W + SP;
    }
    const w = Math.max(1, f2(x - SP));
    return `<svg class="at-sch ${klasse || ''}" viewBox="0 0 ${w} ${H}" preserveAspectRatio="xMinYMid meet" style="--at-r:${f2(w / H)}" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  }

  /* ---------- Klang (nur WebAudio-Synthese) ---------- */
  const rauschCache = new WeakMap();
  function rauschen(a) {
    let b = rauschCache.get(a);
    if (!b) {
      const n = Math.floor(a.sampleRate * 2);
      b = a.createBuffer(1, n, a.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      rauschCache.set(a, b);
    }
    return b;
  }
  function huelle(a, o, t, spitze, an, halt, ab) {
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(spitze, t + an);
    if (halt) g.gain.setValueAtTime(spitze, t + an + halt);
    g.gain.exponentialRampToValueAtTime(0.0001, t + an + (halt || 0) + ab);
    g.connect(o);
    return g;
  }
  function rauschStoss(a, o, t, dauer, typ, freq, q, laut) {
    const s = a.createBufferSource(), f = a.createBiquadFilter();
    s.buffer = rauschen(a); f.type = typ; f.frequency.value = freq; f.Q.value = q;
    s.connect(f).connect(huelle(a, o, t, laut, .002, 0, dauer));
    s.start(t, Math.random() * 1.5, dauer + .05);
  }
  function ton(a, o, t, typ, f0, f1, dauer, laut, an) {
    const osc = a.createOscillator();
    osc.type = typ; osc.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dauer);
    osc.connect(huelle(a, o, t, laut, an || .004, 0, dauer));
    osc.start(t); osc.stop(t + dauer + .05);
    return osc;
  }
  const SND = {
    schluessel(a, o, arm) {           // Schliesszylinder: zwei Metallklicks + kurzer Federklang
      const t = a.currentTime;
      rauschStoss(a, o, t, .028, 'bandpass', arm ? 3600 : 2900, 2.2, .55);
      rauschStoss(a, o, t + .045, .04, 'bandpass', arm ? 1900 : 1500, 1.6, .42);
      ton(a, o, t + .045, 'sine', arm ? 2850 : 2300, 0, .11, .035);
    },
    haube(a, o, auf) {                // Kunststoffklappe
      const t = a.currentTime;
      rauschStoss(a, o, t, .05, 'lowpass', auf ? 2200 : 1500, .8, .5);
      ton(a, o, t, 'sine', auf ? 240 : 170, auf ? 180 : 110, .08, .22);
    },
    klaxon(a, o) {                    // kurzer Alarm, 0.7 s
      const t = a.currentTime, ws = a.createWaveShaper(), bp = a.createBiquadFilter();
      const kurve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; kurve[i] = Math.tanh(x * 3); }
      ws.curve = kurve; bp.type = 'bandpass'; bp.frequency.value = 1150; bp.Q.value = .7;
      const g = huelle(a, o, t, .085, .03, .46, .2);
      ws.connect(bp).connect(g);
      [-8, 9].forEach(det => {
        const osc = a.createOscillator();
        osc.type = 'sawtooth'; osc.detune.value = det;
        osc.frequency.setValueAtTime(250, t); osc.frequency.exponentialRampToValueAtTime(480, t + .17);
        osc.frequency.setValueAtTime(480, t + .48); osc.frequency.exponentialRampToValueAtTime(360, t + .7);
        osc.connect(ws); osc.start(t); osc.stop(t + .74);
      });
    },
    zirp(a, o) {                      // Entsichern fuer Stop: zwei kurze Pieptoene
      const t = a.currentTime;
      ton(a, o, t, 'square', 1480, 0, .05, .03); ton(a, o, t + .09, 'square', 1480, 0, .05, .03);
    },
    piep(a, o, letzter) {             // Countdown
      const t = a.currentTime, lp = a.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(o);
      ton(a, lp, t, 'square', letzter ? 1320 : 990, 0, letzter ? .26 : .14, .065);
      ton(a, lp, t, 'sine', letzter ? 2640 : 1980, 0, .08, .02);
    },
    grollen(a, o) {                   // Zuendung: tiefes Grollen + Fauchen
      const t = a.currentTime, dauer = 2.6;
      const s = a.createBufferSource(), lp = a.createBiquadFilter();
      s.buffer = rauschen(a); s.loop = true;
      lp.type = 'lowpass'; lp.Q.value = .9;
      lp.frequency.setValueAtTime(80, t); lp.frequency.linearRampToValueAtTime(260, t + .35); lp.frequency.exponentialRampToValueAtTime(60, t + dauer);
      s.connect(lp).connect(huelle(a, o, t, .7, .14, .4, dauer - .5));
      s.start(t); s.stop(t + dauer + .1);
      ton(a, o, t, 'sine', 64, 27, 2.3, .42, .05);
      ton(a, o, t, 'triangle', 41, 30, 1.6, .18, .08);
      const s2 = a.createBufferSource(), bp = a.createBiquadFilter();
      s2.buffer = rauschen(a); bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(380, t); bp.frequency.exponentialRampToValueAtTime(1700, t + .9); bp.frequency.exponentialRampToValueAtTime(500, t + 1.9);
      s2.connect(bp).connect(huelle(a, o, t, .07, .25, .3, 1.2));
      s2.start(t, .3, 2);
    },
    laden(a, o) {                     // waehrend SHUTDOWN gehalten wird
      const t = a.currentTime, osc = a.createOscillator(), g = a.createGain();
      osc.type = 'triangle'; osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(460, t + HALTEN_MS / 1000);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.06, t + .08);
      osc.connect(g).connect(o); osc.start(t);
      return () => { try { const n = a.currentTime; g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0.0001, n, .03); osc.stop(n + .15); } catch (e) {} };
    },
    abschalten(a, o) {                // Herunterfahren ausgeloest
      const t = a.currentTime, lp = a.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(1600, t); lp.frequency.exponentialRampToValueAtTime(160, t + 1); lp.connect(o);
      ton(a, lp, t, 'sawtooth', 440, 45, 1, .07);
      ton(a, o, t, 'sine', 120, 50, .25, .3);
      rauschStoss(a, o, t, .08, 'lowpass', 900, .7, .45);
    },
    gesperrt(a, o) {                  // verweigert: dumpfes Klacken
      const t = a.currentTime;
      rauschStoss(a, o, t, .035, 'lowpass', 700, 1, .5);
      rauschStoss(a, o, t + .075, .035, 'lowpass', 600, 1, .4);
    },
    feder(a, o) {                     // Schluessel springt nach dem Ausloesen zurueck
      const t = a.currentTime;
      rauschStoss(a, o, t, .03, 'bandpass', 2600, 2, .4);
      ton(a, o, t, 'sine', 1900, 1500, .12, .03);
    },
  };

  /* ---------- Markup ---------- */
  const schraube = (k, rot) => `<i class="at-schraube ${k}" style="--at-rot:${rot}deg" aria-hidden="true"></i>`;
  /* Schluessel von oben: Kern (Messing) mit Schluesselkanal + roter Zeigerkerbe, darin Hals und breite Reide mit Loch */
  function schluesselSvg(uid, mini) {
    const g = `${uid}-${mini ? 'k2' : 'k1'}`;
    return `<svg class="at-kern" viewBox="-22 -22 44 44" aria-hidden="true" focusable="false">
  <path d="M-2.3 -15.5h4.6v31h-4.6z" fill="#221b09"/><path d="M-2.3 -15.5h4.6v1.2h-4.6z" fill="#000" opacity=".5"/>
  <path d="M0 -21.2l2.9 4.6h-5.8z" fill="#e3231b" stroke="#5a0806" stroke-width=".6"/>
</svg><svg class="at-reide" viewBox="-22 -22 44 56" aria-hidden="true" focusable="false">
  <defs><linearGradient id="${g}" x1="0" x2="1"><stop offset="0" stop-color="#6c6c66"/><stop offset=".28" stop-color="#e9e9e2"/><stop offset=".45" stop-color="#ffffff"/><stop offset=".62" stop-color="#b3b3ab"/><stop offset="1" stop-color="#4b4b46"/></linearGradient></defs>
  <path d="M-2.4 -11h4.8v14h-4.8z" fill="url(#${g})" stroke="#2c2c29" stroke-width=".7"/>
  <path d="M-1 -11v13" stroke="#fff" stroke-width=".6" opacity=".55"/>
  <path d="M-4.6 2.2h9.2l.6 2.6c5.2 .9 7 4.6 7 10.3c0 7.6-4.7 12.6-12.2 12.6s-12.2-5-12.2-12.6c0-5.7 1.8-9.4 7-10.3z" fill="url(#${g})" stroke="#2c2c29" stroke-width=".8"/>
  <path d="M-8.6 9.5c1.6-2.4 4.8-3.4 8.6-3.4s7 1 8.6 3.4" fill="none" stroke="#fff" stroke-width=".8" opacity=".6"/>
  <path d="M-9 20.5c1.8 3.4 5 5 9 5s7.2-1.6 9-5" fill="none" stroke="#000" stroke-width=".8" opacity=".25"/>
  <circle cx="0" cy="20.5" r="3.3" fill="#1b1b19" stroke="#000" stroke-width=".5"/>
  <path d="M-2.4 19.6a2.6 2.6 0 0 1 4.8 0" fill="none" stroke="#000" stroke-width="1" opacity=".6"/>
</svg>`;
  }
  const SCHLOSS_SVG = `<svg viewBox="0 0 40 52" aria-hidden="true" focusable="false"><path d="M11 22V14a9 9 0 0 1 18 0v8" fill="none" stroke="#c9c9c2" stroke-width="5"/><path d="M11 22V14a9 9 0 0 1 18 0v8" fill="none" stroke="#7a7a73" stroke-width="2"/><rect x="3" y="21" width="34" height="28" rx="4" fill="#c8102e"/><rect x="3" y="21" width="34" height="9" rx="4" fill="#e4243f"/><circle cx="20" cy="34" r="3.5" fill="#2a0008"/><rect x="18.6" y="35" width="2.8" height="8" rx="1" fill="#2a0008"/></svg>`;

  function markup(uid) {
    return `
<div class="at-gehaeuse">
  ${schraube('at-s-lo', 18)}${schraube('at-s-ro', 64)}${schraube('at-s-lu', 132)}${schraube('at-s-ru', 101)}
  <div class="at-kopf">
    <div class="at-schild">
      <h2 class="at-name"><span class="at-vh at-name-text"></span><span class="at-name-sch"></span></h2>
      <div class="at-dymo"><span class="at-info"></span></div>
    </div>
    <div class="at-rundum" aria-hidden="true"><i class="at-rd-kuppel"><i class="at-rd-spiegel"></i></i><i class="at-rd-fuss"></i></div>
  </div>
  <div class="at-leiste">
    <div class="at-vfd" aria-hidden="true">
      <span class="at-vfd-zeile"><b class="at-vfd-haupt">NO DATA</b></span>
      <span class="at-vfd-sub">CHECKING</span>
      <i class="at-balken"><i></i></i>
    </div>
    <div class="at-lampen" aria-hidden="true">
      <span class="at-lampe at-l-power"><i></i><small>POWER</small></span>
      <span class="at-lampe at-l-armed"><i></i><small>ARMED</small></span>
      <span class="at-lampe at-l-launch"><i></i><small>LAUNCH</small></span>
    </div>
  </div>
  <div class="at-platte at-schalter">
      <span class="at-gravur">MASTER ARM</span>
      <span class="at-pos at-pos-safe">SAFE</span><span class="at-pos at-pos-arm">ARM</span>
      <button class="at-schloss" type="button" role="switch" aria-checked="false" aria-label="Schlüsselschalter steht auf SAFE. Auf ARM drehen">
        <i class="at-zylinder"><i class="at-schluessel">${schluesselSvg(uid, false)}<i class="at-anhaenger"><b>01</b></i></i></i>
      </button>
    </div>
  <div class="at-feld">
    <div class="at-innen">
      ${schraube('at-f-lo', 40)}${schraube('at-f-ro', 120)}${schraube('at-f-lu', 75)}${schraube('at-f-ru', 10)}
      <div class="at-buehne">
        <i class="at-hschatten" aria-hidden="true"></i>
        <button class="at-haube" type="button" aria-label="Schutzhaube anheben">
          <span class="at-hf at-h-oben"></span><span class="at-hf at-h-links"></span><span class="at-hf at-h-rechts"></span><span class="at-hf at-h-unten"></span>
          <span class="at-hf at-h-deckel"><span class="at-h-lasche">${schablone('LIFT', 'at-sch-lasche')}</span></span>
        </button>
        <div class="at-kragen">
          <svg class="at-ring" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
            <defs>
              <path id="${uid}-o" d="M 15 100 A 85 85 0 0 1 185 100"/>
              <path id="${uid}-u" d="M 8 100 A 92 92 0 0 0 192 100"/>
            </defs>
            <text><textPath href="#${uid}-o" startOffset="50%" text-anchor="middle">LAUNCH CONTROL</textPath></text>
            <text><textPath href="#${uid}-u" startOffset="50%" text-anchor="middle">AUTHORIZED PERSONNEL ONLY</textPath></text>
          </svg>
          <i class="at-luenette" aria-hidden="true"></i>
          <button class="at-knopf" type="button" tabindex="-1" aria-disabled="true" aria-label="LAUNCH: Start auslösen"><i class="at-knopf-licht"></i><i class="at-knopf-glanz"></i></button>
        </div>
        <i class="at-scharnier" aria-hidden="true"></i>
        <i class="at-riegel" aria-hidden="true"></i>
        <div class="at-zahl" aria-hidden="true"></div>
      </div>
    </div>
  </div>
  <div class="at-mitte" aria-hidden="true">
    <div class="at-danger"><b><span>DANGER</span></b><span class="at-danger-text">Start nur mit Schlüssel</span></div>
    <div class="at-key2"><i class="at-k2-rosette"><i class="at-schluessel">${schluesselSvg(uid, true)}</i></i><span class="at-k2-text">KEY 2<small>CMDR</small></span></div>
  </div>
  <div class="at-platte at-stopfeld">
      <span class="at-gravur">SHUTDOWN</span>
      <i class="at-buegel at-buegel-l" aria-hidden="true"></i><i class="at-buegel at-buegel-r" aria-hidden="true"></i>
      <button class="at-stop" type="button" aria-label="SHUTDOWN"><span class="at-stop-text">SHUT<br>DOWN</span><i class="at-stop-p"></i></button>
      <span class="at-segmente" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      <span class="at-lockout" aria-hidden="true">${SCHLOSS_SVG}<b>GESPERRT</b></span>
  </div>
  <p class="at-hinweis"></p>
  <div class="at-strahl" aria-hidden="true"><i></i></div>
</div>`;
  }

  PCW.registriere({
    id: 'atom',
    name: 'Abschuss',
    karte(el, geraet, api) {
      const uid = 'atom' + (++zaehler);
      el.classList.add('at-karte');
      el.innerHTML = markup(uid);
      const $ = s => el.querySelector(s);
      const geh = $('.at-gehaeuse'), knopf = $('.at-knopf'), haube = $('.at-haube'), schloss = $('.at-schloss'),
        stopB = $('.at-stop'), stopText = $('.at-stop-text'), hinweisEl = $('.at-hinweis'), vfdH = $('.at-vfd-haupt'),
        vfdS = $('.at-vfd-sub'), zahlEl = $('.at-zahl'), segmente = [...el.querySelectorAll('.at-segmente i')];

      let z = 'unbekannt', daten = { ...geraet };
      let scharf = false, offen = false, sperreBis = 0, eingefroren = false, gezuendet = false;
      let zuTimer = null, nachTimer = null, fehlerTimer = null, tickTimer = null, effektTimer = null;
      let countdown = null, halten = null, haltTonStop = null, haltZeiger = null, haltRest = '', phaseSeit = Date.now();
      let meldungAktiv = false, stoerung = false, meldungFestBis = 0, knopfFrisch = false, tasteUnten = false;
      let actx = null, ausgang = null;

      function txt(n, v) { if (n.textContent !== v) n.textContent = v; }
      function attr(n, k, v) { if (n.getAttribute(k) !== v) n.setAttribute(k, v); }

      function nameSetzen() {
        txt($('.at-name-text'), daten.name || '');
        $('.at-name-sch').innerHTML = schablone(daten.name || '?', 'at-sch-name');
        txt($('.at-info'), daten.info || '');
        $('.at-dymo').hidden = !daten.info;
      }
      nameSetzen();

      /* --- Klang & Haptik --- */
      function klang(name, ...arg) {
        try {
          if (eingefroren) return null;
          if (!actx) actx = api.audio();           // erster Aufruf immer in einer Nutzergeste
          if (!actx) return null;
          if (!ausgang || ausgang.context !== actx) { ausgang = actx.createGain(); ausgang.gain.value = .9; ausgang.connect(actx.destination); }
          return SND[name](actx, ausgang, ...arg);
        } catch (e) { console.warn('Abschuss: Klang', name, e); return null; }
      }
      const vib = m => { if (!eingefroren) api.vib(m); };

      /* --- Hilfen --- */
      const startbar = () => z === 'aus' || z === 'unbekannt';
      const gesperrt = () => Date.now() < sperreBis;
      const sperren = () => { sperreBis = Date.now() + ANIM_MS; };
      function effekt(k, ms) {
        if (eingefroren) return;
        geh.classList.remove(k); void geh.offsetWidth; geh.classList.add(k);
        clearTimeout(effektTimer); effektTimer = setTimeout(() => geh.classList.remove('at-blitz', 'at-ruetteln'), ms);
      }
      function wackeln(n) { if (eingefroren) return; n.classList.remove('at-wackeln'); void n.offsetWidth; n.classList.add('at-wackeln'); setTimeout(() => n.classList.remove('at-wackeln'), 380); }
      function zuTimerNeu() {
        clearTimeout(zuTimer);
        if (eingefroren || (!scharf && !offen)) return;
        zuTimer = setTimeout(() => {
          if (halten || countdown) { zuTimerNeu(); return; }
          if (scharf || offen) { sichern(false); klang('schluessel', false); kurzmeldung('Automatisch gesichert (15 s ohne Aktion)'); }
        }, ZU_MS);
      }
      function kurzmeldung(text, fehler) {
        meldungAktiv = true; stoerung = !!fehler;
        txt(hinweisEl, text); hinweisEl.classList.toggle('at-fehler', !!fehler); hinweisEl.classList.toggle('at-info-m', !fehler);
        clearTimeout(fehlerTimer);
        fehlerTimer = setTimeout(() => { meldungAktiv = false; stoerung = false; hinweisEl.classList.remove('at-fehler', 'at-info-m'); zeichnen(); }, fehler ? 5000 : 3200);
        zeichnen();
      }
      function meldungWeg() {                  // erfolgreicher Schritt: alte Hinweise sofort weg
        if (!meldungAktiv || Date.now() < meldungFestBis) return;   // "Countdown abgebrochen" bleibt mind. 2 s stehen
        clearTimeout(fehlerTimer); meldungAktiv = false; stoerung = false;
        hinweisEl.classList.remove('at-fehler', 'at-info-m');
      }
      function verweigern(text, n) { klang('gesperrt'); vib([10, 30, 10]); if (n) wackeln(n); kurzmeldung(text, false); }

      /* --- Ablauf --- */
      function entsichern() {
        scharf = true; sperren(); meldungWeg();
        klang('schluessel', true);
        if (startbar()) klang('klaxon'); else klang('zirp');
        vib([15, 40, 25]); zuTimerNeu(); zeichnen();
      }
      function sichern(manuell) {
        const warZaehlen = !!countdown;
        countdownStopp(); haltenAbbrechen(false);
        scharf = false; offen = false; clearTimeout(zuTimer);
        sperren();                               // auch Sichern sperrt 450 ms: Doppeltipp entsichert nicht gleich wieder
        if (manuell) {
          meldungWeg(); klang('schluessel', false); vib(12);
          if (warZaehlen) { kurzmeldung('Countdown abgebrochen', false); meldungFestBis = Date.now() + ABBRUCH_FEST_MS; }
        }
        zeichnen();
      }
      function zahlZeigen(n) {
        zahlEl.innerHTML = n ? schablone(String(n), 'at-sch-zahl') : '';
        zahlEl.classList.remove('at-tick'); void zahlEl.offsetWidth; zahlEl.classList.add('at-tick');
      }
      function countdownStart() {
        clearTimeout(zuTimer); meldungWeg();
        countdown = { n: ZAEHLEN, zeige: ZAEHLEN, t: null };
        const schritt = () => {
          if (!countdown) return;
          if (countdown.n === 0) { countdown = null; zahlZeigen(0); zuenden(); return; }
          countdown.zeige = countdown.n;
          zahlZeigen(countdown.n); klang('piep', countdown.n === 1); vib(30); zeichnen();
          countdown.n--; countdown.t = setTimeout(schritt, 1000);
        };
        schritt();
      }
      function countdownStopp() {
        if (!countdown) return;
        clearTimeout(countdown.t); countdown = null; zahlZeigen(0);
      }
      function abbrechen() { sichern(true); }
      function zuenden() {
        gezuendet = true;
        klang('grollen'); vib([80, 50, 160]);
        if (!api.reduziert()) { effekt('at-blitz', 700); effekt('at-ruetteln', 650); }
        clearTimeout(nachTimer);
        nachTimer = setTimeout(() => {        // Federschluessel springt zurueck, Haube faellt zu
          gezuendet = false; nachTimer = null;
          if (scharf || offen) { scharf = false; offen = false; klang('feder'); zeichnen(); }
        }, NACH_ZUENDUNG_MS);
        zeichnen();
        Promise.resolve(api.starten()).then(r => {
          if (r && r.ok === false && z !== 'startet') { scharf = false; offen = false; zeichnen(); }
        }).catch(() => {});
      }
      function haltStart(e) {
        if (eingefroren || halten || gesperrt()) return;
        if (countdown) { abbrechen(); return; }
        if (z === 'startet' || z === 'stoppt') { verweigern('Läuft bereits – bitte warten', stopB); return; }
        if (z !== 'an') { verweigern(z === 'aus' ? 'Gerät ist bereits aus' : 'Status unbekannt – Ausschalten nicht möglich', stopB); return; }
        if (!daten.kann_aus) { verweigern('Ausschalten ist nicht eingerichtet', stopB); return; }
        if (!scharf) { verweigern('Erst Schlüssel auf ARM drehen', stopB); return; }
        haltZeiger = e && e.pointerId !== undefined ? e.pointerId : null;
        if (haltZeiger !== null && stopB.setPointerCapture) { try { stopB.setPointerCapture(haltZeiger); } catch (x) {} }
        clearTimeout(zuTimer); meldungWeg();
        stopB.classList.add('at-gedrueckt');
        haltTonStop = klang('laden'); vib(10);
        const t0 = performance.now();
        const schritt = now => {
          const p = Math.min(1, (now - t0) / HALTEN_MS);
          fortschritt(p);
          if (p >= 1) {
            halten = null; haltZeiger = null; fortschritt(0); stopB.classList.remove('at-gedrueckt');
            if (haltTonStop) { haltTonStop(); haltTonStop = null; }
            klang('abschalten'); vib([60, 40, 60]);
            scharf = false;
            zeichnen();
            api.stoppen();
            return;
          }
          halten = requestAnimationFrame(schritt);
        };
        halten = requestAnimationFrame(schritt);
        zeichnen();
      }
      function fortschritt(p) {                // Fuellung + 5 Segmente + Restzeit in der VFD
        stopB.style.setProperty('--at-p', p.toFixed(3));
        const an = Math.floor(p * SEGMENTE + 1e-6);
        segmente.forEach((s, i) => s.classList.toggle('at-an', i < an));
        haltRest = p > 0 && p < 1 ? `HOLD ${(HALTEN_MS * (1 - p) / 1000).toFixed(1)} S` : '';
        if (haltRest) txt(vfdS, haltRest);
      }
      function haltenAbbrechen(neuerTimer) {
        stopB.classList.remove('at-gedrueckt');
        if (haltTonStop) { haltTonStop(); haltTonStop = null; }
        if (halten) {
          cancelAnimationFrame(halten); halten = null; haltZeiger = null; fortschritt(0);
          if (neuerTimer !== false) zuTimerNeu();
          if (!eingefroren) zeichnen();
        }
      }

      /* --- Eingaben --- */
      // Tastenwiederholung (Enter/Leertaste gehalten) loest nie etwas aus: sonst klickt der Repeat nach dem
      // automatischen Fokussprung Haube -> Knopf den Knopf, oder der Schluessel klappert ARM/SAFE.
      // Die <section> bleibt beim Designwechsel bestehen: diese Listener haengen an el und werden in entfernen() geloest.
      const elListener = new AbortController(), elOpt = { capture: true, signal: elListener.signal };
      el.addEventListener('keydown', e => {
        if (eingefroren || (e.key !== 'Enter' && e.key !== ' ')) return;
        if (e.repeat) { e.preventDefault(); e.stopPropagation(); return; }
        tasteUnten = true;
      }, elOpt);
      el.addEventListener('keyup', e => { if (e.key === 'Enter' || e.key === ' ') { tasteUnten = false; knopfFrisch = false; } }, elOpt);
      el.addEventListener('focusout', () => { tasteUnten = false; }, elOpt);
      schloss.addEventListener('click', e => {
        if (eingefroren || gesperrt() || e.detail > 1) return;
        if (scharf || countdown) { sichern(true); return; }
        if (z === 'startet' || z === 'stoppt') { verweigern('Läuft bereits – bitte warten', schloss); return; }
        if (z === 'an' && !daten.kann_aus) { verweigern('Ausschalten ist nicht eingerichtet', schloss); return; }
        entsichern();
      });
      haube.addEventListener('click', () => {
        if (eingefroren || gesperrt() || countdown || gezuendet) return;
        if (offen) { offen = false; sperren(); klang('haube', false); vib(12); zuTimerNeu(); zeichnen(); return; }
        if (z === 'startet' || z === 'stoppt') { verweigern('Läuft bereits – bitte warten', haube); return; }
        if (z === 'an') { verweigern(daten.kann_aus ? 'Läuft schon · Ausschalten über SHUTDOWN' : 'Läuft schon · Ausschalten ist nicht eingerichtet', haube); return; }
        if (!scharf) { verweigern('Haube verriegelt – erst Schlüssel auf ARM drehen', haube); return; }
        offen = true; sperren(); meldungWeg(); klang('haube', true); vib(20); zuTimerNeu(); zeichnen();
        // Fokus springt auf den Knopf; ist die Taste (Enter) noch unten, zaehlt der Knopf erst nach dem Loslassen
        if (document.activeElement === haube) { knopfFrisch = tasteUnten; knopf.focus({ preventScroll: true }); }
      });
      knopf.addEventListener('click', e => {
        if (eingefroren || gesperrt() || countdown || gezuendet) return;
        if (e.detail === 0 && knopfFrisch) return;   // Tastatur: erst ein neuer Tastendruck nach dem Fokussprung
        if (!offen || !scharf || !startbar()) return;
        countdownStart();
      });
      stopB.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button !== 0) return; haltStart(e); });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => stopB.addEventListener(t, () => haltenAbbrechen()));
      stopB.addEventListener('pointermove', e => {   // Wegziehen bricht ab (trotz Pointer-Capture)
        if (!halten || (haltZeiger !== null && e.pointerId !== haltZeiger)) return;
        const r = stopB.getBoundingClientRect(), T = WEG_TOLERANZ;
        if (e.clientX < r.left - T || e.clientX > r.right + T || e.clientY < r.top - T || e.clientY > r.bottom + T) {
          haltenAbbrechen(); klang('gesperrt'); vib(12); kurzmeldung('SHUTDOWN abgebrochen – Finger weggezogen', false);
        }
      });
      stopB.addEventListener('keydown', e => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        if (!e.repeat) haltStart(null);
      });
      stopB.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); haltenAbbrechen(); } });
      stopB.addEventListener('click', () => { if (countdown && !eingefroren) abbrechen(); });
      stopB.addEventListener('blur', () => haltenAbbrechen());
      [stopB, knopf, haube, schloss].forEach(b => b.addEventListener('contextmenu', e => e.preventDefault()));

      /* --- Darstellung --- */
      function mmss(ms) {
        const s = Math.max(0, Math.floor(ms / 1000));
        return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      }
      function tick() {
        const lauf = z === 'startet' || z === 'stoppt';
        const dt = Date.now() - phaseSeit;
        if (lauf) {
          geh.style.setProperty('--at-fort', (1 - Math.exp(-dt / (z === 'startet' ? 35000 : 15000))).toFixed(3));
          if (!countdown && !stoerung) txt(vfdS, `T+${mmss(dt)}`);
        }
      }
      function tickerSetzen() {
        const lauf = z === 'startet' || z === 'stoppt';
        if (lauf && !tickTimer && !eingefroren) tickTimer = setInterval(tick, 500);
        if (!lauf && tickTimer) { clearInterval(tickTimer); tickTimer = null; }
      }
      function vfdText() {
        if (stoerung) return ['FAULT', 'SEE NOTE'];
        if (countdown) return [`T-${countdown.zeige}`, 'ABORT: KEY SAFE'];
        if (z === 'startet') return ['LAUNCH', `T+${mmss(Date.now() - phaseSeit)}`];
        if (z === 'stoppt') return ['SHUTDOWN', `T+${mmss(Date.now() - phaseSeit)}`];
        if (z === 'an') {
          if (scharf) return ['ARMED', 'HOLD SHUTDOWN'];
          return ['ONLINE', daten.kann_aus ? 'SYSTEM UP' : 'STOP LOCKED'];
        }
        if (scharf) return offen ? ['READY', 'PUSH TO LAUNCH'] : ['ARMED', 'LIFT COVER'];
        return z === 'unbekannt' ? ['NO DATA', 'CHECKING'] : ['STANDBY', 'KEY SAFE'];
      }
      function hinweisText() {
        if (countdown) return `Start in ${countdown.zeige} … Schlüssel auf SAFE oder ABORT bricht ab`;
        if (z === 'startet') return `Startsignal gesendet – ${daten.name || 'Gerät'} fährt hoch …`;
        if (z === 'stoppt') return 'Herunterfahren ausgelöst …';
        if (z === 'an') {
          if (!daten.kann_aus) return 'Läuft · Ausschalten ist nicht eingerichtet';
          if (halten) return 'Halten … loslassen oder wegziehen bricht ab';
          return scharf ? 'SHUTDOWN 1.5 s gedrückt halten' : 'Läuft · Zum Ausschalten Schlüssel auf ARM';
        }
        if (!scharf) return z === 'unbekannt' ? 'Status wird geprüft … Start: Schlüssel auf ARM' : 'Schlüssel auf ARM drehen';
        return offen ? 'LAUNCH drücken' : 'Schutzhaube anheben';
      }
      function zeichnen() {
        el.dataset.zustand = z;
        el.classList.toggle('at-scharf', scharf);
        el.classList.toggle('at-offen', offen);
        el.classList.toggle('at-zaehlt', !!countdown);
        el.classList.toggle('at-ohne-stop', !daten.kann_aus);
        el.classList.toggle('at-haube-frei', scharf && startbar() && !countdown);
        el.classList.toggle('at-stoerung', stoerung);
        el.classList.toggle('at-stopbereit', z === 'an' && scharf && !!daten.kann_aus && !countdown);
        const [vh, vs] = vfdText();
        txt(vfdH, vh); txt(vfdS, haltRest || vs);
        if (!meldungAktiv) { txt(hinweisEl, hinweisText()); hinweisEl.classList.remove('at-fehler', 'at-info-m'); }

        attr(schloss, 'aria-checked', String(scharf));
        attr(schloss, 'aria-label', scharf ? 'Schlüsselschalter steht auf ARM. Zurück auf SAFE drehen' : 'Schlüsselschalter steht auf SAFE. Auf ARM drehen');
        attr(haube, 'aria-label', offen ? 'Schutzhaube schliessen' : (scharf ? 'Schutzhaube anheben' : 'Schutzhaube anheben (verriegelt, erst Schlüssel auf ARM)'));
        attr(haube, 'aria-expanded', String(offen));
        const knopfAktiv = offen && scharf && startbar() && !countdown && !gezuendet;
        attr(knopf, 'aria-disabled', String(!knopfAktiv));
        knopf.tabIndex = offen ? 0 : -1;
        attr(knopf, 'aria-label', countdown ? `Countdown läuft: ${countdown.zeige}` : 'LAUNCH: Start auslösen');

        let sl;
        const stopBeschr = countdown ? 'ABORT' : 'SHUT<br>DOWN';
        if (stopText.dataset.t !== stopBeschr) { stopText.innerHTML = stopBeschr; stopText.dataset.t = stopBeschr; }
        if (countdown) sl = 'ABORT: Countdown abbrechen';
        else {
          if (!daten.kann_aus) sl = 'SHUTDOWN gesperrt: Ausschalten ist nicht eingerichtet';
          else if (z === 'an' && scharf) sl = 'SHUTDOWN: 1.5 Sekunden gedrückt halten zum Ausschalten';
          else if (z === 'an') sl = 'SHUTDOWN: erst Schlüssel auf ARM drehen';
          else sl = 'SHUTDOWN: nur wenn das Gerät läuft';
        }
        attr(stopB, 'aria-label', sl);
        tickerSetzen(); tick();
      }

      return {
        setze(neu, d) {
          if (eingefroren) return;
          const alt = z;
          const nameAlt = `${daten.name}|${daten.info}`;
          z = neu; daten = { ...daten, ...d };
          if (`${daten.name}|${daten.info}` !== nameAlt) nameSetzen();
          if (alt !== z) {
            if (z === 'startet' || z === 'stoppt') {
              phaseSeit = Date.now();
              if (countdown) countdownStopp();
              haltenAbbrechen(false);
              if (!gezuendet) { scharf = false; offen = false; clearTimeout(zuTimer); }
            } else if (!((alt === 'aus' || alt === 'unbekannt') && startbar())) {
              // jeder andere Wechsel (aus <-> an, Ende von startet/stoppt): Entsicherung verfaellt,
              // damit eine Start-Entsicherung nie zur Stop-Entsicherung wird
              countdownStopp(); haltenAbbrechen(false);
              scharf = false; offen = false; clearTimeout(zuTimer);
            }
          }
          if (!daten.kann_aus && z === 'an' && scharf) { scharf = false; haltenAbbrechen(false); }
          zeichnen();
        },
        meldung(text, fehler) { kurzmeldung(text, !!fehler); },
        vorschau(stufe) {
          eingefroren = true;
          clearTimeout(zuTimer); clearTimeout(nachTimer); countdownStopp(); haltenAbbrechen(false);
          const map = {
            ruhe: ['aus', false, false], bereit: ['aus', true, true], startet: ['startet', false, false],
            an: ['an', false, false], 'an-bereit': ['an', true, false], stoppt: ['stoppt', false, false],
          };
          const [zz, sch, off] = map[stufe] || map.ruhe;
          z = zz; offen = off; meldungAktiv = false; stoerung = false; gezuendet = false;
          scharf = sch && !(zz === 'an' && !daten.kann_aus);
          phaseSeit = Date.now() - (zz === 'startet' ? 23000 : 9000);
          zeichnen();
          if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
        },
        entfernen() {
          eingefroren = true;
          elListener.abort();
          clearTimeout(zuTimer); clearTimeout(nachTimer); clearTimeout(fehlerTimer); clearTimeout(effektTimer);
          if (tickTimer) clearInterval(tickTimer);
          if (countdown) clearTimeout(countdown.t);
          if (halten) cancelAnimationFrame(halten);
          if (haltTonStop) haltTonStop();
          try { if (ausgang) ausgang.disconnect(); } catch (e) {}
          countdown = null; halten = null; ausgang = null;
        },
      };
    },
  });
})();
