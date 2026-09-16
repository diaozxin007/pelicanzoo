// Mirrors the picture-only specimens into public/specimen/, one file per
// specimen, committed alongside the cards.
//
// The zoo used to hotlink these 79 rasters from Simon's server, on the stated
// grounds of not spending his bandwidth. That reasoning was backwards: a
// hotlink bills him once per visitor per image forever, while a mirror bills
// him once, here, at the moment you run this. It is also three times slower off
// his host than off ours, which on a phone is the difference between a picture
// and a broken one.
//
// Provenance does not move: every specimen still links back to the post it came
// from, and `asset` in data/specimens.json still records where it was taken.
//
//   node scripts/mirror-specimens.mjs [--only <id>] [--force]
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = 'public/specimen';
// Where the card renderer used to keep its own copy. Anything already sitting
// there was fetched from the same URL, so it seeds the mirror for free.
const LEGACY_CACHE = '.ogcache';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const force = args.includes('--force');

const specimens = JSON.parse(fs.readFileSync('data/specimens.json', 'utf8'))
  .filter((s) => s.model && !s.alive)
  .filter((s) => !only || s.id === only);

fs.mkdirSync(OUT_DIR, { recursive: true });

export const extOf = (asset) =>
  (asset.match(/\.(png|jpe?g|gif|webp|svg)(?:\?|$)/i)?.[1] || 'png').toLowerCase();

/** Path the site should serve this specimen from, whether or not it exists yet. */
export const mirrorPath = (s) => `${OUT_DIR}/${s.id}.${extOf(s.asset)}`;

let fetched = 0;
let seeded = 0;
let kept = 0;

for (const s of specimens) {
  const dest = mirrorPath(s);
  if (!force && fs.existsSync(dest)) {
    kept++;
    continue;
  }

  const seed = path.join(LEGACY_CACHE, path.basename(dest));
  if (!force && fs.existsSync(seed)) {
    fs.copyFileSync(seed, dest);
    seeded++;
    continue;
  }

  const r = await fetch(s.asset);
  if (!r.ok) {
    console.error(`  ${r.status} fetching ${s.asset} — skipped`);
    continue;
  }
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  fetched++;
  console.log(`  fetched ${dest}`);
  // His server, his pace.
  await new Promise((r) => setTimeout(r, 300));
}

const bytes = fs.readdirSync(OUT_DIR).reduce((n, f) => n + fs.statSync(path.join(OUT_DIR, f)).size, 0);
console.log(
  `${specimens.length} specimens: ${kept} already mirrored, ${seeded} seeded from ${LEGACY_CACHE}, ` +
    `${fetched} fetched. ${OUT_DIR} is now ${(bytes / 1e6).toFixed(1)} MB.`
);
