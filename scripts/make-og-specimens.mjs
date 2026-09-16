// Builds public/og/<id>.png — one 1200x630 share card per specimen, so a link
// to a single pelican previews as that pelican instead of the zoo's front gate.
//
// Two rules carried over from make-og.mjs, both about not spending Simon's
// bandwidth: the card is rendered from a local copy, never hotlinked, and the
// 79 specimens that survive only as pictures are fetched from his server once
// into .ogcache/ and then left alone. A share card is the image every crawler
// that ever sees the link will fetch; that bill is ours.
//
// Rendering needs Chrome listening on --remote-debugging-port=9446. It opens
// its own tab and closes it again, so whatever you had open is left alone.
// Output is committed, because the Cloudflare build has no browser in it.
//
//   node scripts/make-og-specimens.mjs [--only <id>] [--force]
import fs from 'node:fs';
import path from 'node:path';
import { loadFeed } from '../src/lib/feed.js';

const PORT = 9446;
const OUT_DIR = 'public/og';
const CACHE_DIR = '.ogcache';
const TMP = '/tmp/og-specimen.html';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const force = args.includes('--force');

const wild = JSON.parse(fs.readFileSync('data/specimens.json', 'utf8')).filter((s) => s.model);
// Fed pelicans get a page, so they get a card. The person who sent one in is
// the single most likely person to share it.
const taken = new Set(wild.map((s) => s.id));
const specimens = [...wild, ...loadFeed().filter((f) => !taken.has(f.id))]
  .filter((s) => !only || s.id === only);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

/** The picture-only specimens, pulled once and kept. Failing to fetch one is
 *  not fatal — that card is skipped and the page falls back to the zoo card. */
async function localCopy(s) {
  const ext = (s.asset.match(/\.(png|jpe?g|gif|webp|svg)(?:\?|$)/i)?.[1] || 'png').toLowerCase();
  const file = path.join(CACHE_DIR, `${s.id}.${ext}`);
  if (fs.existsSync(file)) return file;
  const r = await fetch(s.asset);
  if (!r.ok) throw new Error(`${r.status} fetching ${s.asset}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  // His server, his pace. This runs 79 times once, and never again.
  await new Promise((r) => setTimeout(r, 300));
  return file;
}

const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Long model names are the norm here (`qwen-3.8-27b-no-reasoning-pelican-2`),
// and shrinking to fit beats truncating: the name is the whole caption.
const nameSize = (n) => (n.length > 34 ? 30 : n.length > 26 ? 36 : n.length > 18 ? 44 : 54);

function cardHtml(s, art) {
  return `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; background: #f2ede1; color: #22201b;
    font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif;
    display: grid; grid-template-columns: 630px 1fr;
  }
  .frame {
    position: relative; background: #fff; border-right: 6px solid #c8a64b;
    padding: 26px;
  }
  /* Pinned to the box rather than sized in percentages: under a fixed parent a
     percentage height on an SVG is still indefinite, and a square pelican
     spills out with the bicycle cropped off. */
  .frame > * { position: absolute; inset: 26px; margin: auto; max-width: calc(100% - 52px); max-height: calc(100% - 52px); }
  .meta { padding: 46px 48px 40px; display: flex; flex-direction: column; }
  /* Centred against the picture rather than stacked at the top: these names
     are one line for o1-mini and three for the qwen variants, and a block
     pinned to the top leaves a hole under the short ones. */
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .eyebrow {
    font: 700 17px/1 ui-monospace, "SF Mono", monospace; letter-spacing: .13em;
    text-transform: uppercase; color: #7a7265;
  }
  h1 {
    margin-top: 22px; word-break: break-word;
    font: 700 ${nameSize(s.model)}px/1.1 ui-monospace, "SF Mono", monospace; color: #1e3a2b;
  }
  .sub { margin-top: 18px; font-size: 25px; color: #4a453c; }
  .tag {
    margin-top: 26px; align-self: flex-start; padding: 7px 13px; border-radius: 3px;
    font: 700 15px/1 ui-monospace, monospace; letter-spacing: .1em;
    background: #1e3a2b; color: #c8a64b;
  }
  .tag.fed { background: #8a6a12; color: #fff; }
  .foot {
    margin-top: auto; border-top: 2px solid #c8a64b; padding-top: 16px;
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 18px; color: #7a7265;
  }
  .foot b { font: 700 22px/1 ui-monospace, monospace; letter-spacing: .04em; color: #1e3a2b; }
</style>
<div class="frame">${art}</div>
<div class="meta">
  <div class="body">
    <div class="eyebrow">a pelican riding a bicycle</div>
    <h1>${esc(s.model)}</h1>
    <div class="sub">${esc(s.observed || '')}</div>
    ${s.origin === 'feed'
      ? '<div class="tag fed">FED · SELF-REPORTED</div>'
      : s.alive ? '<div class="tag">ALIVE · VECTOR</div>' : ''}
  </div>
  <div class="foot"><span>${s.origin === 'feed'
    ? `fed by ${esc(s.by || 'a visitor')}`
    : 'drawn by a language model'}</span><b>pelicanzoo.ai</b></div>
</div>`;
}

/* ---- CDP ---- */
const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json().catch(() => null);
if (!version?.webSocketDebuggerUrl) {
  throw new Error(`no Chrome on :${PORT} — start one with --remote-debugging-port=${PORT}`);
}
const ws = new WebSocket(version.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}, sessionId) =>
  new Promise((res) => {
    const i = ++id;
    pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

// Our own tab, so a run does not navigate whatever the browser was showing.
const { result: target } = await send('Target.createTarget', { url: 'about:blank' });
const { result: attached } = await send('Target.attachToTarget', {
  targetId: target.targetId,
  flatten: true,
});
const sid = attached.sessionId;

await send('Page.enable', {}, sid);
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false }, sid);

let made = 0, skipped = 0, failed = 0;
for (const s of specimens) {
  const out = path.join(OUT_DIR, `${s.id}.png`);
  if (fs.existsSync(out) && !force) { skipped++; continue; }

  let art;
  try {
    if (s.origin === 'feed') {
      // Already sanitised by loadFeed, and it only ever exists in the repo —
      // there is nothing to fetch.
      art = s.svg;
    } else if (s.alive && fs.existsSync(path.join('public/live', `${s.id}.svg`))) {
      art = fs.readFileSync(path.join('public/live', `${s.id}.svg`), 'utf8');
    } else {
      const file = await localCopy(s);
      art = `<img src="file://${path.resolve(file)}">`;
    }
  } catch (err) {
    console.warn(`  ! ${s.id}: ${err.message}`);
    failed++;
    continue;
  }

  fs.writeFileSync(TMP, cardHtml(s, art));
  // The query string is a cache-buster: same path every time, and Chrome will
  // happily re-show the previous render without it.
  await send('Page.navigate', { url: `file://${TMP}?i=${made}` }, sid);
  await new Promise((r) => setTimeout(r, 650));

  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 },
  }, sid);
  if (!shot.result?.data) { console.warn(`  ! ${s.id}: screenshot failed`); failed++; continue; }

  fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
  made++;
  if (made % 10 === 0) console.log(`  ${made} cards…`);
}

await send('Target.closeTarget', { targetId: target.targetId });
ws.close();

const bytes = fs.readdirSync(OUT_DIR).reduce((n, f) => n + fs.statSync(path.join(OUT_DIR, f)).size, 0);
console.log(`${OUT_DIR}: ${made} made, ${skipped} already there, ${failed} failed — ${(bytes / 1048576).toFixed(1)} MB total`);
