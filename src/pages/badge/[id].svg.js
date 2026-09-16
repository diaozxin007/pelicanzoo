// /badge/<id>.svg — the papers a fed pelican gets once the critic has been
// round. Built as an endpoint rather than a committed file: the OG cards need a
// headless browser and so have to be made here and checked in, but this is
// string templating, and generating it every build means a re-scored pelican's
// badge updates everywhere it has been pasted without anyone touching a file.
//
// Drawn to be read as an <img> on somebody else's site, which rules out a great
// deal: no external stylesheet, no webfont, no CSS variables, and — the one
// that decides the whole layout — no external references at all. An <image>
// pointing at our own PNG would not load either. So the pelican on it is the
// specimen's own markup, nested inline.
//
// It is a card rather than a chip because the number is the least interesting
// thing the zoo has to say. A bare "68/100" is an assertion; the drawing and a
// line of the review are the evidence, and the review is where the voice is.
// The cost is that this will not sit in a README badge row beside shields.io —
// it is for the top of a post, not for a row of chips.
import { loadFeed } from '../../lib/feed.js';
import { bandOf } from '../../lib/scores.js';

// Exported because the copy-paste snippet on the specimen page has to put these
// same two numbers on its <img>, and a snippet whose dimensions have drifted
// from the file reflows somebody else's page when the card loads.
export const BADGE_W = 760;
export const BADGE_H = 210;

const W = BADGE_W;
const H = BADGE_H;

// The border is drawn inside the file rather than left to whoever embeds it. An
// <img> on somebody else's page arrives with no edge of its own, and a
// certificate is mostly frame — without one this reads as a strip of that
// page's own layout rather than as a thing issued by somewhere else.
const PAD = 14; // frame inset; the 2px stroke straddles this line
const IN_L = PAD + 1;
const IN_R = W - PAD - 1;
const IN_T = PAD + 1;

const RULE_Y = 156; // Divides the assessment from the colophon under it.
const THUMB = { x: 30, y: 24, w: 190, h: 124, r: 9 };
const SCORE_X = 228;
const SCORE_W = 124;
const TEXT_X = 382;
const TEXT_R = 722;
const TEXT_W = TEXT_R - TEXT_X;

const PAPER = '#fffdf8';
const PLAQUE = '#1e3a2b';
const RULE = '#ddd4c0';
const INK = '#22201b';
const MUTED = '#7a7265';

// Block behind the number, and the number on it. Same three bands as the .score
// block on the specimen page, so the badge never flatters a pelican the page
// has already been rude about. The figure on the green is cream rather than
// brass: gold on dark green is the frame's own pairing, and using it again on
// the one element that has to be read first made the number decorative.
const BANDS = {
  high: { block: PLAQUE, figure: '#f4efe3' },
  mid: { block: '#c8a64b', figure: INK },
  low: { block: '#8a3b2a', figure: '#f2ede1' },
};

const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,&quot;DejaVu Sans Mono&quot;,monospace';
const SERIF = 'Georgia,&quot;Times New Roman&quot;,serif';

// What every pelican in here was asked for. The drawing says it, but the
// drawing is small and some of them are barely legible as birds.
const TASK = 'pelican riding a bicycle';

// There is no house mark beside the wordmark, which is deliberate rather than
// unfinished. A bird drawn at 20px — and this card is routinely shown at half
// that — has four silhouettes available to it, and they were all tried: a whole
// pelican reads as a chess pawn, a head with the long beak hanging down reads as
// a spoon, a head over a shoulder reads as a hooded figure. The wordmark on its
// own survives every size, and the site has no logo anywhere else, so a mark
// that appears only here would promise a badge nobody sees on arrival.

const esc = (t) =>
  String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

/** A specimen is allowed to carry a <style> block — the sanitiser removes what
 *  is dangerous, not what is inconvenient — and CSS inside an SVG applies to
 *  the whole document, not to the subtree it was declared in. A submission
 *  containing `text { fill: #fff }` would therefore erase this card's writing,
 *  and `rect { fill: #fff }` would take the frame and the score block with it —
 *  a presentation attribute loses to any rule at all. An inline style with
 *  !important is the only thing that outranks it, so every mark we make here is
 *  set that way. */
const lock = (decls) =>
  `style="${Object.entries(decls).map(([k, v]) => `${k}:${v}!important`).join(';')}"`;

/** Monospace advance sits near 0.6em across Menlo, Consolas and DejaVu Sans
 *  Mono; 0.62 leaves a little room for whichever one the reader's machine
 *  actually has. Shrink to fit before truncating — the model name is the
 *  caption, and half a name says less than a small one. */
function fit(text, sizes, width, tracking = 0) {
  for (const size of sizes) {
    const per = size * 0.62 + tracking;
    if (text.length * per <= width) return { text, size };
    if (size === sizes[sizes.length - 1]) {
      const max = Math.max(4, Math.floor(width / per) - 1);
      return { text: `${text.slice(0, max)}…`, size };
    }
  }
}

/** Greedy wrap, in characters rather than pixels. Georgia's mixed-case advance
 *  averages near 0.5em and its fallback (DejaVu Serif, on the Linux boxes that
 *  render link previews) is a little wider, so the count is taken at 0.53 and
 *  runs short rather than long — a line that wraps early looks considered, a
 *  line that overruns the card looks broken. */
function wrap(text, maxChars, maxLines) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) return { lines, clipped: true };
  }
  if (line) lines.push(line);
  return { lines, clipped: false };
}

/** The critic writes two to four sentences. One of them is the badge's worth of
 *  it. Prefer the first sentence whole — it is the verdict, the rest is working
 *  — and set it smaller rather than cut it: a 17px line that ends where the
 *  critic stopped reads as a verdict, a 20px line ending in an ellipsis reads
 *  as a card that ran out of room. Only when even the smallest size will not
 *  take the sentence does it get cut, and then from the full review. */
function pullQuote(review, width, maxLines) {
  const first = (review.match(/^[\s\S]*?[.!?](?=\s|$)/) || [review])[0].trim();
  const chars = (size) => Math.floor(width / (size * 0.53));
  const SIZES = [20, 19, 18, 17];

  for (const size of SIZES) {
    const whole = wrap(first, chars(size), maxLines);
    if (!whole.clipped) return { lines: whole.lines, size };
  }

  const size = SIZES[SIZES.length - 1];
  const cut = wrap(review.trim(), chars(size), maxLines);
  const last = cut.lines.length - 1;
  cut.lines[last] = `${cut.lines[last].replace(/[,;:.\s]+$/, '')}…`;
  return { lines: cut.lines, size };
}

export function getStaticPaths() {
  // Only what has been assessed. An unscored pelican has no papers, and a badge
  // reading "—/100" would be worse than not offering one.
  return loadFeed()
    .filter((s) => typeof s.assessment?.score === 'number')
    .map((s) => ({ params: { id: s.id }, props: { s } }));
}

export function GET({ props }) {
  const { s } = props;
  const { score, review, critic } = s.assessment;
  const band = BANDS[bandOf(score)];

  // The specimen's own file, nested. The sanitiser guarantees a viewBox and
  // strips the root width/height, so these attributes go on unopposed and a
  // nested <svg> clips whatever hangs outside its box. `meet` letterboxes
  // rather than crops: a pelican with its wheels cut off is not the pelican
  // that was scored.
  //
  // The rounding is done by a <g> around it rather than by clip-path on the
  // nested <svg> itself, which looks like it should work and does not: a nested
  // svg establishes a new viewport, and the clip rect then gets read in the
  // specimen's coordinates instead of the card's — 190x124 out of a 800x500
  // drawing, i.e. a corner of the sky.
  const thumb = s.svg.replace(
    /^<svg/i,
    `<svg x="${THUMB.x}" y="${THUMB.y}" width="${THUMB.w}" height="${THUMB.h}" preserveAspectRatio="xMidYMid meet"`,
  );

  const quote = pullQuote(review, TEXT_W, 3);
  const lead = Math.round(quote.size * 1.1);
  // Centred on the block rather than hung from the rule under it. A full three
  // lines keeps the baselines it would have had either way; a one-line verdict
  // moves up instead of sitting at the bottom of an otherwise empty half-card.
  const firstLine = 75 - ((quote.lines.length - 1) * lead) / 2;
  const name = fit(s.model, [16, 15, 14, 13, 12], TEXT_W);
  // `@cf/openai/gpt-oss-120b` is a routing path, not a name. The name is the end of it.
  const criticName = String(critic || '').split('/').pop().toUpperCase();
  // Some feeders type "anonymous" into the handle field rather than leaving it
  // empty, and "fed by anonymous" reads like a person called Anonymous.
  const handle = String(s.by || '').trim();
  const credit = handle && !/^anon(ymous)?$/i.test(handle) ? `fed by ${handle}` : 'fed anonymously';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.model)} scored ${score} out of 100 for a ${TASK} at Pelican Zoo">
<title>${esc(s.model)} — ${score}/100 for a ${TASK}, at Pelican Zoo</title>
<desc>${esc(review)}</desc>
<clipPath id="zooThumb"><rect x="${THUMB.x}" y="${THUMB.y}" width="${THUMB.w}" height="${THUMB.h}" rx="${THUMB.r}"/></clipPath>
  <rect width="${W}" height="${H}" ${lock({ fill: PAPER })}/>
  <g clip-path="url(#zooThumb)">${thumb}</g>
  <rect x="${THUMB.x + 0.5}" y="${THUMB.y + 0.5}" width="${THUMB.w - 1}" height="${THUMB.h - 1}" rx="${THUMB.r - 0.5}" ${lock({ fill: 'none', stroke: PLAQUE, 'stroke-opacity': '.3' })}/>

  <rect x="${SCORE_X}" y="${IN_T}" width="${SCORE_W}" height="${RULE_Y - IN_T}" ${lock({ fill: band.block })}/>
  <text x="${SCORE_X + SCORE_W / 2}" y="88" ${lock({ fill: band.figure, 'font-family': SERIF, 'font-size': `${score >= 100 ? 46 : 54}px`, 'font-variant-numeric': 'lining-nums', 'text-anchor': 'middle' })}>${score}</text>
  <text x="${SCORE_X + SCORE_W / 2}" y="126" ${lock({ fill: band.figure, 'font-family': SERIF, 'font-size': '23px', 'font-variant-numeric': 'lining-nums', opacity: '.82', 'text-anchor': 'middle' })}>/100</text>
${quote.lines
  .map(
    (line, i) =>
      `  <text x="${TEXT_X}" y="${firstLine + i * lead}" ${lock({ fill: INK, 'font-family': SERIF, 'font-size': `${quote.size}px` })}>${esc(
        `${i === 0 ? '“' : ''}${line}${i === quote.lines.length - 1 ? '”' : ''}`,
      )}</text>`,
  )
  .join('\n')}
  <line x1="${TEXT_X}" y1="112" x2="${TEXT_R}" y2="112" ${lock({ stroke: RULE })}/>
  <text x="${TEXT_X}" y="132" ${lock({ fill: INK, 'font-family': MONO, 'font-size': `${name.size}px`, 'font-weight': '700' })}>${esc(name.text)}</text>
  <text x="${TEXT_X}" y="151" ${lock({ fill: MUTED, 'font-family': MONO, 'font-size': '12.5px' })}>${esc(credit)}</text>

  <line x1="${IN_L}" y1="${RULE_Y}" x2="${IN_R}" y2="${RULE_Y}" ${lock({ stroke: RULE })}/>
  <text x="${THUMB.x}" y="180" ${lock({ fill: PLAQUE, 'font-family': SERIF, 'font-size': '15px', 'font-weight': '700', 'letter-spacing': '1.6' })}>PELICAN ZOO</text>
  <text x="${SCORE_X}" y="180" ${lock({ fill: MUTED, 'font-family': MONO, 'font-size': '12px' })}>${TASK}</text>
  <text x="${TEXT_R}" y="180" ${lock({ fill: MUTED, 'font-family': MONO, 'font-size': '11px', 'letter-spacing': '1', 'text-anchor': 'end' })}>CRITIC: ${esc(criticName)}</text>

  <rect x="${PAD}" y="${PAD}" width="${W - PAD * 2}" height="${H - PAD * 2}" ${lock({ fill: 'none', stroke: PLAQUE, 'stroke-width': '2' })}/>
</svg>
`;

  return new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8' } });
}
