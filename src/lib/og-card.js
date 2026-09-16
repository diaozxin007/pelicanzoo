// The share card, as markup. One 1200x630 layout, two renderers.
//
// This used to live inside scripts/make-og-specimens.mjs, where the only thing
// that could draw it was the Chrome on the keeper's desk. A fed pelican's card
// now gets drawn at the edge instead, the moment it is fed, which means two
// callers — and two copies of this HTML would mean a card that quietly stopped
// matching itself depending on who rendered it.
//
// Nothing here imports anything, so plain node can read it as easily as workerd.
export const CARD_W = 1200;
export const CARD_H = 630;

const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Long model names are the norm here (`qwen-3.8-27b-no-reasoning-pelican-2`),
// and shrinking to fit beats truncating: the name is the whole caption.
const nameSize = (n) => (n.length > 34 ? 30 : n.length > 26 ? 36 : n.length > 18 ? 44 : 54);

/** `art` is whatever goes in the picture frame — inline SVG for a vector or a
 *  fed drawing, an `<img>` for a raster specimen. The caller decides, because
 *  only the caller knows whether it has a filesystem. */
export function cardHtml(s, art) {
  return `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: ${CARD_W}px; height: ${CARD_H}px; background: #f2ede1; color: #22201b;
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
