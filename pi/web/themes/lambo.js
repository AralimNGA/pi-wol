/* Design "Supersportwagen" – Mittelkonsole eines italienischen V10-Supersportwagens, markenlos nachgebaut.
   Oben der Mittelbildschirm (Gerätename, Status, Drehzahlband), darunter die Leiste aus sieben Kippschaltern mit
   Alu-Schutzfinnen. Auf dem Carbon-Tunnel das Startmodul: rote Ring-Klappe mit sechseckigem Sichtfenster über dem
   ENGINE-START-Knopf, darunter der eloxierte Rückwärtsgang-Hebel mit P- und M-Taste (reine Dekoration).
   Sicherheit (THEMEN.md): Klappe = Entsicherung, Druck = Start, STOP 1.5 s ruhig halten (Wegziehen bricht ab),
   Klappe fällt nach 15 s zu und schliesst bei jedem Bedeutungswechsel des Knopfs, 450-ms-Sperre nach dem Öffnen.
   Sounds nur per WebAudio-Synthese und nur nach Nutzergeste. */
(() => {
  'use strict';
  const HALTEN_MS = 1500, ZU_MS = 15000, ANIM_MS = 450, FRISCH_MS = 2600, AKTION_MAX_MS = 180000;
  const WEG_PX = 14, RAND_PX = 8;   // STOP-Halten bricht ab, wenn sich der Zeiger so weit bewegt bzw. den Knopf verlässt
  const STATUS = { aus: 'AUS', an: 'LÄUFT', startet: 'ZÜNDUNG', stoppt: 'ABSTELLEN', unbekannt: 'PRÜFE' };
  // Startzeit laufender Aktionen je Gerät: überlebt Design-Wechsel, damit die Uhr nicht wieder bei 0:00 beginnt
  const aktionen = new Map();
  let nr = 0;

  /* ---------- Kippschalter (Reihenfolge wie im Vorbild: Fenster, Lift, ESC, Warnblinker, Parksensoren, Start-Stopp, Fenster) ---------- */
  const SYMBOLE = [
    '<path d="M3 15.5V9l5-4.5h9v11z"/><path d="M11 7.4v6.2M9.4 9 11 7.4 12.6 9M9.4 12 11 13.6 12.6 12"/>',
    '<path d="M2.6 14.6v-2.2l2.7-2.6h7.4l3.1 2.6h1.7v2.2z"/><circle cx="6.2" cy="14.8" r="1.4"/><circle cx="13.8" cy="14.8" r="1.4"/><path d="M15.5 7.3V2.4M13.8 4.1l1.7-1.7 1.7 1.7"/>',
    '<path d="M5.2 10.6 6.8 5.4h6.4l1.6 5.2v2.6H5.2z"/><path d="M5.6 13.2v1.4M14.4 13.2v1.4M3.8 17.6c1.2-1.4 2.2 1.4 3.4 0M12.8 17.6c1.2-1.4 2.2 1.4 3.4 0"/>',
    '<path d="M10 2.6 18.2 16.8H1.8z"/><path d="M10 8 13.4 14H6.6z"/>',
    '<path d="M4.5 15.5V4.5h3.6a2.9 2.9 0 0 1 0 5.8H4.5"/><path d="M12.6 6.6a5 5 0 0 1 0 6.8M15.2 4.4a8.2 8.2 0 0 1 0 11.2"/>',
    '<path d="M15.6 5.6A7 7 0 1 0 17 10"/><path d="M17.6 3.4 15.8 6 13 5"/><path d="M7.6 13.6 10 6.6l2.4 7M8.4 11.4h3.2"/>',
    '<path d="M17 15.5V9l-5-4.5H3v11z"/><path d="M9 7.4v6.2M7.4 9 9 7.4 10.6 9M7.4 12 9 13.6 10.6 12"/>',
  ];

  // Gemeinsame Verläufe einer Karte (Kippschalter, Wählhebel-Insel) in einem unsichtbaren 0×0-SVG
  function verlaeufe(u) {
    return `<svg class="lb-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
      <linearGradient id="${u}chrom" x1="0" x2="1">
        <stop offset="0" stop-color="#26282c"/><stop offset=".16" stop-color="#8f939b"/><stop offset=".34" stop-color="#fbfcfd"/>
        <stop offset=".52" stop-color="#c3c6cc"/><stop offset=".78" stop-color="#585c63"/><stop offset="1" stop-color="#202124"/>
      </linearGradient>
      <linearGradient id="${u}flach" x1="0" y1="0" x2=".25" y2="1">
        <stop offset="0" stop-color="#4c4f55"/><stop offset=".35" stop-color="#9da1a8"/><stop offset=".75" stop-color="#dfe1e5"/><stop offset="1" stop-color="#f4f5f7"/>
      </linearGradient>
      <linearGradient id="${u}wurzel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity=".75"/><stop offset=".35" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="${u}spitze" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#a7abb2"/><stop offset=".45" stop-color="#4a4d53"/><stop offset="1" stop-color="#141517"/>
      </linearGradient>
      <linearGradient id="${u}schlitz" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000"/><stop offset=".7" stop-color="#0b0b0d"/><stop offset="1" stop-color="#1c1d21"/>
      </linearGradient>
      <radialGradient id="${u}schatten" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#000" stop-opacity=".8"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${u}eloxal" x1="0" y1="0" x2=".2" y2="1">
        <stop offset="0" stop-color="#6b6f78"/><stop offset=".3" stop-color="#3b3e45"/><stop offset=".7" stop-color="#24262b"/><stop offset="1" stop-color="#16171a"/>
      </linearGradient>
      <linearGradient id="${u}gummi" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#34353a"/><stop offset=".5" stop-color="#1a1b1e"/><stop offset="1" stop-color="#0c0c0e"/>
      </linearGradient>
    </defs></svg>`;
  }
  // Flacher Kipphebel in Ruhestellung (zum Fahrer gekippt): Schlitz, Deckfläche, rechte Flanke, Stirnfläche, Schattenwurf
  function kipp(u) {
    return `<svg class="lb-kipp" viewBox="0 0 30 38" aria-hidden="true" focusable="false">
      <ellipse cx="18" cy="34.2" rx="12" ry="3.8" fill="url(#${u}schatten)"/>
      <rect x="7.6" y="1" width="14.8" height="17.4" rx="3.6" fill="url(#${u}schlitz)" stroke="#000" stroke-width=".8"/>
      <path d="M8.8 18h12.4" stroke="#fff" stroke-opacity=".18" stroke-width=".7"/>
      <ellipse cx="15" cy="8.4" rx="4.6" ry="2.5" fill="#060607"/>
      <path d="M11.4 8.4H18.6L21.8 27H8.2Z" fill="url(#${u}flach)"/>
      <path d="M12.6 10.4V25.6M14.2 10.4V25.8M15.8 10.4V25.8M17.4 10.4V25.6" stroke="#000" stroke-opacity=".07" stroke-width=".5"/>
      <path d="M11.4 8.4H18.6L19.3 12.4H10.7Z" fill="#000" opacity=".5"/>
      <path d="M11.4 8.6 8.3 26.8" stroke="#fff" stroke-opacity=".75" stroke-width=".7"/>
      <path d="M18.6 8.4 21.8 27V30.4L19.6 11.4Z" fill="#26282c"/>
      <path d="M8.2 27H21.8V30.4H8.2Z" fill="url(#${u}spitze)"/>
      <path d="M8.2 27.1H21.8" stroke="#fff" stroke-opacity=".95" stroke-width=".6"/>
      <path d="M9 23.6H21M9.3 21.6H20.7" stroke="#000" stroke-opacity=".3" stroke-width=".55"/>
    </svg>`;
  }

  /* ---------- Ring-Klappe (154×134): Scharnier oben, sechseckiges Sichtfenster, schmale Fingerlippe unten ---------- */
  const KONTUR = 'M10 2H144Q151 2 151.5 8L146 100L128 120H106L101.5 131Q100.8 132.5 99 132.5H55Q53.2 132.5 52.5 131L48 120H26L8 100L2.5 8Q3 2 10 2Z';
  const FENSTER = 'M41 33H113L129 62L113 91H41L25 62Z';
  const WULST = 'M35 25H119L139 62L119 99H35L15 62Z';
  const SILH = KONTUR + FENSTER;   // mit fill-rule evenodd: Klappe mit Loch
  function klappeVorne(u) {
    return `<svg viewBox="0 0 154 134" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${u}l" x1="0" y1="0" x2=".15" y2="1">
          <stop offset="0" stop-color="#f02532"/><stop offset=".22" stop-color="#d0101c"/><stop offset=".62" stop-color="#a30914"/><stop offset="1" stop-color="#66040d"/>
        </linearGradient>
        <linearGradient id="${u}w" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ff4d57"/><stop offset=".45" stop-color="#d3121e"/><stop offset="1" stop-color="#860711"/>
        </linearGradient>
        <linearGradient id="${u}r" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".07" stop-color="#fff" stop-opacity=".42"/>
          <stop offset=".17" stop-color="#fff" stop-opacity=".06"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/>
          <stop offset=".9" stop-color="#ff9aa0" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
        <radialGradient id="${u}d" cx=".28" cy=".05" r=".8">
          <stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".4" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${u}s" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".34"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="${u}q" x1="0" x2="1">
          <stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset=".16" stop-color="#000" stop-opacity=".08"/><stop offset=".5" stop-color="#000" stop-opacity="0"/>
          <stop offset=".84" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".42"/>
        </linearGradient>
        <clipPath id="${u}c"><path d="${SILH}" clip-rule="evenodd"/></clipPath>
      </defs>
      <path d="${SILH}" fill-rule="evenodd" fill="url(#${u}l)"/>
      <g clip-path="url(#${u}c)">
        <path d="${WULST}${FENSTER}" fill-rule="evenodd" fill="url(#${u}w)"/>
        <path d="M35.6 25.8H118.4L138 62" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".9"/>
        <path d="M138 62 118.4 98.2H35.6L16 62" fill="none" stroke="#3a0207" stroke-opacity=".55" stroke-width="1"/>
        <path d="M25.8 61.4 41.4 34.2H112.6" fill="none" stroke="#1f0104" stroke-width="2.6" opacity=".8"/>
        <path d="M128.4 62.6 112.6 90H41.4" fill="none" stroke="#ff8a90" stroke-width="1.1" opacity=".6"/>
        <rect width="154" height="134" fill="url(#${u}q)"/>
        <rect width="154" height="134" fill="url(#${u}r)"/>
        <rect width="154" height="134" fill="url(#${u}d)"/>
        <path d="M30 134 70 0H92L52 134Z" fill="url(#${u}s)" opacity=".5"/>
        <path d="M0 112H154V134H0Z" fill="#000" opacity=".16"/>
      </g>
      <path d="M58 124.3H96M59.4 127.5H94.6" stroke="#3a0207" stroke-width="1" opacity=".75"/>
      <path d="M58 125.3H96M59.4 128.5H94.6" stroke="#ff7a80" stroke-width=".5" opacity=".3"/>
      <path d="${SILH}" fill="none" stroke="#4a030a" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M11 3.4H143" stroke="#fff" stroke-opacity=".85" stroke-width=".9" stroke-linecap="round"/>
      <path class="lb-fokus" d="${KONTUR}" fill="none" stroke-width="3" stroke-linejoin="round"/>
    </svg>`;
  }
  // Unterseite (Spiegelung über rotateY, Kontur ist symmetrisch): matt, Verstärkungsrippen, Gummipuffer
  function klappeHinten(u) {
    return `<svg viewBox="0 0 154 134" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${u}u" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4a040b"/><stop offset=".5" stop-color="#6a0610"/><stop offset="1" stop-color="#8a0914"/>
        </linearGradient>
      </defs>
      <path d="${SILH}" fill-rule="evenodd" fill="url(#${u}u)" stroke="#1c0103" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M15 10H139L134.5 96L118.5 112H35.5L19.5 96Z" fill="none" stroke="#230104" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M15 11.4H139" stroke="#ff6a70" stroke-opacity=".2" stroke-width=".7"/>
      <path d="${WULST}" fill="none" stroke="#230104" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M77 10V25M77 99V112" stroke="#230104" stroke-width="2.2"/>
      <ellipse cx="77" cy="104" rx="7" ry="3" fill="#0d0d0f" stroke="#000" stroke-width=".8"/>
      <ellipse cx="77" cy="103.2" rx="4" ry="1" fill="#fff" opacity=".12"/>
      <path class="lb-fokus" d="${KONTUR}" fill="none" stroke-width="3" stroke-linejoin="round"/>
    </svg>`;
  }
  // Materialstärke: vier Zwischenschichten zwischen Ober- und Unterseite (sichtbar an Kante und Fensterwand)
  const SCHEIBEN = ['#9b0a15', '#86070f', '#72060d', '#5c040a'].map((f, i) =>
    `<span class="lb-scheibe lb-s${i + 1}"><svg viewBox="0 0 154 134" aria-hidden="true" focusable="false"><path d="${SILH}" fill-rule="evenodd" fill="${f}"/></svg></span>`).join('');

  // Knopf 132×108, Sechseck mit Chromfase, Fortschrittsrahmen fürs Halten
  const HEX_KNOPF = 'M36 6H96L124 54L96 102H36L8 54Z';
  function knopfSvg(u) {
    return `<svg viewBox="0 0 132 108" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${u}f" x1="0" y1="0" x2=".35" y2="1">
          <stop offset="0" stop-color="#f5f6f8"/><stop offset=".22" stop-color="#8d9097"/><stop offset=".48" stop-color="#2c2e33"/>
          <stop offset=".62" stop-color="#d9dbe0"/><stop offset=".8" stop-color="#55585e"/><stop offset="1" stop-color="#1b1c1f"/>
        </linearGradient>
        <radialGradient id="${u}o" cx=".5" cy=".28" r=".85">
          <stop offset="0" stop-color="#2f3036"/><stop offset=".55" stop-color="#141518"/><stop offset="1" stop-color="#08090a"/>
        </radialGradient>
        <linearGradient id="${u}x" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path class="lb-ring-bahn" d="${HEX_KNOPF}" fill="none" stroke-width="6" stroke-linejoin="round" transform="translate(66 54) scale(1.08) translate(-66 -54)"/>
      <path class="lb-ring" d="M66 6H96L124 54L96 102H36L8 54L36 6Z" pathLength="100" fill="none" stroke-width="6" stroke-linejoin="round" transform="translate(66 54) scale(1.08) translate(-66 -54)"/>
      <path d="${HEX_KNOPF}" fill="url(#${u}f)" stroke="#050506" stroke-width="1.2" stroke-linejoin="round"/>
      <path class="lb-kappe" d="M40.5 13H91.5L115.5 54L91.5 95H40.5L16.5 54Z" fill="url(#${u}o)" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M40.5 13H91.5L103 32.6Q66 40 29 32.6Z" fill="url(#${u}x)"/>
      <path class="lb-fokus" d="${HEX_KNOPF}" fill="none" stroke-width="3" stroke-linejoin="round" transform="translate(66 54) scale(1.16) translate(-66 -54)"/>
    </svg>`;
  }
  // Wählhebel-Insel unter dem Startmodul: eloxierter Sockel, Rückwärtsgang-Hebel R, darunter P und M (Dekoration)
  function insel(u) {
    return `<svg viewBox="0 0 150 66" aria-hidden="true" focusable="false">
      <path d="M36 9H114L131 26L114 43H36L19 26Z" fill="#000" opacity=".55" transform="translate(0 2.5)"/>
      <path d="M36 6H114L131 23L114 40H36L19 23Z" fill="url(#${u}eloxal)" stroke="#060607" stroke-width="1" stroke-linejoin="round"/>
      <path d="M36.4 7H113.6L129.6 23" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width=".8"/>
      <ellipse cx="75" cy="30.8" rx="29" ry="3.2" fill="url(#${u}schatten)"/>
      <path d="M53 11.5H97L102.6 26.6Q75 31 47.4 26.6Z" fill="url(#${u}chrom)"/>
      <path d="M53 11.5H97L98 15H52Z" fill="#000" opacity=".35"/>
      <path d="M47.4 26.6Q75 31 102.6 26.6L102 30Q75 34.6 48 30Z" fill="url(#${u}spitze)"/>
      <path d="M48 26.9Q75 31.2 102 26.9" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width=".6"/>
      <text class="lb-r" x="75" y="24.4" text-anchor="middle">R</text>
      <rect x="48" y="47" width="23" height="15" rx="3.6" fill="url(#${u}gummi)" stroke="#000" stroke-width=".9"/>
      <rect x="79" y="47" width="23" height="15" rx="3.6" fill="url(#${u}gummi)" stroke="#000" stroke-width=".9"/>
      <path d="M50 47.9H69M81 47.9H100" stroke="#fff" stroke-opacity=".16" stroke-width=".7"/>
      <text class="lb-pm" x="59.5" y="58.2" text-anchor="middle">P</text>
      <text class="lb-pm" x="90.5" y="58.2" text-anchor="middle">M</text>
    </svg>`;
  }
  // Kontrollleuchten im Bildschirm (Batterie, Öldruck, Motorkontrolle), leuchten beim Zünden kurz auf
  const LEUCHTEN = [
    ['lb-l-batt', '<rect x="1.2" y="3" width="11.6" height="7.6" rx="1"/><path d="M3.4 3V1.6h2v1.4M8.6 3V1.6h2v1.4M3.6 6.8h2.4M8 6.8h2.4M9.2 5.6v2.4"/>'],
    ['lb-l-oel', '<path d="M1 5.4h3.4l1.2-1.2h3l3.6-1.6-3 4.8H3.4L1 6.6z"/><path d="M12.6 8.4c0 .8-.4 1.3-.9 1.3s-.9-.5-.9-1.3.9-1.8.9-1.8.9 1 .9 1.8z"/>'],
    ['lb-l-mot', '<path d="M2.4 4.6h1.6V3.2h5.4v1.4h1.4l1.2 1.4v3.6H10.6v1.2H5L3.6 9.6H2.4z"/><path d="M1 6v2.4M6.2 3.2V1.8M4.8 1.8h2.8"/>'],
  ].map(([k, d]) => `<svg class="${k}" viewBox="0 0 14 12">${d}</svg>`).join('');
  const SCHLOSS = '<svg class="lb-schloss" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2"/><rect x="3" y="7" width="10" height="7.5" rx="1.6"/></svg>';

  /* ---------- Klangsynthese (WebAudio) ---------- */
  function tanhKurve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    return c;
  }
  function verlauf(p, t0, punkte, mal = 1, exp = true) {
    p.cancelScheduledValues(t0);
    p.setValueAtTime(Math.max(1e-4, punkte[0][1] * mal), t0);
    for (let i = 1; i < punkte.length; i++) {
      const v = Math.max(1e-4, punkte[i][1] * mal), t = t0 + punkte[i][0];
      exp ? p.exponentialRampToValueAtTime(v, t) : p.linearRampToValueAtTime(v, t);
    }
  }

  function klangWerk() {
    let a = null, master = null, rauschen = null, kurve = null;
    const quellen = new Set();
    function bereit(ctx) {
      if (!ctx) return false;
      if (a !== ctx) {
        a = ctx;
        const komp = a.createDynamicsCompressor();
        komp.threshold.value = -16; komp.knee.value = 12; komp.ratio.value = 5; komp.attack.value = .003; komp.release.value = .25;
        master = a.createGain(); master.gain.value = .62;
        master.connect(komp).connect(a.destination);
        const n = a.sampleRate * 2, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        rauschen = b; kurve = tanhKurve(2.6);
      }
      return true;
    }
    function merke(q, start, stop) {
      quellen.add(q); q.onended = () => quellen.delete(q);
      q.start(start); if (stop) q.stop(stop);
      return q;
    }
    function osz(typ, f) { const o = a.createOscillator(); o.type = typ; o.frequency.value = f; return o; }
    function verstaerker(v) { const g = a.createGain(); g.gain.value = v; return g; }
    function filter(typ, f, q) { const b = a.createBiquadFilter(); b.type = typ; b.frequency.value = f; if (q != null) b.Q.value = q; return b; }
    function geraeusch(t0, dauer) {
      const s = a.createBufferSource(); s.buffer = rauschen; s.loop = true;
      merke(s, t0, t0 + dauer); s.playbackRate.value = .9 + Math.random() * .2;
      return s;
    }
    // kurzer mechanischer Klick (Klappe, Relais)
    function klick(t, hz, laut, dauer = .028) {
      const s = geraeusch(t, dauer + .01), bp = filter('bandpass', hz, 1.6), g = verstaerker(0);
      g.gain.setValueAtTime(laut, t); g.gain.exponentialRampToValueAtTime(1e-4, t + dauer);
      s.connect(bp).connect(g).connect(master);
    }
    function dumpf(t, f1, f2, laut, dauer) {
      const o = osz('sine', f1), g = verstaerker(0);
      o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dauer);
      g.gain.setValueAtTime(1e-4, t); g.gain.linearRampToValueAtTime(laut, t + .006); g.gain.exponentialRampToValueAtTime(1e-4, t + dauer);
      o.connect(g).connect(master); merke(o, t, t + dauer + .02);
    }
    function doppelton(t) {
      [0, .14].forEach(d => {
        const o = osz('square', 196), g = verstaerker(0), lp = filter('lowpass', 900);
        g.gain.setValueAtTime(1e-4, t + d); g.gain.linearRampToValueAtTime(.12, t + d + .008); g.gain.setValueAtTime(.12, t + d + .07); g.gain.linearRampToValueAtTime(1e-4, t + d + .09);
        o.connect(lp).connect(g).connect(master); merke(o, t + d, t + d + .1);
      });
    }
    // V10-Stimme: Zündfrequenz f (Hz), Halbordnung für das Grollen, Waveshaper, mitlaufender Tiefpass
    function motor(t0, fPunkte, gPunkte, dauer, laut = 1) {
      const mix = verstaerker(.42), ws = a.createWaveShaper(); ws.curve = kurve; ws.oversample = '2x';
      const lp = filter('lowpass', 800, .8), koerper = filter('peaking', 105, .9); koerper.gain.value = 6;
      const zitter = verstaerker(1), vca = verstaerker(0);
      mix.connect(ws).connect(lp).connect(koerper).connect(zitter).connect(vca).connect(master);
      [[1, 'sawtooth', .55], [.5, 'square', .3], [2, 'sawtooth', .13], [1.004, 'triangle', .3]].forEach(([m, typ, v]) => {
        const o = osz(typ, 60), g = verstaerker(v);
        verlauf(o.frequency, t0, fPunkte, m);
        o.connect(g).connect(mix); merke(o, t0, t0 + dauer);
      });
      const r = geraeusch(t0, dauer), rb = filter('bandpass', 300, .7), rg = verstaerker(.35);
      verlauf(rb.frequency, t0, fPunkte, 3);
      r.connect(rb).connect(rg).connect(mix);
      verlauf(lp.frequency, t0, fPunkte, 6.5);
      // unruhiger Leerlauf (Auspuff-Blubbern)
      const lfo = osz('sine', 6.3), lg = verstaerker(.16), lfo2 = osz('triangle', 2.1), lg2 = verstaerker(.08);
      lfo.connect(lg).connect(zitter.gain); lfo2.connect(lg2).connect(zitter.gain);
      merke(lfo, t0, t0 + dauer); merke(lfo2, t0, t0 + dauer);
      vca.gain.setValueAtTime(0, t0);
      gPunkte.forEach(([dt, v]) => vca.gain.linearRampToValueAtTime(v * laut, t0 + dt));
    }

    return {
      klappeAuf(ctx) {
        if (!bereit(ctx)) return; const t = a.currentTime + .005;
        klick(t, 2900, .55); dumpf(t, 150, 70, .35, .07); klick(t + .2, 1900, .2, .02);
      },
      klappeZu(ctx) {
        if (!bereit(ctx)) return; const t = a.currentTime + .005;
        dumpf(t + .2, 120, 55, .45, .09); klick(t + .2, 2300, .5);
      },
      relais(ctx) { if (!bereit(ctx)) return; klick(a.currentTime + .005, 3400, .3, .015); },
      gesperrt(ctx) { if (!bereit(ctx)) return; doppelton(a.currentTime + .01); },
      fehler(ctx) { if (!bereit(ctx)) return; doppelton(a.currentTime + .02); },
      // Anlasser orgelt sofort; Zünd-Bellen, Gasstoss und Leerlauf erst, wenn der Server den Start bestätigt (zuenden),
      // bei Fehler bricht der Anlasser ab (abwuergen). Ohne Antwort gibt der Anlasser nach 2.5 s von selbst auf.
      anlassen(ctx) {
        if (!bereit(ctx)) return null;
        const aa = a, t = a.currentTime + .02;
        klick(t, 3200, .35, .015);
        const ao = osz('sawtooth', 120), ao2 = osz('square', 241), abp = filter('bandpass', 760, 1.1);
        const aam = verstaerker(.45), alfo = osz('square', 9), alg = verstaerker(.45), avca = verstaerker(0);
        verlauf(ao.frequency, t, [[0, 85], [.18, 135], [.6, 150]]);
        verlauf(ao2.frequency, t, [[0, 172], [.18, 270], [.6, 300]]);
        verlauf(alfo.frequency, t, [[0, 7], [.3, 10.5], [.6, 12.5]]);
        ao.connect(abp); ao2.connect(verstaerker(.35)).connect(abp);
        const an = geraeusch(t, 2.6), alp = filter('lowpass', 420); an.connect(alp).connect(verstaerker(.9)).connect(aam);
        abp.connect(aam); alfo.connect(alg).connect(aam.gain); aam.connect(avca).connect(master);
        avca.gain.setValueAtTime(0, t); avca.gain.linearRampToValueAtTime(.55, t + .04);
        avca.gain.setValueAtTime(.55, t + 2.3); avca.gain.linearRampToValueAtTime(0, t + 2.5);
        [ao, ao2, alfo].forEach(o => merke(o, t, t + 2.6));
        let fertig = false;
        return {
          zuenden() {
            if (fertig || a !== aa) return; fertig = true;
            const jetzt = a.currentTime; if (jetzt > t + 2.2) return;
            const tz = Math.max(t + .52, jetzt + .04);
            avca.gain.cancelScheduledValues(tz); avca.gain.setValueAtTime(.55, tz); avca.gain.linearRampToValueAtTime(0, tz + .14);
            // Zünd-Bellen
            const bn = geraeusch(tz, .3), blp = filter('lowpass', 2200, .7), bg = verstaerker(0);
            verlauf(blp.frequency, tz, [[0, 2600], [.25, 380]]);
            bg.gain.setValueAtTime(1e-4, tz); bg.gain.linearRampToValueAtTime(.95, tz + .012); bg.gain.exponentialRampToValueAtTime(1e-4, tz + .28);
            bn.connect(blp).connect(bg).connect(master);
            dumpf(tz, 78, 38, .8, .3);
            // Motor: Gasstoss auf ~4300/min, dann Leerlauf ~1100/min (V10: Zündfrequenz = U/min / 12)
            motor(tz - .06, [[0, 26], [.1, 92], [.34, 355], [.5, 320], [1.15, 125], [1.6, 98], [3.4, 92]],
              [[0, 0], [.05, .9], [.34, 1], [.62, .72], [1.3, .42], [2.4, .3], [3.35, 0]], 3.4);
          },
          abwuergen() {
            if (fertig || a !== aa) return; fertig = true;
            const jetzt = a.currentTime;
            if (jetzt < t + 2.3) {
              avca.gain.cancelScheduledValues(jetzt); avca.gain.setValueAtTime(avca.gain.value, jetzt); avca.gain.linearRampToValueAtTime(0, jetzt + .06);
              [ao, ao2].forEach(o => { o.frequency.cancelScheduledValues(jetzt); o.frequency.setValueAtTime(o.frequency.value, jetzt); o.frequency.exponentialRampToValueAtTime(40, jetzt + .06); });
            }
            doppelton(jetzt + .1);
          },
        };
      },
      // kurzer Doppel-Gasstoss, sobald das Gerät nach eigenem Start wach meldet
      wach(ctx) {
        if (!bereit(ctx) || ctx.state !== 'running') return; const t = a.currentTime + .02;
        motor(t, [[0, 90], [.12, 250], [.36, 110], [.5, 200], [.9, 94]], [[0, 0], [.04, .4], [.3, .45], [.5, .42], [1, 0]], 1.05, .9);
      },
      // Abstellen (nach Bestätigung durch den Server): Leerlauf bricht zusammen, letzte Zündungen, dumpfes Auslaufen
      stop(ctx) {
        if (!bereit(ctx)) return; const t = a.currentTime + .02;
        motor(t, [[0, 94], [.22, 82], [.55, 48], [.85, 22]], [[0, 0], [.04, .55], [.4, .45], [.85, 0]], .9);
        dumpf(t + .76, 62, 34, .55, .22);
      },
      halt() {
        quellen.forEach(q => { try { q.stop(); } catch (e) {} });
        quellen.clear();
        try { master && master.disconnect(); } catch (e) {}
        a = null; master = null;
      },
    };
  }

  /* ---------- Karte ---------- */
  // Was der grosse Knopf gerade bedeutet: Ändert sich das, muss die Klappe neu angehoben werden
  const bedeutung = s => (s === 'aus' || s === 'unbekannt') ? 'start' : s === 'an' ? 'stop' : null;

  PCW.registriere({
    id: 'lambo',
    name: 'Supersportwagen',
    karte(el, geraet, api) {
      const u = 'lb' + (++nr) + '-';
      el.classList.add('lb-karte');
      el.innerHTML = `
        ${verlaeufe(u)}
        <div class="lb-tft-rahmen">
          <div class="lb-tft">
            <div class="lb-tft-kopf">
              <div class="lb-tft-titel"><div class="lb-name"></div><div class="lb-info"></div></div>
              <div class="lb-status"><i></i><span class="lb-status-text">PRÜFE</span></div>
            </div>
            <div class="lb-tacho" aria-hidden="true"><div class="lb-tacho-hell"></div><div class="lb-tacho-dunkel"></div></div>
            <div class="lb-skala" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => `<span>${i}</span>`).join('')}</div>
            <div class="lb-tft-fuss" aria-hidden="true">
              <span class="lb-leuchten">${LEUCHTEN}</span>
              <span class="lb-zeit"></span><span class="lb-einheit">×1000/min</span>
            </div>
            <div class="lb-dimmer"></div>
          </div>
        </div>
        <div class="lb-schalter" aria-hidden="true">
          <i class="lb-steg"></i>${SYMBOLE.map((s, i) => `<span class="lb-schalt${i === 3 ? ' lb-warn' : ''}"><svg class="lb-sym" viewBox="0 0 20 20">${s}</svg>${kipp(u)}</span><i class="lb-steg"></i>`).join('')}
        </div>
        <div class="lb-tunnel">
          <div class="lb-buehne">
            <div class="lb-platte">
              <div class="lb-einfassung"><i class="lb-led"></i></div>
              <div class="lb-mulde"><div class="lb-glimmen"></div></div>
              <div class="lb-schatten"></div>
              <div class="lb-scharnier"></div>
              <button class="lb-klappe" type="button" aria-expanded="false">
                <span class="lb-seite lb-vorne">${klappeVorne(u + 'v')}</span>
                ${SCHEIBEN}
                <span class="lb-seite lb-hinten">${klappeHinten(u + 'h')}</span>
              </button>
              <button class="lb-knopf" type="button" tabindex="-1" aria-hidden="true">
                ${knopfSvg(u)}
                <span class="lb-knopf-text"><small>ENGINE</small><b class="lb-start">START</b><small class="lb-stop">STOP</small>${SCHLOSS}</span>
              </button>
            </div>
          </div>
          <div class="lb-insel" aria-hidden="true">${insel(u)}</div>
        </div>
        <div class="lb-hinweis" role="status"></div>`;

      const $ = s => el.querySelector(s);
      const klappe = $('.lb-klappe'), knopf = $('.lb-knopf'), ring = $('.lb-ring'), hinweisEl = $('.lb-hinweis');
      const statusText = $('.lb-status-text'), zeitEl = $('.lb-zeit');
      $('.lb-name').textContent = geraet.name;
      $('.lb-info').textContent = geraet.info || '';

      const klang = klangWerk();
      let z = 'unbekannt', daten = { ...geraet }, offen = false, offenSeit = 0, zuSeit = 0, erste = true, weg = false;
      let zuTimer = 0, fehlerTimer = 0, blitzTimer = 0, frischTimer = 0, uhr = 0, aktionSeit = 0, druckAbgebrochen = false;
      let halten = 0, haltT0 = 0, haltPid = null, haltX = 0, haltY = 0;
      let eingefroren = false, vonHier = false, blitz = '', ctx = null;
      // AudioContext nur in Nutzergesten holen; automatische Töne (Auto-Zu, Wach-Meldung) nutzen den gemerkten
      const geste = () => (ctx = api.audio());

      const gesperrt = () => z === 'an' && !daten.kann_aus;
      const name = () => daten.name || geraet.name;

      function hinweisSetzen() {
        if (hinweisEl.classList.contains('lb-fehler') || halten) return;
        let t;
        if (blitz) t = blitz;
        else if (z === 'startet') t = 'Zündung · Gerät fährt hoch …';
        else if (z === 'stoppt') t = 'Wird heruntergefahren …';
        else if (z === 'an' && gesperrt()) t = 'Läuft · Ausschalten ist nicht eingerichtet';
        else if (z === 'an') t = offen ? 'STOP 1.5 s ruhig gedrückt halten' : 'Läuft · zum Abstellen Klappe anheben';
        else if (z === 'unbekannt') t = offen ? 'START drücken' : 'Status wird geprüft · Klappe anheben';
        else t = offen ? 'START drücken' : 'Klappe anheben';
        hinweisEl.textContent = t;
      }
      function zeitSetzen() {
        if (z !== 'startet' && z !== 'stoppt') { zeitEl.textContent = ''; return; }
        const s = Math.max(0, Math.floor((Date.now() - aktionSeit) / 1000));
        zeitEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      }
      function uhrLauf(an) {
        clearInterval(uhr); uhr = 0;
        if (an && !eingefroren) uhr = setInterval(zeitSetzen, 1000);
        zeitSetzen();
      }
      function zeichnen() {
        el.dataset.zustand = z;
        el.classList.toggle('lb-offen', offen);
        el.classList.toggle('lb-gesperrt', gesperrt());
        statusText.textContent = STATUS[z] || z;
        const n = name();
        klappe.setAttribute('aria-label', offen ? `Schutzklappe ${n} schliessen` : `Schutzklappe ${n} öffnen`);
        klappe.setAttribute('aria-expanded', String(offen));
        let lbl;
        if (z === 'an' && gesperrt()) lbl = `${n}: Ausschalten ist nicht eingerichtet`;
        else if (z === 'an') lbl = `${n} ausschalten – STOP 1.5 Sekunden gedrückt halten`;
        else if (z === 'startet') lbl = `${n} startet`;
        else if (z === 'stoppt') lbl = `${n} fährt herunter`;
        else lbl = `${n} starten`;
        knopf.setAttribute('aria-label', lbl);
        knopf.setAttribute('aria-disabled', String(z === 'startet' || z === 'stoppt' || gesperrt()));
        knopf.tabIndex = offen ? 0 : -1;
        knopf.setAttribute('aria-hidden', String(!offen));
        hinweisSetzen();
      }
      function frisch() {   // Anlass-/Auslauf-Animationen nur, wenn der Wechsel in dieser Instanz passiert
        el.classList.add('lb-frisch'); clearTimeout(frischTimer);
        frischTimer = setTimeout(() => el.classList.remove('lb-frisch'), FRISCH_MS);
      }

      function zuTimerNeu() {
        clearTimeout(zuTimer);
        if (offen && !eingefroren) zuTimer = setTimeout(() => { if (!halten) schliessen(true); else zuTimerNeu(); }, ZU_MS);
      }
      function oeffnen() {
        offen = true; offenSeit = Date.now();
        klang.klappeAuf(geste()); api.vib(12);
        zeichnen(); zuTimerNeu();
      }
      function schliessen(ton) {
        if (!offen) return;
        haltenAbbrechen();
        knopf.classList.remove('lb-gedrueckt');
        offen = false; zuSeit = Date.now(); clearTimeout(zuTimer);
        if (document.activeElement === knopf) klappe.focus({ preventScroll: true });
        if (ton) klang.klappeZu(ctx);
        zeichnen();
      }
      function hinweisBlitz(t) {
        blitz = t; el.classList.add('lb-blitz'); hinweisSetzen();
        clearTimeout(blitzTimer);
        blitzTimer = setTimeout(() => { blitz = ''; el.classList.remove('lb-blitz'); hinweisSetzen(); }, 2000);
      }

      /* Halten für STOP */
      function ringSetzen(p) { ring.style.strokeDashoffset = String(100 - p * 100); }
      function haltenStart() {
        if (halten || z !== 'an' || gesperrt()) return;
        haltT0 = performance.now(); el.classList.add('lb-haelt'); hinweisEl.setAttribute('aria-hidden', 'true');
        klang.relais(geste()); api.vib(15); clearTimeout(zuTimer);
        let puls = 0;
        const schritt = now => {
          const p = Math.min(1, (now - haltT0) / HALTEN_MS);
          ringSetzen(p);
          hinweisEl.textContent = `Halten … ${Math.max(0, (HALTEN_MS - (now - haltT0)) / 1000).toFixed(1)} s`;
          if (p > (puls + 1) / 3 && p < 1) { puls++; api.vib(8); }
          if (p >= 1) {
            halten = 0; haltPid = null;
            el.classList.remove('lb-haelt'); knopf.classList.remove('lb-gedrueckt'); ringSetzen(0); hinweisEl.removeAttribute('aria-hidden');
            klang.relais(ctx); api.vib([60, 40, 140]);
            api.stoppen().then(r => { if (!weg) (r && r.ok ? klang.stop(ctx) : klang.fehler(ctx)); }, () => { if (!weg) klang.fehler(ctx); });
            zeichnen();
            return;
          }
          halten = requestAnimationFrame(schritt);
        };
        halten = requestAnimationFrame(schritt);
      }
      function haltenAbbrechen() {
        if (!halten) return;
        cancelAnimationFrame(halten); halten = 0; haltPid = null;
        el.classList.remove('lb-haelt'); ringSetzen(0); hinweisEl.removeAttribute('aria-hidden'); hinweisSetzen(); zuTimerNeu();
      }
      // bewusster Abbruch (Wegziehen, Scroll-Wisch, Fensterwechsel): Capture lösen und kurz melden
      function abbruch(text) {
        const pid = haltPid;
        knopf.classList.remove('lb-gedrueckt');
        if (!halten) return;
        haltenAbbrechen();
        if (pid != null) { try { if (knopf.hasPointerCapture(pid)) knopf.releasePointerCapture(pid); } catch (x) {} }
        druckAbgebrochen = true; api.vib(25);
        hinweisBlitz(text);
      }

      function zuenden() {
        vonHier = true;
        const anl = klang.anlassen(geste());
        api.vib([16, 40, 16, 40, 16, 40, 16]);
        api.starten().then(r => {
          if (weg || !anl) return;
          if (r && r.ok) { anl.zuenden(); api.vib([70, 40, 120]); } else anl.abwuergen();
        }, () => { if (!weg && anl) anl.abwuergen(); });
      }
      function ausloesen() {
        if (!offen || Date.now() - offenSeit < ANIM_MS) return;
        if (z === 'startet' || z === 'stoppt') return;
        zuTimerNeu();
        if (z === 'aus' || z === 'unbekannt') zuenden();
        else if (gesperrt()) { klang.gesperrt(geste()); api.vib([30, 50, 30]); hinweisBlitz('Ausschalten ist nicht eingerichtet'); }
        else if (z === 'an' && !halten && !druckAbgebrochen) hinweisBlitz('Gedrückt halten – 1.5 s');
      }

      /* Ereignisse: Klappe */
      klappe.addEventListener('click', () => {
        if (eingefroren) return;
        const jetzt = Date.now();
        if (jetzt - offenSeit < ANIM_MS || jetzt - zuSeit < ANIM_MS) return;
        if (offen) { geste(); schliessen(true); } else oeffnen();
      });
      klappe.addEventListener('keydown', e => {
        if (e.key === 'Escape' && offen) { e.preventDefault(); geste(); schliessen(true); return; }
        if ((e.key === 'Enter' || e.key === ' ') && e.repeat) e.preventDefault();   // gehaltene Taste klappt nicht hin und her
      });

      /* Ereignisse: Knopf */
      knopf.addEventListener('click', () => { if (!eingefroren) ausloesen(); });
      knopf.addEventListener('pointerdown', e => {
        if (eingefroren || !offen || Date.now() - offenSeit < ANIM_MS) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (z === 'startet' || z === 'stoppt') return;
        if (e.isPrimary) druckAbgebrochen = false;
        if (!e.isPrimary) { abbruch('Abgebrochen – nur ein Finger'); return; }
        knopf.classList.add('lb-gedrueckt'); api.vib(8); zuTimerNeu();
        if (z === 'an' && !gesperrt()) {
          haltPid = e.pointerId; haltX = e.clientX; haltY = e.clientY;
          try { knopf.setPointerCapture(e.pointerId); } catch (x) {}   // nur, damit pointerup sicher ankommt
          haltenStart();
          haltPid = halten ? e.pointerId : null;
        }
      });
      knopf.addEventListener('pointermove', e => {
        if (!halten || e.pointerId !== haltPid) return;
        const r = knopf.getBoundingClientRect();
        const draussen = e.clientX < r.left - RAND_PX || e.clientX > r.right + RAND_PX || e.clientY < r.top - RAND_PX || e.clientY > r.bottom + RAND_PX;
        if (draussen || Math.hypot(e.clientX - haltX, e.clientY - haltY) > WEG_PX) abbruch('Abgebrochen – Finger ruhig halten');
      });
      const loslassen = () => { knopf.classList.remove('lb-gedrueckt'); haltenAbbrechen(); };
      ['pointerup', 'lostpointercapture', 'blur'].forEach(t => knopf.addEventListener(t, loslassen));
      // pointercancel: Browser übernimmt die Geste (z. B. Scrollen) – das ist ein Abbruch, kein Loslassen
      knopf.addEventListener('pointercancel', () => { if (halten) abbruch('Abgebrochen – Finger ruhig halten'); else loslassen(); });
      knopf.addEventListener('pointerleave', e => { if (!(knopf.hasPointerCapture && knopf.hasPointerCapture(e.pointerId))) loslassen(); });
      knopf.addEventListener('contextmenu', e => e.preventDefault());
      knopf.addEventListener('keydown', e => {
        if (e.key === 'Escape') { if (offen) { e.preventDefault(); geste(); schliessen(true); } return; }
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (z === 'an' && offen && !gesperrt()) {
          e.preventDefault();
          if (!e.repeat && Date.now() - offenSeit >= ANIM_MS) { knopf.classList.add('lb-gedrueckt'); zuTimerNeu(); haltenStart(); }
        } else if (e.repeat) e.preventDefault();
      });
      knopf.addEventListener('keyup', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (halten || knopf.classList.contains('lb-gedrueckt')) { if (z === 'an' || z === 'stoppt') e.preventDefault(); loslassen(); }
      });
      // Fenster- oder Tab-Wechsel während des Haltens bricht ab
      const sichtWeg = () => { if (halten && (document.hidden || !document.hasFocus())) abbruch('Abgebrochen'); };
      document.addEventListener('visibilitychange', sichtWeg);
      window.addEventListener('blur', sichtWeg);

      zeichnen();

      return {
        setze(neu, d) {
          if (eingefroren) return;
          const alt = z, warGesperrt = gesperrt();
          z = neu; daten = { ...daten, ...d };
          if (alt !== z) {
            const bAlt = bedeutung(alt), bNeu = bedeutung(z);
            if (alt === 'startet' && z === 'an' && vonHier) klang.wach(ctx);
            // Entsicherung gilt nur für die Aktion, für die sie gemacht wurde
            if (offen && bNeu && bAlt !== bNeu) {
              schliessen(true);
              if (bAlt) hinweisBlitz('Zustand geändert – Klappe neu anheben');
            }
            if (z === 'startet' || z === 'stoppt') {
              const gemerkt = aktionen.get(geraet.id);
              const rahmenSeit = api.seit && api.seit();
              if (rahmenSeit) { aktionSeit = rahmenSeit; aktionen.set(geraet.id, { z, t: aktionSeit }); }
              else if (erste && gemerkt && gemerkt.z === z && Date.now() - gemerkt.t < AKTION_MAX_MS) aktionSeit = gemerkt.t;
              else { aktionSeit = Date.now(); aktionen.set(geraet.id, { z, t: aktionSeit }); }
              if (!erste) frisch();
              uhrLauf(true);
            } else {
              uhrLauf(false);
              if (z === 'an' || z === 'aus') aktionen.delete(geraet.id);
            }
            if (z !== 'an') haltenAbbrechen();
            if (z === 'an' || z === 'aus') vonHier = false;
          } else if (offen && z === 'an' && warGesperrt !== gesperrt()) schliessen(true);
          erste = false;
          zeichnen();
        },
        meldung(text, fehler) {
          hinweisEl.textContent = text; hinweisEl.classList.toggle('lb-fehler', !!fehler);
          clearTimeout(fehlerTimer);
          fehlerTimer = setTimeout(() => { hinweisEl.classList.remove('lb-fehler'); hinweisSetzen(); }, 5000);
        },
        vorschau(stufe) {
          eingefroren = true; clearTimeout(zuTimer); clearInterval(uhr);
          const map = { ruhe: ['aus', false], bereit: ['aus', true], startet: ['startet', false], an: ['an', false], 'an-bereit': ['an', true], stoppt: ['stoppt', false] };
          const [zz, o] = map[stufe] || map.ruhe;
          el.classList.add('lb-sofort');
          z = zz; offen = o; offenSeit = 0;
          aktionSeit = Date.now() - 7000; zeitSetzen();
          zeichnen();
        },
        entfernen() {
          weg = true;
          clearTimeout(zuTimer); clearTimeout(fehlerTimer); clearTimeout(blitzTimer); clearTimeout(frischTimer); clearInterval(uhr);
          if (halten) cancelAnimationFrame(halten);
          halten = 0;
          document.removeEventListener('visibilitychange', sichtWeg);
          window.removeEventListener('blur', sichtWeg);
          klang.halt();
        },
      };
    },
  });
})();
