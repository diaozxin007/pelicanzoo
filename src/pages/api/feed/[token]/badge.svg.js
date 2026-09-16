// GET /api/feed/<token>/badge.svg — the papers, by receipt rather than by name.
//
// The feeder has this URL before they have any other one, so it is what the
// receipt page hangs its badge on. Same renderer as /badge/<id>.svg; the two
// produce identical bytes for the same row.
import { renderBadge } from '../../../../lib/badge.js';
import { json } from '../../../../lib/critic.js';

export async function GET({ params, locals }) {
  const env = locals.runtime?.env;
  const token = params.token;
  if (!/^[0-9a-f]{32}$/.test(token)) return json({ error: 'not a receipt' }, 404);
  const row = await env.DB.prepare('select * from feed where token = ?').bind(token).first();
  if (!row) return json({ error: 'no such receipt' }, 404);
  if (typeof row.score !== 'number') return json({ error: 'no papers without a number' }, 404);

  const svg = renderBadge({
    model: row.model,
    by: row.fed_by,
    svg: row.svg,
    score: row.score,
    review: row.review,
    critic: row.critic,
  });
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      // The number can arrive seconds after the page does, so this one must not
      // be held anywhere. /badge/<id>.svg is the cacheable address.
      'cache-control': 'no-store',
    },
  });
}
