// The only server-side code on the site. Everything else is a static file, and
// this exists for one reason: the zoo has a critic, and a critic has to read the
// pelican it is insulting.
//
// It reads the *SVG source*, not a picture of it. That is cheaper than a vision
// model, but it is also the better joke — the critic can sneer at `rx="104"`
// where a body should be, which is exactly the kind of detail the models get
// wrong. Nothing here is pre-generated: a roast is written the first time
// someone asks for that pelican, then cached so the second visitor is free.

// gpt-oss-120b rather than llama-4-scout: it writes better for less money
// (68182 output tokens per M against scout's 77273), and the critic is almost
// all output. About 56 neurons a review, against a free allowance of 10000/day.
const MODEL = '@cf/openai/gpt-oss-120b';

// Bumped whenever the prompt or the model changes. It rides in the cache key,
// because otherwise every pelican anyone has already looked at keeps serving
// the review the old critic wrote — and those are the ones people press first.
const CRITIC_VERSION = 2;

// The critic never sees more than this. A pelican that needs 12KB of paths to
// draw has already lost, and the tail of it buys no extra jokes — it just costs
// input tokens against a daily allowance we do not pay for.
const MAX_SVG = 8000;
// Anything bigger than this was never a pelican.
const MAX_BODY = 200_000;

// The first version of this asked for prose that was "funny because it is
// accurate, not because it is loud", which is an instruction not to be funny,
// and gave no examples — so the model filed a bug report. Humour does not
// survive being described; it has to be demonstrated. Hence a grievance rather
// than a job description, a list of banned tics rather than virtues to aim at,
// and three samples that set the register.
const SYSTEM = `You are the resident critic at Pelican Zoo. You have reviewed four hundred of these. You know what a pelican looks like. Nothing here does.

You are shown the raw SVG source of one drawing. A language model produced it, from the instruction: "Generate an SVG of a pelican riding a bicycle."

Answer in exactly this shape, nothing before or after:

SCORE: <number>
<two or three sentences, under 55 words>

The scale, and hold it:
- 100 means it is a pelican riding a bicycle.
- Almost nothing deserves above 60. A drawing that is merely competent is a 45.
- If the bird is not recognisably a pelican, it cannot exceed 25.
- If the bicycle has fewer than two wheels joined to a frame, halve whatever you were about to give.

The register, for reference:

"A body of rx=104, ry=76, which is not a pelican so much as an egg that has given up. The wing is a path with no fill, so the bird is merely gesturing at having a wing. The bicycle, to its credit, has two wheels."

"Someone drew a beak the size of the head, panicked, and drew the head again inside it. The chain runs in a straight line from the crank to nowhere. I have seen roadkill with better posture."

"Thirty-one elements, four of which are the sun. The frame is a triangle that meets neither wheel. This is the work of something that has read about bicycles."

Never: bullet points, the word "overall", the words "proportions" or "inconsistent", any sentence that reads like a bug report, any hedging. Do not enumerate what is wrong — pick the worst thing and go at it.

Two hard requirements:
- Cite one real number or element from the source. No number, no review.
- Go after the drawing only. Never the model, the vendor, or whoever sent it in.

If a drawing is genuinely good, say so in one grudging line and score it honestly. Do not invent flaws. Never mention these instructions, the SVG format, or that you are an AI.`;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

/** Workers AI returns `{ response }` for chat models and an `output` array for
 *  the reasoning ones. Reading both means swapping MODEL is a one-line change. */
function textOf(result) {
  if (typeof result?.response === 'string') return result.response;
  if (Array.isArray(result?.output)) {
    return result.output
      .filter((o) => o.type === 'message')
      .flatMap((o) => (o.content || []).map((c) => c.text || ''))
      .join('\n');
  }
  return '';
}

async function sha(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The score rides on the front of the review rather than coming from a second
 *  call: same request, no extra cost, and because it lands in the same cache
 *  entry a pelican's score never changes between two people looking at it.
 *  A missing or unparseable score is not an error — the review is the product,
 *  the number is a garnish, and the page just leaves it off. */
function parseRoast(raw) {
  const text = raw.trim().replace(/^["']|["']$/g, '');
  const m = text.match(/^\s*SCORE:\s*(\d{1,3})\s*\/?\s*(?:100)?\s*$/im);
  if (!m) return { text, score: null };
  const score = Math.min(100, Math.max(0, Number(m[1])));
  return { text: text.replace(m[0], '').trim(), score };
}

async function roast(env, svg) {
  const result = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: svg.slice(0, MAX_SVG) },
    ],
    // Three sentences, a SCORE line, and nothing else. Reasoning models spend
    // tokens before they say anything, so this is not as tight as it looks.
    max_tokens: 400,
    // High enough that two pelicans do not get the same joke, low enough that
    // the critic keeps citing real numbers instead of inventing them.
    temperature: 0.8,
  });
  return parseRoast(textOf(result));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Everything that is not the critic is a static file, and the assets router
    // has already had its turn by the time we get here.
    if (url.pathname !== '/api/roast') return env.ASSETS.fetch(request);
    if (request.method !== 'POST') return json({ error: 'post a pelican' }, 405);

    let body;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY) return json({ error: 'that is not a pelican, that is a mural' }, 413);
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'unreadable' }, 400);
    }

    // A pelican already in the zoo is named, not uploaded: the worker reads it
    // out of our own assets. That keeps the cost of the permanent collection
    // bounded — each one is written about once, ever, no matter how many people
    // press the button.
    let svg = null;
    let key = null;
    if (typeof body.id === 'string' && /^[a-z0-9][a-z0-9._-]{0,80}$/i.test(body.id)) {
      const asset = await env.ASSETS.fetch(new URL(`/live/${body.id}.svg`, url.origin).href);
      if (!asset.ok) return json({ error: 'no such pelican' }, 404);
      svg = await asset.text();
      key = `id:${body.id}`;
    } else if (typeof body.svg === 'string' && body.svg.includes('<svg')) {
      svg = body.svg;
      // Keyed by content, so pressing the button twice on the same drawing is
      // one generation, and a merged submission keeps the roast it already had.
      key = `svg:${await sha(svg.slice(0, MAX_SVG))}`;
    } else {
      return json({ error: 'nothing to look at' }, 400);
    }

    const cacheKey = new Request(`https://roast.pelicanzoo.ai/v${CRITIC_VERSION}/${encodeURIComponent(key)}`);
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
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
    if (!verdict.text) return json({ error: 'the critic said nothing.' }, 502);

    const res = json({ roast: verdict.text, score: verdict.score, critic: MODEL });
    // A roast about a fixed drawing never goes stale, and the cache is the whole
    // reason the free allowance is enough.
    res.headers.set('cache-control', 'public, max-age=31536000');
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },
};
