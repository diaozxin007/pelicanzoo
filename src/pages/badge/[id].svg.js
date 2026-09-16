// /badge/<id>.svg — a fed pelican's papers.
//
// Drawn on the way out rather than stored, so a re-scored pelican's badge
// updates everywhere it has already been pasted without anyone touching a file.
// The renderer lives in src/lib/badge.js because the feeder is handed the same
// card on the receipt page the moment they submit, before this URL is the one
// they would use.
import { findFed } from '../../lib/feed.js';
import { renderBadge } from '../../lib/badge.js';

// Re-exported for anything that wants the card's dimensions without knowing
// where the renderer lives.
export { BADGE_W, BADGE_H } from '../../lib/badge.js';

export async function GET({ params, locals }) {
  const s = await findFed(locals.runtime?.env, params.id);
  // An unscored pelican has no papers, and a badge reading "—/100" would be
  // worse than not offering one.
  if (!s || typeof s.assessment?.score !== 'number') {
    return new Response('no papers for that one', { status: 404 });
  }
  const svg = renderBadge({
    model: s.model,
    by: s.by,
    svg: s.svg,
    score: s.assessment.score,
    review: s.assessment.review,
    critic: s.assessment.critic,
  });
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      // Pasted on other people's sites, so it wants to be cached — but a
      // re-score has to reach those pages, hence minutes rather than forever.
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  });
}
