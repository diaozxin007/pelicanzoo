// /og/<id>.png — a fed pelican's share card.
//
// Only fed pelicans reach this route. The 103 archival cards are committed PNGs
// under public/og, and Workers Assets answers those before the Worker is even
// woken; a request only arrives here when there is no file with that name, which
// is exactly the case of a pelican somebody handed over the fence.
//
// Three answers, in order of how much work they cost:
//
//   filed      — the usual one. Drawn when the pelican was fed, read from KV.
//   drawn now  — nothing filed, so draw it and file it. Covers a card the feed
//                endpoint failed to make, one admitted through a shut gate long
//                after the fact, and the minute KV takes to reach every colo.
//   the zoo's  — drawing failed too, most likely the day's ten minutes of
//                browser being spent. Short cache, so whoever cached it comes
//                back for the real one.
//
// The point of the fallback is that this URL is never wrong to publish. The page
// can name it the moment the row exists, which is what lets the card stop being
// something the keeper has to remember to make.
import { findFed } from '../../lib/feed.js';
import { renderCard, cardKey } from '../../lib/card-render.js';

const FILED = 'public, max-age=31536000, immutable';
// A minute. Long enough that a crawler retrying immediately does not draw a
// second card, short enough that the generic one does not become the pelican's
// permanent face.
const PLACEHOLDER = 'public, max-age=60';

const png = (body, cache) =>
  new Response(body, {
    headers: { 'content-type': 'image/png', 'cache-control': cache },
  });

export async function GET({ params, locals, request }) {
  const env = locals.runtime?.env;
  const id = params.id;

  const filed = await env?.CARDS?.get(cardKey(id), 'arrayBuffer');
  if (filed) return png(filed, FILED);

  // findFed serves live rows only, which is the right gate: a card is a public
  // preview of a public page, and a pending pelican has neither.
  const s = await findFed(env, id);
  if (s) {
    const drawn = await renderCard(env, s);
    if (drawn) return png(drawn, FILED);
  }

  // Not a pelican, or one whose card could not be drawn just now. Either way the
  // honest answer is a real image: a 404 here is a link that previews as
  // nothing, and the zoo's own card at least says which zoo.
  const zoo = await env?.ASSETS?.fetch(new URL('/og.png', request.url));
  if (zoo?.ok) return png(zoo.body, PLACEHOLDER);
  return new Response('no card', { status: 404 });
}
