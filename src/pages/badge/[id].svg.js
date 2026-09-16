// /badge/<id>.svg — the papers a fed pelican gets once the critic has been
// round. Built as an endpoint rather than a committed file: the OG cards need a
// headless browser and so have to be made here and checked in, but a badge is
// string templating, and generating it every build means a re-scored pelican's
// badge updates everywhere it has been pasted without anyone touching a file.
//
// Drawn to be read as an <img> on somebody else's site, which rules out a great
// deal: no external stylesheet, no webfont, no CSS variables, nothing that
// needs a document around it. Only the generic families are safe.
import { loadFeed } from '../../lib/feed.js';
import { bandOf } from '../../lib/scores.js';

const W = 280;
const H = 60;
const SCORE_W = 84;
const PAD = 12;
const TEXT_X = SCORE_W + PAD;
const TEXT_W = W - TEXT_X - PAD;

// Block behind the number, and the number on it. Same three bands as the .score
// block on the specimen page, so the badge never flatters a pelican the page
// has already been rude about.
const BANDS = {
  high: { block: '#1e3a2b', figure: '#c8a64b' },
  mid: { block: '#c8a64b', figure: '#22201b' },
  low: { block: '#8a3b2a', figure: '#f2ede1' },
};

const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,&quot;DejaVu Sans Mono&quot;,monospace';

// The one thing every pelican in here was asked for, and the only line on the
// badge that makes the other two mean anything. Kept as Simon's wording rather
// than shortened: anyone who has seen the benchmark recognises the phrase, and
// anyone who has not now knows what the number is out of.
const TASK = 'pelican riding a bicycle';

const esc = (t) =>
  String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

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

export function getStaticPaths() {
  // Only what has been assessed. An unscored pelican has no papers, and a badge
  // reading "—/100" would be worse than not offering one.
  return loadFeed()
    .filter((s) => typeof s.assessment?.score === 'number')
    .map((s) => ({ params: { id: s.id }, props: { s } }));
}

export function GET({ props }) {
  const { s } = props;
  const { score } = s.assessment;
  const band = BANDS[bandOf(score)];

  // Three lines rather than two. This thing is read on somebody else's site by
  // people who have never heard of us: a number beside a model name is 68 out
  // of 100 at something unstated, and PELICAN ZOO alone reads as a brand rather
  // than as a test. The middle line says what was actually asked of the model,
  // which is both the joke and the context the other two lines need.
  //
  // Every y is an explicit baseline rather than a dominant-baseline, which is
  // unevenly supported by exactly the renderers a badge ends up in front of —
  // feed readers, image proxies, anything that is not a browser.
  const name = fit(s.model, [12, 11, 10, 9], TEXT_W);
  const task = fit(TASK, [9.5, 9, 8.5], TEXT_W);
  const credit = fit(s.by ? `PELICAN ZOO · fed by ${s.by}` : 'PELICAN ZOO', [8, 7.5], TEXT_W, 0.5);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.model)} scored ${score} out of 100 for a ${TASK} at Pelican Zoo">
<title>${esc(s.model)} — ${score}/100 for a ${TASK}, at Pelican Zoo</title>
<clipPath id="r"><rect width="${W}" height="${H}" rx="5"/></clipPath>
<g clip-path="url(#r)">
  <rect width="${W}" height="${H}" fill="#fffdf8"/>
  <rect width="${SCORE_W}" height="${H}" fill="${band.block}"/>
  <text x="${SCORE_W / 2}" y="33" fill="${band.figure}" text-anchor="middle" font-family="${MONO}" font-size="27" font-weight="700">${score}</text>
  <text x="${SCORE_W / 2}" y="46" fill="${band.figure}" text-anchor="middle" font-family="${MONO}" font-size="10" opacity=".7">/100</text>
  <text x="${TEXT_X}" y="20" fill="#22201b" font-family="${MONO}" font-size="${name.size}" font-weight="700">${esc(name.text)}</text>
  <text x="${TEXT_X}" y="33" fill="#4a4437" font-family="${MONO}" font-size="${task.size}">${esc(task.text)}</text>
  <text x="${TEXT_X}" y="46" fill="#7a7265" font-family="${MONO}" font-size="${credit.size}" letter-spacing=".5">${esc(credit.text)}</text>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="4.5" fill="none" stroke="#ddd4c0"/>
</svg>
`;

  return new Response(svg, { headers: { 'content-type': 'image/svg+xml; charset=utf-8' } });
}
