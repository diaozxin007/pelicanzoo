// The permanent collection. Unlike the feed pen this is not in a database and
// should not be: these 103 pelicans were scraped out of Simon's blog once and
// have not changed since, so a query per page view would buy nothing and would
// put the whole zoo behind D1's availability instead of just the feed pen.
//
// So the data is compiled into the bundle. Every page is still rendered when it
// is asked for — it just reads its specimens out of the worker's own memory.
import { sanitizeSvg } from './sanitize-svg.js';
import { vendorOf } from './vendor.js';
import specimens from '../../data/specimens.json';
import mirrored from '../../data/mirrored.json';

// Vite inlines these at build time, so the 24 surviving vectors travel with the
// code. They have to be inlined into the page rather than linked, or they
// cannot be styled, scaled or handed to the critic.
const liveFiles = import.meta.glob('../../public/live/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const live = Object.fromEntries(
  Object.entries(liveFiles).map(([file, text]) => [
    file.split('/').pop().replace(/\.svg$/, ''),
    text,
  ]),
);

// Written by scripts/mirror-specimens.mjs. The old code asked the filesystem
// whether each picture had been mirrored yet, which a server at the edge cannot
// do — and the answer belongs in the data anyway.
const onDisk = new Set(mirrored);

let cache = null;

export function loadZoo() {
  if (cache) return cache;

  const enriched = specimens
    .filter((s) => s.model)
    .map((s) => ({
      ...s,
      svg: s.alive && live[s.id] ? sanitizeSvg(live[s.id]).svg : null,
      // Served from our own host if it has been mirrored, which is all of
      // them; `asset` stays as the record of where it was taken from, and
      // stays as the fallback for anything added but not yet mirrored.
      picture: pictureFor(s),
      // Every note is worth showing: even his flat descriptions are funny,
      // because he keeps calling the pelicans ducks.
      verdict: s.keeper_note && s.keeper_note.length > 15 ? s.keeper_note : null,
      year: s.observed.slice(0, 4),
      vendor: vendorOf(s.model),
      origin: 'wild',
    }));

  cache = {
    all: enriched,
    live: enriched.filter((s) => s.svg),
    models: [...new Set(enriched.map((s) => s.model))].sort(),
  };
  return cache;
}

/** Local mirror if scripts/mirror-specimens.mjs has taken this one, else the
 *  original. Checked per file rather than assumed, so a specimen added to the
 *  data before the mirror runs still shows a picture instead of nothing. */
function pictureFor(s) {
  if (s.alive || !s.asset) return null;
  const ext = (s.asset.match(/\.(png|jpe?g|gif|webp|svg)(?:\?|$)/i)?.[1] || 'png').toLowerCase();
  const file = `${s.id}.${ext}`;
  return onDisk.has(file) ? `/specimen/${file}` : s.asset;
}
