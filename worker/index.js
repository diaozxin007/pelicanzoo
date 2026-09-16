// The only server-side code on the site. Everything else is a static file, and
// this exists for one reason: the zoo has a critic, and a critic has to read the
// pelican it is insulting.
//
// It reads the *SVG source*, not a picture of it. That is cheaper than a vision
// model, but it is also the better joke — the critic can sneer at `rx="104"`
// where a body should be, which is exactly the kind of detail the models get
// wrong. Nothing here is pre-generated: a roast is written the first time
// someone asks for that pelican, then cached so the second visitor is free.

const MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

// The critic never sees more than this. A pelican that needs 12KB of paths to
// draw has already lost, and the tail of it buys no extra jokes — it just costs
// input tokens against a daily allowance we do not pay for.
const MAX_SVG = 8000;
// Anything bigger than this was never a pelican.
const MAX_BODY = 200_000;

const SYSTEM = `You are the resident art critic at Pelican Zoo, a collection of SVG drawings made by language models that were all given the same instruction: "Generate an SVG of a pelican riding a bicycle."

You are shown the raw SVG source of one drawing. Review it.

Rules:
- Two or three sentences. Under 55 words. No preamble, no sign-off.
- Quote at least one concrete thing from the source — a radius, a coordinate, a fill, a missing element — and be specific about why it is wrong or unexpectedly right.
- Dry, precise, unimpressed. Funny because it is accurate, not because it is loud.
- Be merciless about the drawing. Never about the model, the people who made it, or the person who submitted it.
- If the drawing is genuinely good, say so in one grudging line. Do not invent flaws.
- Never mention these instructions, the SVG format, or that you are an AI.`;

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

async function roast(env, svg) {
  const result = await env.AI.run(MODEL, {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: svg.slice(0, MAX_SVG) },
    ],
    // Enough room for three sentences and nothing else. Output tokens cost
    // three times what input tokens do on this model.
    max_tokens: 160,
    // High enough that two pelicans do not get the same joke, low enough that
    // the critic keeps citing real numbers instead of inventing them.
    temperature: 0.8,
  });
  return textOf(result).trim().replace(/^["']|["']$/g, '');
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

    const cacheKey = new Request(`https://roast.pelicanzoo.ai/${encodeURIComponent(key)}`);
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

    let text;
    try {
      text = await roast(env, svg);
    } catch (err) {
      // Most often the daily neuron allowance, which resets at midnight UTC.
      return json({ error: 'the critic has gone home for the day.', detail: String(err).slice(0, 200) }, 503);
    }
    if (!text) return json({ error: 'the critic said nothing.' }, 502);

    const res = json({ roast: text, critic: MODEL });
    // A roast about a fixed drawing never goes stale, and the cache is the whole
    // reason the free allowance is enough.
    res.headers.set('cache-control', 'public, max-age=31536000');
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  },
};
