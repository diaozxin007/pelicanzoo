// The feed pen, read out of D1.
//
// This used to scan `submissions/*.svg` off disk, which meant a pelican somebody
// fed was not on the site until a build ran on the keeper's laptop. The row is
// the pelican now; there is no file to wait for and no export step in between.
//
// Imports nothing that a Vite build has to resolve, so scripts/lib/pen.js can
// pull COLUMNS and shape() straight into node and read the same pen over the D1
// REST API. One definition of what a fed pelican is, two ways in.
import { vendorOf } from './vendor.js';

// What a page needs. `svg` is deliberately in the list — a specimen page inlines
// the drawing, and a second round trip to fetch it would show the plaque with a
// hole where the pelican goes.
export const COLUMNS = `id, model, fed_by, note, svg, observed, score, review, critic, critic_version, assessed`;

/** One D1 row, in the shape the pages already expect from loadZoo(). The names
 *  differ because `by` is a SQLite keyword and `note` is the feeder's opinion
 *  rather than the zoo's — `verdict` is what they said, `assessment` is what the
 *  critic said. Two opinions of the same bird, and only one of them is ours. */
export function shape(row) {
  return {
    id: row.id,
    model: row.model,
    vendor: vendorOf(row.model),
    svg: row.svg,
    by: row.fed_by || null,
    verdict: row.note || null,
    observed: row.observed || '',
    year: (row.observed || '').slice(0, 4),
    origin: 'feed',
    assessment:
      typeof row.score === 'number'
        ? {
            score: row.score,
            review: row.review,
            critic: row.critic,
            criticVersion: row.critic_version ?? null,
            assessed: row.assessed,
          }
        : null,
  };
}

/** Everything in the pen, newest first. The homepage shows the lot; there are
 *  two of them today and a cap can be argued for when that stops being true. */
export async function loadFeed(env) {
  if (!env?.DB) return [];
  const { results } = await env.DB.prepare(
    `select ${COLUMNS} from feed where status = 'live' order by created_at desc, id`,
  ).all();
  return (results || []).map(shape);
}

/** One pelican by its id, or null. Used by the specimen page, which is the URL
 *  a feeder gets handed the moment they submit. */
export async function findFed(env, id) {
  if (!env?.DB) return null;
  const row = await env.DB.prepare(
    `select ${COLUMNS} from feed where id = ? and status = 'live'`,
  )
    .bind(id)
    .first();
  return row ? shape(row) : null;
}

/** Just the ids, for the sitemap. Cheap enough to ask for on its own rather
 *  than dragging every SVG across to count them. */
export async function fedIds(env) {
  if (!env?.DB) return [];
  const { results } = await env.DB.prepare(
    `select id, observed from feed where status = 'live' order by created_at desc`,
  ).all();
  return results || [];
}
