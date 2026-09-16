// Builds public/og.png — the card that shows up when someone shares the zoo.
//
// The image is composed from our own sanitized SVGs in public/live, never
// hotlinked from Simon's server: a share card is the one image that gets
// fetched by every crawler that sees the link, and that bandwidth is not ours
// to spend. Rendering is done here with headless Chrome rather than at build
// time, so the Cloudflare build stays a plain `astro build` with no browser in
// it. Re-run `npm run og` after the strip below changes.
import fs from 'node:fs';
import path from 'node:path';

const PORT = 9446;
const OUT = 'public/og.png';

// Oldest to newest, left to right. That ordering is the whole joke, so the
// picks are spread across the two years rather than chosen for being pretty.
const STRIP = [
  { id: 'cerebras-llama3.1-8b', model: 'llama-3.1-8b', when: 'Oct 2024' },
  { id: 'qwen-pelican', model: 'qwen', when: 'Nov 2024' },
  { id: 'phi4-pelican', model: 'phi-4', when: 'Jan 2025' },
  { id: 'gemini-2.5-flash-preview-05-20-animated', model: 'gemini-2.5-flash', when: 'May 2025' },
  { id: 'glm-5.2-pelican', model: 'glm-5.2', when: 'Jun 2026' },
];

const cells = STRIP.map(({ id, model, when }) => {
  const svg = fs.readFileSync(path.join('public/live', id + '.svg'), 'utf8');
  return `<figure><div class="cell">${svg}</div>
    <figcaption>${model}<span>${when}</span></figcaption></figure>`;
}).join('');

const html = `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; background: #f2ede1; color: #22201b;
    font: 16px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif;
    padding: 54px 60px 46px; display: flex; flex-direction: column;
  }
  h1 { font: 700 76px/1 Georgia, serif; letter-spacing: .06em; }
  .tag { margin-top: 18px; font-size: 27px; color: #4a453c; }
  .tag em { color: #1e3a2b; font-style: italic; }
  .strip { margin-top: auto; display: grid; grid-template-columns: repeat(5, 1fr); gap: 18px; }
  figure { display: flex; flex-direction: column; gap: 9px; }
  .cell {
    position: relative; aspect-ratio: 1; background: #fff;
    border: 1px solid #ddd4c0; border-radius: 4px; overflow: hidden;
  }
  /* Same trap as the site: aspect-ratio leaves a child's percentage height
     indefinite, so the pelican has to be pinned to a definite box instead. */
  .cell svg { position: absolute; inset: 0; margin: auto; max-width: 100%; max-height: 100%; }
  /* Stacked, not side by side: the longest model name needs the full cell
     width, and truncating the name is the one thing the caption is there for. */
  figcaption { display: grid; gap: 4px; font: 700 15px/1.15 ui-monospace, "SF Mono", monospace; }
  figcaption span { font-weight: 500; color: #7a7265; }
  .foot { margin-top: 26px; display: flex; justify-content: space-between;
    align-items: baseline; border-top: 2px solid #c8a64b; padding-top: 14px;
    font-size: 19px; color: #7a7265; }
  .foot b { color: #1e3a2b; font: 700 21px/1 ui-monospace, monospace; letter-spacing: .04em; }
</style>
<h1>PELICAN&nbsp;ZOO</h1>
<p class="tag">Every language model, asked the same thing:<br><em>&ldquo;Generate an SVG of a pelican riding a bicycle.&rdquo;</em></p>
<div class="strip">${cells}</div>
<div class="foot"><span>Simon Willison&rsquo;s benchmark, kept as an enclosure &mdash; and a guessing game</span><b>pelicanzoo.ai</b></div>`;

fs.writeFileSync('/tmp/og-source.html', html);

const page = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page');
if (!page) throw new Error(`no debuggable page on :${PORT} — start Chrome with --remote-debugging-port=${PORT}`);
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) =>
  new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable');
// deviceScaleFactor 2: the card is downscaled in most timelines, and the model
// names in the captions go to mush at 1x.
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: 'file:///tmp/og-source.html' });
await new Promise((r) => setTimeout(r, 2500));
const shot = await send('Page.captureScreenshot', {
  format: 'png',
  // scale stays 1 — deviceScaleFactor already doubles it, and the two multiply.
  clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 },
});
if (!shot.result) throw new Error('screenshot failed: ' + JSON.stringify(shot).slice(0, 300));
fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'));
await send('Emulation.clearDeviceMetricsOverride');
ws.close();
console.log(`${OUT} — ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
