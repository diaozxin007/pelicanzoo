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
const FOOT_Y = 170; // The dark strip. Everything above it is the assessment.
const THUMB_W = 210;
const SCORE_X = THUMB_W;
const SCORE_W = 110;
const TEXT_X = SCORE_X + SCORE_W + 26;
const TEXT_R = W - 26;
const TEXT_W = TEXT_R - TEXT_X;

// Block behind the number, and the number on it. Same three bands as the .score
// block on the specimen page, so the badge never flatters a pelican the page
// has already been rude about.
const BANDS = {
  high: { block: '#1e3a2b', figure: '#c8a64b' },
  mid: { block: '#c8a64b', figure: '#22201b' },
  low: { block: '#8a3b2a', figure: '#f2ede1' },
};

const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,&quot;DejaVu Sans Mono&quot;,monospace';
const SERIF = 'Georgia,&quot;Times New Roman&quot;,serif';

// What every pelican in here was asked for. The drawing says it, but the
// drawing is small and some of them are barely legible as birds.
const TASK = 'pelican riding a bicycle';

// There is no house mark in the footer, which is deliberate rather than
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
 *  containing `text { fill: #fff }` would therefore erase this card's writing.
 *  An inline style with !important is the only thing that outranks it, so every
 *  line of our own type is set that way rather than with presentation
 *  attributes. */
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
 *  — and only fall back to a cut of the full review when that first sentence is
 *  itself too long to sit on the card. */
function pullQuote(review, maxChars, maxLines) {
  const first = (review.match(/^[\s\S]*?[.!?](?=\s|$)/) || [review])[0].trim();
  const whole = wrap(first, maxChars, maxLines);
  if (!whole.clipped) return whole.lines;

  const cut = wrap(review.trim(), maxChars, maxLines);
  const last = cut.lines.length - 1;
  cut.lines[last] = `${cut.lines[last].replace(/[,;:.\s]+$/, '')}…`;
  return cut.lines;
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
  // strips the root width/height, so these four attributes go on unopposed and
  // a nested <svg> clips whatever hangs outside its box. `meet` letterboxes
  // rather than crops: a pelican with its wheels cut off is not the pelican
  // that was scored.
  const thumb = s.svg.replace(
    /^<svg/i,
    '<svg x="16" y="16" width="178" height="138" preserveAspectRatio="xMidYMid meet"',
  );

  const quote = pullQuote(review, Math.floor(TEXT_W / (20 * 0.53)), 3);
  // Centred in the band above the rule rather than hung from it. A full three
  // lines keeps the baselines it would have had either way; a one-line verdict
  // moves up instead of sitting at the bottom of an otherwise empty half-card.
  const firstLine = 100 - (3 - quote.length) * 12 - (quote.length - 1) * 26;
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
<clipPath id="zooCard"><rect width="${W}" height="${H}" rx="8"/></clipPath>
<g clip-path="url(#zooCard)">
  <rect width="${W}" height="${H}" fill="#fffdf8"/>
  <rect width="${THUMB_W}" height="${FOOT_Y}" fill="#f2ede1"/>
  ${thumb}
  <rect x="${SCORE_X}" width="${SCORE_W}" height="${FOOT_Y}" fill="${band.block}"/>
  <text x="${SCORE_X + SCORE_W / 2}" y="90" ${lock({ fill: band.figure, 'font-family': MONO, 'font-size': `${score >= 100 ? 42 : 54}px`, 'font-weight': '700', 'text-anchor': 'middle' })}>${score}</text>
  <text x="${SCORE_X + SCORE_W / 2}" y="119" ${lock({ fill: band.figure, 'font-family': MONO, 'font-size': '20px', opacity: '.7', 'text-anchor': 'middle' })}>/100</text>
${quote
  .map(
    (line, i) =>
      `  <text x="${TEXT_X}" y="${firstLine + i * 26}" ${lock({ fill: '#22201b', 'font-family': SERIF, 'font-size': '20px' })}>${esc(
        `${i === 0 ? '“' : ''}${line}${i === quote.length - 1 ? '”' : ''}`,
      )}</text>`,
  )
  .join('\n')}
  <line x1="${TEXT_X}" y1="116" x2="${TEXT_R}" y2="116" stroke="#ddd4c0"/>
  <text x="${TEXT_X}" y="140" ${lock({ fill: '#22201b', 'font-family': MONO, 'font-size': `${name.size}px`, 'font-weight': '700' })}>${esc(name.text)}</text>
  <text x="${TEXT_X}" y="160" ${lock({ fill: '#7a7265', 'font-family': MONO, 'font-size': '12.5px' })}>${esc(credit)}</text>

  <rect y="${FOOT_Y}" width="${W}" height="${H - FOOT_Y}" fill="#1e3a2b"/>
  <text x="26" y="195" ${lock({ fill: '#c8a64b', 'font-family': MONO, 'font-size': '14px', 'font-weight': '700', 'letter-spacing': '3' })}>PELICAN ZOO</text>
  <line x1="176" y1="180" x2="176" y2="200" stroke="#3d5a4a"/>
  <text x="194" y="195" ${lock({ fill: '#8fa295', 'font-family': MONO, 'font-size': '12px' })}>${TASK}</text>
  <text x="${TEXT_R}" y="195" ${lock({ fill: '#8fa295', 'font-family': MONO, 'font-size': '11px', 'letter-spacing': '1', 'text-anchor': 'end' })}>CRITIC: ${esc(criticName)}</text>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="7.5" fill="none" stroke="#ddd4c0"/>
</svg>
`;

  return new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8' } });
}
