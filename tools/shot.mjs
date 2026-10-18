// Screenshot-Werkzeug ueber das Chrome DevTools Protocol (headless Chrome, eigenes Profil unter tools/chrome-prof-<port>, gitignored)
// node shot.mjs --url URL --out file.png [--w 1440 --h 900 --dpr 1 --mobile --full] [--js "code"]... [--wait ms]
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = { w: 1440, h: 900, dpr: 1, mobile: false, full: false, js: [], wait: 700, out: "shot.png" };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--mobile") opt.mobile = true;
  else if (a === "--full") opt.full = true;
  else if (a === "--js") opt.js.push(args[++i]);
  else opt[a.replace(/^--/, "")] = args[++i];
}
const PORT = Number(process.env.SHOT_PORT || 9566);   // headless Chrome bleibt fuer weitere Aufnahmen laufen

async function ensureChrome() {
  try { await fetch(`http://127.0.0.1:${PORT}/json/version`); return; } catch {}
  const p = spawn(process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
    "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(here, `chrome-prof-${PORT}`)}`,
    "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--disable-gpu", "about:blank",
  ], { detached: true, stdio: "ignore" });
  p.unref();
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try { await fetch(`http://127.0.0.1:${PORT}/json/version`); return; } catch {}
  }
  throw new Error("Chrome startet nicht");
}

await ensureChrome();
const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else listeners.forEach((fn) => fn(msg));
});
const send = (method, params = {}) => new Promise((resolve) => {
  const mid = ++id;
  pending.set(mid, resolve);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const once = (method) => new Promise((resolve) => {
  const fn = (m) => { if (m.method === method) { listeners.splice(listeners.indexOf(fn), 1); resolve(m); } };
  listeners.push(fn);
});
const logs = [];
listeners.push((m) => {
  if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type)) logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(" ")}`);
  if (m.method === "Runtime.exceptionThrown") logs.push(`exception: ${m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text}`);
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") logs.push(`log: ${m.params.entry.text} ${m.params.entry.url || ""}`);
});

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", { width: +opt.w, height: +opt.h, deviceScaleFactor: +opt.dpr, mobile: opt.mobile });
if (opt.mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
if (opt.reduce) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
const loaded = once("Page.loadEventFired");
await send("Page.navigate", { url: opt.url });
await loaded;
await new Promise((r) => setTimeout(r, 500));
for (const code of opt.js) {
  const res = await send("Runtime.evaluate", { expression: `(async () => { ${code} })()`, awaitPromise: true, returnByValue: true, userGesture: true });
  if (res.result?.exceptionDetails) logs.push(`js-error: ${res.result.exceptionDetails.exception?.description}`);
  else if (res.result?.result?.value !== undefined) console.log("js:", JSON.stringify(res.result.result.value));
  await new Promise((r) => setTimeout(r, 350));
}
await new Promise((r) => setTimeout(r, +opt.wait));
let params = { format: "png" };
if (opt.full) {
  const m = await send("Page.getLayoutMetrics");
  const cs = m.result.cssContentSize || m.result.contentSize;
  params = { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: cs.width, height: Math.min(cs.height, 16000), scale: 1 } };
}
const shot = await send("Page.captureScreenshot", params);
writeFileSync(opt.out, Buffer.from(shot.result.data, "base64"));
console.log("saved", opt.out, logs.length ? `\n${logs.join("\n")}` : "(keine Konsolenfehler)");
await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
ws.close();
process.exit(0);
