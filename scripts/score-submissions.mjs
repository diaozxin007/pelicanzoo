// Puts a fed pelican in front of the zoo's critic and files the verdict in
// data/scores.json, which is what the badge at /badge/<id>.svg is minted from.
//
// The score has to live in git rather than in the browser. Before this, a score
// existed only for as long as the tab was open — computed on click, held in an
// evictable edge cache, and free to come back different. That is fine for a
// number you look at once and fine for nothing else; a badge someone hangs on
// their own site has to still say the same thing next month.
//
// It is also why this is a maintainer's script and not something the submit
// form does. A score the submitter can re-roll until they like it is not an
// assessment, it is a slot machine. The zoo scores the pelican, once, here.
//
// It calls the live endpoint rather than Workers AI directly: same prompt, same
// model, same cache. A visitor who summons the critic on this pelican hits the
// cache entry this run created, so the page and the badge agree by construction.
//
//   node scripts/score-submissions.mjs [--only <id>] [--force] [--endpoint <url>]
import fs from 'node:fs';
import { loadFeed } from '../src/lib/feed.js';
import { SCORES_FILE } from '../src/lib/scores.js';

const DEFAULT_ENDPOINT = 'https://pelicanzoo.ai/api/roast';
// ROAST_LIMIT in wrangler.jsonc is 6 per 60s per IP, and a cache miss is the
// only thing it counts. Ten seconds plus change keeps a long run under it
// without having to think about which of these are already cached.
const GAP_MS = 11_000;

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const force = args.includes('--force');
const endpoint = args.includes('--endpoint') ? args[args.indexOf('--endpoint') + 1] : DEFAULT_ENDPOINT;

const scores = fs.existsSync(SCORES_FILE) ? JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8')) : {};
const feed = loadFeed().filter((s) => !only || s.id === only);

/** What the critic is running right now, learned from the first reply rather
 *  than hardcoded here — two copies of that number would drift. */
let currentVersion = null;

/** A filed score is stale if the critic has been rewritten since. Until the
 *  first reply comes back we have nothing to compare against, so anything
 *  already on file is left alone. */
const isCurrent = (rec) =>
  rec && typeof rec.score === 'number' && (currentVersion === null || rec.criticVersion === currentVersion);

let assessed = 0;
let kept = 0;
let refused = 0;
let failed = 0;
let calls = 0;

for (const s of feed) {
  if (!force && isCurrent(scores[s.id])) {
    kept++;
    continue;
  }

  // Spaced out only between actual requests, so a run that is mostly re-filing
  // already-scored pelicans does not sit there sleeping for no reason.
  if (calls++) await new Promise((r) => setTimeout(r, GAP_MS));

  let data;
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // The same sanitised string the site builds its pages from, so the cache
      // key is the same one a visitor's browser produces.
      body: JSON.stringify({ svg: s.svg }),
    });
    data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  } catch (err) {
    console.error(`  ! ${s.id}: ${err.message}`);
    failed++;
    continue;
  }

  if (typeof data.version === 'number') currentVersion = data.version;

  // The critic is allowed to review without scoring — parseRoast returns a null
  // score when the SCORE: line never came. No number, no file, no badge. An
  // invented one would be worse than none.
  if (typeof data.score !== 'number') {
    console.warn(`  ? ${s.id}: reviewed but not scored — left unfiled`);
    refused++;
    continue;
  }

  scores[s.id] = {
    score: data.score,
    review: data.roast,
    critic: data.critic,
    criticVersion: data.version ?? null,
    assessed: new Date().toISOString().slice(0, 10),
  };
  assessed++;
  console.log(`  ${s.id}: ${data.score}/100`);
}

// Sorted so a re-run of an unchanged zoo produces a byte-identical file and the
// diff shows only what actually moved.
const sorted = Object.fromEntries(Object.keys(scores).sort().map((k) => [k, scores[k]]));
fs.writeFileSync(SCORES_FILE, `${JSON.stringify(sorted, null, 2)}\n`);

console.log(
  `${feed.length} fed specimen(s): ${assessed} assessed, ${kept} already on file, ` +
    `${refused} reviewed without a score, ${failed} failed. ` +
    `${Object.keys(sorted).length} record(s) in ${SCORES_FILE.split('/').slice(-2).join('/')}.`
);
