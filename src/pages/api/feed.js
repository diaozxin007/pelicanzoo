// POST /api/feed — a stranger hands a pelican over the fence.
//
// Stores it and, behind the response, asks the critic. The score is the reason
// anyone fills the form in; making them wait for a human to see a number would
// be making them wait for nothing, since the critic is a machine and /api/roast
// has been public this whole time.
import { sanitizeSvg } from '../../lib/sanitize-svg.js';
import { safeField, slugFor, idFor, utcDate } from '../../lib/fields.js';
import { SIZE_LIMIT } from '../../lib/config.js';
import { json, sha } from '../../lib/critic.js';
import { AUTO_ADMIT, receipt, scoreRow } from '../../lib/intake.js';
import { renderCard } from '../../lib/card-render.js';

// A submission carries an SVG plus three short fields, and JSON escaping
// inflates the markup on the way. The SVG itself is still held to SIZE_LIMIT,
// which is the number the form checks against.
const MAX_FEED_BODY = 280_000;

// Per address, per day, on top of the per-minute rate limiter. The limiter stops
// a script; this stops an afternoon.
const FEED_DAILY_CAP = 20;

export async function GET() {
  return json({ error: 'post a pelican' }, 405);
}

export async function POST({ request, locals }) {
  const env = locals.runtime?.env;
  const ctx = locals.runtime?.ctx;

  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_FEED_BODY) return json({ error: 'that is not a pelican, that is a mural' }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'unreadable' }, 400);
  }

  const model = safeField(body.model);
  if (!model) return json({ error: 'name the model that drew it' }, 400);

  // The same sanitiser the form ran in the browser. Running it again here is the
  // point: what the browser did is a courtesy to the person pasting, not a
  // guarantee about what arrives.
  const clean = sanitizeSvg(body.svg);
  if (!clean.ok) return json({ error: `can't read that as an SVG — ${clean.error}` }, 400);
  if (clean.svg.length > SIZE_LIMIT) {
    return json({ error: `that is ${Math.round(clean.svg.length / 1024)}KB. the cap is ${Math.round(SIZE_LIMIT / 1024)}KB.` }, 413);
  }
  // A drawing that still has a script in it after the form cleaned one out was
  // edited by hand.
  if (clean.removed.length) {
    return json({ error: `contains ${clean.removed.join(', ')} — send the model's output unedited` }, 400);
  }

  const fingerprint = await sha(clean.svg);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const ipHash = await sha(ip);

  // Same bytes, same row, same verdict — the rule the roast cache already runs
  // on. Resubmitting is free and changes nothing.
  const twin = await env.DB.prepare('select * from feed where fingerprint = ?').bind(fingerprint).first();
  if (twin) {
    // The token is the key to a row, so it only goes back to the address that
    // was given it. Someone else pasting the identical drawing gets told it is
    // already in the book, which is true, and nothing about who sent it.
    const mine = twin.ip_hash === ipHash;
    return json({ ...receipt(twin), token: mine ? twin.token : null, duplicate: true });
  }

  const { success } = await env.FEED_LIMIT.limit({ key: ip });
  if (!success) return json({ error: 'the keeper is still carrying the last one. try in a minute.' }, 429);

  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const seen = await env.DB.prepare('select count(*) as n from feed where ip_hash = ? and created_at > ?')
    .bind(ipHash, dayAgo)
    .first();
  if ((seen?.n || 0) >= FEED_DAILY_CAP) {
    return json({ error: 'that is enough pelicans for one day. come back tomorrow.' }, 429);
  }

  // Two people sending the same model on the same day used to produce the same
  // filename and be resolved by GitHub refusing the second commit.
  const date = utcDate();
  const base = `${slugFor(model)}-${date}`;
  const clash = await env.DB.prepare("select id from feed where id = ?1 or id like ?1 || '-%'").bind(base).all();
  const used = new Set((clash.results || []).map((r) => r.id));
  const id = idFor(model, date, (candidate) => used.has(candidate));

  const token = crypto.randomUUID().replace(/-/g, '');
  const status = AUTO_ADMIT ? 'live' : 'pending';
  await env.DB.prepare(
    `insert into feed (id, model, fed_by, note, svg, fingerprint, observed, status, token, ip_hash, created_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, model, safeField(body.by) || null, safeField(body.note) || null, clean.svg, fingerprint, date, status, token, ipHash, new Date().toISOString())
    .run();

  // The pelican is safe before the critic is asked, so an outage costs the
  // feeder their number, not their drawing.
  ctx.waitUntil(scoreRow(env, id, clean.svg));

  // The share card, drawn beside the score rather than after it: the card
  // carries the model, the date and who fed it, and none of those are the
  // critic's to say, so there is nothing to wait for.
  //
  // Only for a pelican that is actually on the wall. Behind a shut gate this
  // would spend the day's browser minutes drawing cards for pages that do not
  // exist yet — and /og/<id>.png draws a missing one on demand, so a submission
  // let through later still gets one.
  if (status === 'live') {
    ctx.waitUntil(
      renderCard(env, {
        id,
        model,
        svg: clean.svg,
        observed: date,
        by: safeField(body.by) || null,
        origin: 'feed',
      }),
    );
  }

  return json({
    id,
    token,
    status,
    model,
    by: safeField(body.by) || null,
    score: null,
    review: null,
    critic: null,
    // Tells the receipt page there is a number on the way and it should wait for
    // it, rather than that the critic refused to give one.
    scoring: true,
  });
}
