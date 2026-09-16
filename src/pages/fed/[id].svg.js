// /fed/<id>.svg — the drawing exactly as it arrived.
//
// The specimen page links here as "the drawing as submitted". It used to link
// at a file in the repository, which was the honest answer while submissions
// were files; the row is the record now.
//
// Served with a locked-down CSP because this is model-generated markup being
// handed to a browser as a document rather than inlined into one of our pages.
// The sanitiser is regular expressions and has known gaps; `default-src 'none'`
// does not care, and neither does a browser rendering this inside an <img>.
import { findFed } from '../../lib/feed.js';

export async function GET({ params, locals }) {
  const s = await findFed(locals.runtime?.env, params.id);
  if (!s) return new Response('no such pelican', { status: 404 });
  return new Response(s.svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  });
}
