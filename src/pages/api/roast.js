// POST /api/roast — summon the critic for one pelican.
//
// Public, and always has been. That matters for how the feed pen is judged: a
// score shown to a feeder the moment they submit is not a slot machine, because
// anyone could already re-roll a drawing here as many times as they liked.
import { loadZoo } from '../../lib/zoo.js';
import { findFed } from '../../lib/feed.js';
import { MODEL, CRITIC_VERSION, MAX_SVG, json, sha, roast } from '../../lib/critic.js';

// Anything bigger than this was never a pelican.
const MAX_BODY = 200_000;

export async function GET() {
  return json({ error: 'post a pelican' }, 405);
}

export async function POST({ request, locals }) {
  const env = locals.runtime?.env;
  const ctx = locals.runtime?.ctx;

  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'that is not a pelican, that is a mural' }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'unreadable' }, 400);
  }

  // A pelican already in the zoo is named, not uploaded, and the server reads it
  // for itself. That keeps the cost of the collection bounded — each one is
  // written about once, ever, no matter how many people press the button — and
  // it means an id from a browser is never trusted to be anything.
  let svg = null;
  let key = null;
  if (typeof body.id === 'string' && /^[a-z0-9][a-z0-9._-]{0,80}$/i.test(body.id)) {
    const wild = loadZoo().all.find((x) => x.id === body.id && x.svg);
    const s = wild || (await findFed(env, body.id));
    if (!s?.svg) return json({ error: 'no such pelican' }, 404);
    svg = s.svg;
    key = `id:${body.id}`;
  } else if (typeof body.svg === 'string' && body.svg.includes('<svg')) {
    svg = body.svg;
    // Keyed by content, so pressing the button twice on the same drawing is
    // one generation, and the same drawing fed twice keeps the roast it had.
    key = `svg:${await sha(svg.slice(0, MAX_SVG))}`;
  } else {
    return json({ error: 'nothing to look at' }, 400);
  }

  const cacheKey = new Request(
    `https://roast.pelicanzoo.ai/v${CRITIC_VERSION}/${encodeURIComponent(key)}`,
  );
  const cache = locals.runtime?.caches?.default;
  const hit = await cache?.match(cacheKey);
  if (hit) return hit;

  // Only the uncached path can cost anything, so that is the only path worth
  // rate limiting. Per-IP is discouraged in the docs because offices share
  // addresses — but this is an anonymous toy with nothing else to key on, and
  // six new pelicans a minute is well past enthusiasm.
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const { success } = await env.ROAST_LIMIT.limit({ key: ip });
  if (!success) return json({ error: 'the critic is having a cigarette. try in a minute.' }, 429);

  let verdict;
  try {
    verdict = await roast(env, svg);
  } catch (err) {
    // Most often the daily neuron allowance, which resets at midnight UTC.
    return json({ error: 'the critic has gone home for the day.', detail: String(err).slice(0, 200) }, 503);
  }
  // The shape only rides along when there is nothing to show. Workers AI does
  // not document what this model returns, and an empty review is otherwise
  // indistinguishable from a review that came back in a field we do not read.
  if (!verdict.text) {
    return json({ error: 'the critic said nothing.', detail: JSON.stringify(verdict.shape).slice(0, 600) }, 502);
  }

  // `version` rides along because a filed score is only as good as the critic
  // that gave it. Without it there is no way to tell which records a prompt
  // change has invalidated.
  const res = json({ roast: verdict.text, score: verdict.score, critic: MODEL, version: CRITIC_VERSION });
  // A roast about a fixed drawing never goes stale, and the cache is the whole
  // reason the free allowance is enough.
  res.headers.set('cache-control', 'public, max-age=31536000');
  if (cache && ctx) ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
