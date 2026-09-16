// /pin/<id>.png — the papers as an object.
//
// /badge/<id>.svg is drawn fresh on every request, because it is vector and
// costs nothing. This one is a photograph made by an image model out of that
// SVG, it takes the better part of a minute, and it is metered by the week — so
// it is made once and filed forever.
//
// Two answers only, and deliberately no third:
//
//   filed     — read from KV, which is where every request after the first one
//               lands. Immutable: the pin is a photograph of a moment, and a
//               re-score is a reason for a new vector badge, not a new
//               photograph.
//   drawn now — the first request. Somebody is watching a blank tab for forty
//               seconds, which is the honest cost of the thing they asked for.
//
// /og/<id>.png falls back to the zoo's own card when it cannot draw, because a
// share card is fetched by crawlers and a 404 there is a link that previews as
// nothing. Nobody previews this URL. A 404 is the truthful answer, and it is
// also the one that keeps a failed attempt from being cached as the pelican's
// permanent face.
import { findFed } from '../../lib/feed.js';
import { renderBadge } from '../../lib/badge.js';
import { renderPin, pinKey } from '../../lib/pin-render.js';

const FILED = 'public, max-age=31536000, immutable';

export async function GET({ params, locals }) {
  const env = locals.runtime?.env;
  const id = params.id;

  const filed = await env?.CARDS?.get(pinKey(id), 'arrayBuffer');
  if (filed) {
    return new Response(filed, {
      headers: { 'content-type': 'image/png', 'cache-control': FILED },
    });
  }

  // Without the key this route is inert and the page never links to it, so
  // reaching here by hand gets the same answer as asking for a pelican that is
  // not in the book.
  if (!env?.DASHSCOPE_API_KEY) return new Response('no pin', { status: 404 });

  const s = await findFed(env, id);
  if (!s || typeof s.assessment?.score !== 'number') {
    return new Response('no papers for that one', { status: 404 });
  }

  // The same renderer the SVG endpoint uses, so the pin is a photograph of the
  // badge that is actually on the page rather than of a second badge that
  // happens to look like it.
  const svg = renderBadge({
    model: s.model,
    by: s.by,
    svg: s.svg,
    score: s.assessment.score,
    review: s.assessment.review,
    critic: s.assessment.critic,
  });

  const png = await renderPin(env, s, svg);
  if (!png) return new Response('could not mint that one', { status: 503 });

  return new Response(png, {
    headers: { 'content-type': 'image/png', 'cache-control': FILED },
  });
}
