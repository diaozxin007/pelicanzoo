// /sitemap.xml
//
// There was never one, because the homepage linked every page and that was the
// sitemap. It stopped being true the moment a pelican could arrive between two
// builds: the page existed, nothing pointed at it, and no crawler had a reason
// to guess the URL. Generated per request for the same reason every other page
// is — a pelican fed a minute ago is in it.
import { loadZoo } from '../lib/zoo.js';
import { fedIds } from '../lib/feed.js';

const esc = (v) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET({ site, locals }) {
  const origin = (site || new URL('https://pelicanzoo.ai')).origin;
  const wild = loadZoo().all;
  const fed = await fedIds(locals.runtime?.env);

  const urls = [
    { loc: `${origin}/`, priority: '1.0' },
    ...wild.map((s) => ({ loc: `${origin}/p/${s.id}`, lastmod: s.observed, priority: '0.7' })),
    // Newer than the collection and the thing a feeder is about to share, so it
    // is worth a crawler's attention sooner.
    ...fed.map((r) => ({ loc: `${origin}/p/${r.id}`, lastmod: r.observed, priority: '0.8' })),
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url><loc>${esc(u.loc)}</loc>` +
          (u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : '') +
          `<priority>${u.priority}</priority></url>`,
      )
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=600',
    },
  });
}
