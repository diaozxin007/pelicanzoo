// The fence: what happens to a pelican between a stranger pressing the button
// and it being on the wall.
//
// Feeding used to mean opening a pull request, which is a filter on git literacy
// rather than on pelicans. It is a row now, and the row *is* the pelican — there
// is no file to wait for and no build between the two.
import { utcDate } from './fields.js';
import { MODEL, CRITIC_VERSION, roast } from './critic.js';

// The gate. With it open a fed pelican is on the site the moment it lands; with
// it shut it waits at `pending` until `npm run intake` says yes.
//
// Open for now because the queue is empty and a keeper reviewing nothing is a
// keeper nobody needs. What it costs is real, though, and worth naming: with the
// gate open, nothing human has looked at a drawing before a visitor can. The
// sanitiser is regular expressions with three known gaps, which is why a fed
// pelican is served through <img> — a browser will not run script inside one, no
// matter what the regular expressions missed.
//
// Shut it the day the first thing arrives that should not have.
// `npm run intake -- --reject <id>` pulls a row back at any point, immediately.
export const AUTO_ADMIT = true;

/** What a feeder is allowed to see of their own row. No ip_hash, and no token
 *  unless they are the one who was handed it. */
export const receipt = (row) => ({
  id: row.id,
  model: row.model,
  by: row.fed_by,
  note: row.note,
  status: row.status,
  score: row.score,
  review: row.review,
  critic: row.critic,
  observed: row.observed,
  // The critic has not filed anything yet — either it is still reading, or the
  // call failed and npm run score will have to ask again. Either way the page
  // should wait rather than announce a refusal.
  scoring: row.critic === null,
});

/** The critic, against a row that is already stored. Runs after the response
 *  has gone out, because a review takes about thirteen seconds against the live
 *  model and a submit button that hangs for thirteen seconds reads as a submit
 *  button that has broken. The receipt page polls for the number.
 *
 *  Errors are logged rather than raised: there is nobody left to raise them to,
 *  and the row survives without a score for npm run score to fill in later. */
export async function scoreRow(env, id, svg) {
  let verdict;
  try {
    verdict = await roast(env, svg);
  } catch (err) {
    console.error(`feed ${id}: critic failed — ${String(err).slice(0, 300)}`);
    return;
  }
  if (!verdict.text) {
    console.error(`feed ${id}: critic said nothing — ${JSON.stringify(verdict.shape).slice(0, 300)}`);
    return;
  }
  // `critic` is written even when the number is null, and it is what the receipt
  // page reads to tell "still thinking" from "read it, declined to put a number
  // on it". The score column keeps the rule it has always had: no number, no
  // badge.
  await env.DB.prepare(
    'update feed set score = ?, review = ?, critic = ?, critic_version = ?, assessed = ? where id = ?',
  )
    .bind(verdict.score, verdict.text, MODEL, CRITIC_VERSION, utcDate(), id)
    .run();
}
