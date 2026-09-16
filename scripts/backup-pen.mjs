// Copies the feed pen out of D1 and into the repository, as files.
//
// This used to be the publishing step, under the name `sync`: the site was built
// from submissions/*.svg and data/scores.json, so nothing anyone fed was on the
// wall until this had run and the keeper had deployed. The pages read the
// database now. Feeding a pelican publishes it; running this publishes nothing.
//
// What it is for is the other direction. D1's free plan has no point-in-time
// restore, one bad `delete` takes the pen with it, and the drawings people sent
// in are the only part of this zoo that cannot be scraped again. So: a plain
// copy, in git, readable without a database.
//
//   node scripts/backup-pen.mjs              copy the live rows into the repo
//   node scripts/backup-pen.mjs --dry-run    say what it would write, write nothing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { d1 } from './lib/cf.js';
import { headerFor } from '../src/lib/fields.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'submissions');
const SCORES_FILE = path.join(ROOT, 'data/scores.json');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

const rows = await d1(
  `select id, model, fed_by, note, svg, observed, score, review, critic, critic_version, assessed
     from feed where status = 'live' order by id`,
);

const scores = {};
let written = 0;
let unchanged = 0;
let unscored = 0;

for (const row of rows) {
  const file = path.join(DIR, `${row.id}.svg`);
  const text = `${headerFor({
    model: row.model,
    by: row.fed_by,
    date: row.observed,
    note: row.note,
  })}${row.svg}\n`;

  // Compared rather than blindly written: a run that changes nothing should
  // leave no mtimes moved and no diff to read.
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (before === text) {
    unchanged++;
  } else {
    if (!dryRun) fs.writeFileSync(file, text);
    console.log(`  ${before === null ? '+' : '~'} submissions/${row.id}.svg`);
    written++;
  }

  if (typeof row.score !== 'number') {
    unscored++;
    continue;
  }
  // Straight from the book, no merging. score-pen.mjs writes into the row now,
  // so there is exactly one place a score can come from and this file is a
  // photograph of it rather than a second opinion about it.
  scores[row.id] = {
    score: row.score,
    review: row.review,
    critic: row.critic,
    criticVersion: row.critic_version ?? null,
    assessed: row.assessed,
  };
}

// Anything in here the book no longer shows — turned away at the gate, pulled
// back afterwards, deleted outright — goes. It is off the site already; leaving
// the file would make the backup say something the zoo does not. This directory
// belongs to this script now: when it was where submissions arrived by pull
// request, a file D1 had never heard of was left alone, and there is no longer
// any way for one to get here except by having been in the book.
let withdrawn = 0;
const keep = new Set(rows.map((r) => `${r.id}.svg`));
for (const file of fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.svg')) : []) {
  if (keep.has(file)) continue;
  if (!dryRun) fs.unlinkSync(path.join(DIR, file));
  console.log(`  - submissions/${file} (no longer in the book)`);
  withdrawn++;
}

// Sorted, two spaces, trailing newline, so an unchanged pen produces a
// byte-identical file and the diff shows only what actually moved.
const sorted = Object.fromEntries(Object.keys(scores).sort().map((k) => [k, scores[k]]));
if (!dryRun) fs.writeFileSync(SCORES_FILE, `${JSON.stringify(sorted, null, 2)}\n`);

console.log(
  `${rows.length} live row(s): ${written} file(s) written, ${unchanged} unchanged, ` +
    `${unscored} without a number` +
    (withdrawn ? `, ${withdrawn} withdrawn` : '') + '. ' +
    `${Object.keys(sorted).length} score(s) in data/scores.json.` +
    (dryRun ? ' (dry run, nothing written)' : ''),
);
