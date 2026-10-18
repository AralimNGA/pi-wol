/* Startzentrale – Rahmen: Geraeteliste, Zustandsmaschine, API, Design-Umschalter, Demo-Modus.
   Designs registrieren sich ueber PCW.registriere({...}); Vertrag siehe THEMEN.md. */
(() => {
  'use strict';
  const REIHENFOLGE = ['lambo', 'cockpit', 'atom'];
  const TIMEOUT_MS = 180000;            // so lange gilt "startet"/"stoppt", danach zaehlt nur der echte Status
  const POLL_MS = 3000;
  const STUFEN = ['ruhe', 'bereit', 'startet', 'an', 'an-bereit', 'stoppt'];

  const params = new URLSearchParams(location.search);
  const DEMO = params.has('demo');
  const VORSCHAU = params.get('vorschau');   // nur fuer Screenshots: friert alle Karten in einer Stufe ein

  const themen = {};
  const karten = new Map();                 // id -> {el, daten, pending, seit, inst}
  let aktiv = null, ctx = null, pollTimer = null;

  /* ---------- Demo-Backend (?demo) ---------- */
  const demo = {
    geraete: [
      { id: 'pc', name: 'Render-PC', info: 'RTX 5090', wach: false, kann_aus: true },
      { id: 'thinkpad', name: 'ThinkPad', info: 'Dock · LAN', wach: true, kann_aus: false },
    ],
    async liste() { return demo.geraete.map(g => ({ ...g })); },
    async aktion(art, id) {
      const g = demo.geraete.find(x => x.id === id);
      if (!g) return { ok: false, text: 'Unbekanntes Geraet' };
      if (art === 'aus' && !g.kann_aus) return { ok: false, text: 'Fuer dieses Geraet ist kein SSH-Zugang eingerichtet' };
      setTimeout(() => { g.wach = art === 'an'; }, art === 'an' ? 6000 : 4000);
      return { ok: true, text: art === 'an' ? 'Magic Packet gesendet' : 'Herunterfahren ausgeloest' };
    },
  };

  async function apiListe() {
    if (DEMO) return demo.liste();
    const r = await fetch('/api/geraete', { cache: 'no-store' });
    return r.json();
  }
  async function apiAktion(art, id) {
    if (DEMO) return demo.aktion(art, id);
    try {
      // X-PCW: Server lehnt POST ohne diesen Header ab (Schutz gegen fremde Webseiten, CSRF)
      const r = await fetch(`/api/${art}/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'X-PCW': '1' } });
      return await r.json();
    } catch (e) { return { ok: false, text: 'Pi nicht erreichbar' }; }
  }

  /* ---------- Zustand ---------- */
  function zustand(k) {
    if (k.pending && Date.now() - k.seit > TIMEOUT_MS) k.pending = null;
    if (k.pending === 'start' && k.daten.wach === true) k.pending = null;
    if (k.pending === 'stop' && k.daten.wach === false) k.pending = null;
    if (k.pending === 'start') return 'startet';
    if (k.pending === 'stop') return 'stoppt';
    if (k.daten.wach === true) return 'an';
    if (k.daten.wach === false) return 'aus';
    return 'unbekannt';
  }
  function malen(k) {
    if (VORSCHAU || !k.inst) return;
    try { k.inst.setze(zustand(k), { ...k.daten }); } catch (e) { console.error(e); }
  }

  /* ---------- API fuer Designs ---------- */
  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function vib(muster) { try { navigator.vibrate && navigator.vibrate(muster); } catch (e) {} }
  const reduziert = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function apiFuer(k) {
    return {
      zustand: () => zustand(k),
      seit: () => (k.pending ? k.seit : null),   // Startzeitpunkt der laufenden Aktion (ms), ueberlebt Designwechsel
      daten: () => ({ ...k.daten }),
      audio, vib, reduziert,
      async starten() {
        const z = zustand(k);
        if (z !== 'aus' && z !== 'unbekannt') return { ok: false, text: 'Laeuft bereits' };
        k.pending = 'start'; k.seit = Date.now(); malen(k);
        const r = await apiAktion('an', k.daten.id);
        if (!r.ok) { k.pending = null; melden(k, r.text || 'Fehlgeschlagen', true); }
        malen(k);
        return r;
      },
      async stoppen() {
        if (zustand(k) !== 'an') return { ok: false, text: 'Ist nicht eingeschaltet' };
        if (!k.daten.kann_aus) { melden(k, 'Ausschalten ist nicht eingerichtet', true); return { ok: false }; }
        k.pending = 'stop'; k.seit = Date.now(); malen(k);
        const r = await apiAktion('aus', k.daten.id);
        if (!r.ok) { k.pending = null; melden(k, r.text || 'Fehlgeschlagen', true); }
        malen(k);
        return r;
      },
    };
  }
  function melden(k, text, fehler) {
    try { k.inst && k.inst.meldung && k.inst.meldung(text, !!fehler); } catch (e) { console.error(e); }
  }

  /* ---------- Aufbau ---------- */
  function karteBauen(d) {
    const el = document.createElement('section');
    el.className = 'pcw-karte';
    el.dataset.id = d.id;
    const k = { el, daten: d, pending: null, seit: 0, inst: null };
    karten.set(d.id, k);
    document.getElementById('pcw-geraete').appendChild(el);
    instanzieren(k);
  }
  function instanzieren(k) {
    k.el.replaceChildren();
    k.el.className = 'pcw-karte';
    try {
      k.inst = themen[aktiv].karte(k.el, { ...k.daten }, apiFuer(k));
      if (VORSCHAU) k.inst.vorschau && k.inst.vorschau(STUFEN.includes(VORSCHAU) ? VORSCHAU : 'ruhe');
      else malen(k);
    } catch (e) { console.error(e); k.inst = null; }
  }

  function themaSetzen(id, merken) {
    if (!themen[id]) id = REIHENFOLGE.find(t => themen[t]) || Object.keys(themen)[0];
    if (!id) return;
    karten.forEach(k => { try { k.inst && k.inst.entfernen && k.inst.entfernen(); } catch (e) {} });
    if (aktiv) document.body.classList.remove('thema-' + aktiv);
    aktiv = id;
    document.body.classList.add('thema-' + id);
    document.documentElement.dataset.thema = id;
    document.querySelectorAll('.pcw-wahl button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.thema === id)));
    karten.forEach(instanzieren);
    if (merken) { try { localStorage.setItem('pcw-thema', id); } catch (e) {} }
  }

  function wahlBauen() {
    const nav = document.querySelector('.pcw-wahl');
    const ids = REIHENFOLGE.filter(t => themen[t]).concat(Object.keys(themen).filter(t => !REIHENFOLGE.includes(t)));
    nav.replaceChildren(...ids.map(id => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.thema = id; b.textContent = themen[id].name;
      b.addEventListener('click', () => themaSetzen(id, true));
      return b;
    }));
  }

  async function laden() {
    const fuss = document.getElementById('pcw-fuss');
    try {
      const liste = await apiListe();
      liste.forEach(d => {
        const k = karten.get(d.id);
        if (k) { k.daten = d; malen(k); } else karteBauen(d);
      });
      fuss.textContent = `${DEMO ? 'Demo' : location.host} · Status ${new Date().toLocaleTimeString('de-CH')}`;
    } catch (e) { fuss.textContent = 'Pi nicht erreichbar'; }
  }

  window.PCW = {
    registriere(t) { themen[t.id] = t; },
    start() {
      wahlBauen();
      let start = params.get('thema');
      if (!start) { try { start = localStorage.getItem('pcw-thema'); } catch (e) {} }
      themaSetzen(start, false);
      laden();
      if (!VORSCHAU) {
        pollTimer = setInterval(laden, POLL_MS);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) laden(); });
      }
    },
    // fuer Tests im Browser
    _intern: { karten, zustand, themen, get aktiv() { return aktiv; }, demo },
  };
})();
