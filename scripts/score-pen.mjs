// Puts a fed pelican in front of the zoo's critic again and writes the verdict
// back into its row, which is where the page and the badge both read it from.
//
// Almost nothing needs this any more. A pelican is scored the moment it is fed —
// POST /api/feed writes the row, the critic runs behind the response, and the
// number is in the book about thirteen seconds later. What is left for this
// script is the one case the edge cannot do for itself: CRITIC_VERSION got
// bumped and everything already in the book was judged by the old critic.
//
// It is still a maintainer's script and not a button on the site, for the reason
// it always was. A score the submitter can re-roll until they like it is not an
// assessment, it is a slot machine. The zoo scores the pelican; the feeder does
// not get to ask twice.
//
// It calls the live endpoint rather than Workers AI directly: same prompt, same
// model, same cache. A visitor who summons the critic on this pelican hits the
// cache entry this run created, so the page and the badge agree by construction.
//
//   node scripts/score-pen.mjs [--only <id>] [--force] [--endpoint <url>]
import { d1 } from './lib/cf.js';
import { pen } from './lib/pen.js';

const DEFAULT_ENDPOINT = 'https://pelicanzoo.ai/api/roast';
// ROAST_LIMIT in wrangler.jsonc is 6 per 60s per IP, and a cache miss is the
// only thing it counts. Ten seconds plus change keeps a long run under it
// without having to think about which of these are already cached.
const GAP_MS = 11_000;

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const force = args.includes('--force');
const endpoint = args.includes('--endpoint') ? args[args.indexOf('--endpoint') + 1] : DEFAULT_ENDPOINT;

// Only what is on the wall, --only included. /api/roast resolves an id through
// findFed(), which serves live rows and nothing else — correctly, since it is a
// public endpoint — so a pending pelican cannot be scored this way and does not
// need to be: it will be scored on its way in if it is ever let through.
const live = await pen();
const feed = only ? live.filter((s) => s.id === only) : live;
if (only && !feed.length) {
  console.error(`no live row with id ${only} — \`npm run intake -- --list\` shows what is waiting`);
  process.exit(1);
}

/** What the critic is running right now, learned from the first reply rather
 *  than hardcoded here — two copies of that number would drift. */
let currentVersion = null;

/** A filed score is stale if the critic has been rewritten since. Until the
 *  first reply comes back we have nothing to compare against, so anything
 *  already in the book is left alone. */
const isCurrent = (a) =>
  a && typeof a.score === 'number' && (currentVersion === null || a.criticVersion === currentVersion);

let assessed = 0;
let kept = 0;
let refused = 0;
let failed = 0;
let calls = 0;

for (const s of feed) {
  if (!force && isCurrent(s.assessment)) {
    kept++;
    continue;
  }

  // Spaced out only between actual requests, so a run that is mostly walking
  // past already-scored pelicans does not sit there sleeping for no reason.
  if (calls++) await new Promise((r) => setTimeout(r, GAP_MS));

  let data;
  try {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // By id rather than by svg: the endpoint looks the row up itself, so the
      // bytes it judges are the bytes in the book with no chance of this script
      // having sent it something else.
      body: JSON.stringify({ id: s.id }),
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
  // score when the SCORE: line never came. No number, nothing written, no badge.
  // An invented one would be worse than none, and overwriting a good old score
  // with a blank would be worse than both.
  if (typeof data.score !== 'number') {
    console.warn(`  ? ${s.id}: reviewed but not scored — row left as it was`);
    refused++;
    continue;
  }

  await d1(
    `update feed set score = ?, review = ?, critic = ?, critic_version = ?, assessed = ?
      where id = ?`,
    [
      data.score,
      data.roast ?? null,
      data.critic ?? null,
      data.version ?? null,
      new Date().toISOString().slice(0, 10),
      s.id,
    ],
  );
  assessed++;
  const was = s.assessment?.score;
  console.log(`  ${s.id}: ${data.score}/100${typeof was === 'number' && was !== data.score ? ` (was ${was})` : ''}`);
}

console.log(
  `${feed.length} fed pelican(s): ${assessed} re-assessed, ${kept} already current, ` +
    `${refused} reviewed without a score, ${failed} failed. The book is the record — ` +
    `nothing to deploy.`,
);
