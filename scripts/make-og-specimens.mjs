// Builds public/og/<id>.png — one 1200x630 share card per specimen, so a link
// to a single pelican previews as that pelican instead of the zoo's front gate.
//
// Rule carried over from make-og.mjs: the card is rendered from a local copy,
// never hotlinked. A share card is the image every crawler that ever sees the
// link will fetch, and that bill is ours. The local copies are the same ones
// the site serves, in public/specimen — put there by mirror-specimens.mjs.
//
// Rendering needs Chrome listening on --remote-debugging-port=9446. It opens
// its own tab and closes it again, so whatever you had open is left alone.
// Output is committed, because the Cloudflare build has no browser in it.
//
// Archival pelicans only. Fed ones used to be drawn here too, which meant a
// stranger's card did not exist until the keeper ran this and deployed; they are
// drawn at the edge now, when the pelican is fed, by src/lib/card-render.js and
// served out of KV by src/pages/og/[id].png.js. Simon's 103 stay here because
// they have not changed since the day they were scraped and a committed PNG is
// the cheapest possible way to serve one.
//
// The layout itself lives in src/lib/og-card.js, shared with the edge renderer,
// so the two cannot drift into drawing different cards.
//
// It also writes data/og-cards.json, the list of which archival pelicans have a
// card. The specimen page used to answer that with fs.existsSync while it was
// built ahead of time; it is rendered per request now and has no directory to
// look in, so the answer has to have been written down. One missing from the
// list falls back to the zoo's own card, which is the honest failure — the card
// is what every crawler fetches, and a 404 there is a link that previews as
// nothing.
//
//   node scripts/make-og-specimens.mjs [--only <id>] [--force]
import fs from 'node:fs';
import path from 'node:path';
import { cardHtml } from '../src/lib/og-card.js';

const PORT = 9446;
const OUT_DIR = 'public/og';
const MANIFEST = 'data/og-cards.json';
const MIRROR_DIR = 'public/specimen';
const TMP = '/tmp/og-specimen.html';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const force = args.includes('--force');

const specimens = JSON.parse(fs.readFileSync('data/specimens.json', 'utf8'))
  .filter((s) => s.model)
  .filter((s) => !only || s.id === only);

fs.mkdirSync(OUT_DIR, { recursive: true });

/** The picture-only specimens, read out of the mirror the site itself serves.
 *  Failing to find one is not fatal — that card is skipped and the page falls
 *  back to the zoo card. */
function localCopy(s) {
  const ext = (s.asset.match(/\.(png|jpe?g|gif|webp|svg)(?:\?|$)/i)?.[1] || 'png').toLowerCase();
  const file = path.join(MIRROR_DIR, `${s.id}.${ext}`);
  if (!fs.existsSync(file)) {
    throw new Error(`${file} is missing — run scripts/mirror-specimens.mjs first`);
  }
  return file;
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
    if (s.alive && fs.existsSync(path.join('public/live', `${s.id}.svg`))) {
      art = fs.readFileSync(path.join('public/live', `${s.id}.svg`), 'utf8');
    } else {
      const file = localCopy(s);
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

// Read off the directory, not off `specimens`, so a run narrowed by --only
// still writes the whole list instead of a list of one.
const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.png'));
const ids = files.map((f) => f.replace(/\.png$/, '')).sort();
fs.writeFileSync(MANIFEST, `${JSON.stringify(ids, null, 2)}\n`);

const bytes = files.reduce((n, f) => n + fs.statSync(path.join(OUT_DIR, f)).size, 0);
console.log(
  `${OUT_DIR}: ${made} made, ${skipped} already there, ${failed} failed — ` +
    `${(bytes / 1048576).toFixed(1)} MB total, ${ids.length} listed in ${MANIFEST}`,
);
