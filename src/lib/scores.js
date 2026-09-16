import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SCORES_FILE = path.join(ROOT, 'data/scores.json');

let cache = null;

/** The zoo's own record of what the critic said, keyed by specimen id.
 *
 *  It lives in data/ rather than in the submission file's header because
 *  submissions/ belongs to whoever sent the pelican in — check-submissions.mjs
 *  fails a file that has been edited at all — and because a score written
 *  somewhere the submitter can type is a score the submitter can choose.
 *
 *  Written by scripts/score-submissions.mjs, never at build time. A missing
 *  file is normal: it means nothing has been assessed yet.
 */
export function loadScores() {
  if (cache) return cache;
  cache = fs.existsSync(SCORES_FILE) ? JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8')) : {};
  return cache;
}

/** Which way the number leans. Same three bands, and the same cut-offs, as the
 *  .score block on the specimen pages — the badge and the page have to agree. */
export function bandOf(score) {
  return score >= 60 ? 'high' : score >= 30 ? 'mid' : 'low';
}
