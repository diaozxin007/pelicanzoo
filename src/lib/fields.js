// How a submission's three free-text fields, its id, and its header comment are
// spelled. One file because four places now need to agree on it: the form in
// the browser, the worker that takes the POST, the sync script that writes the
// row back out as submissions/<id>.svg, and feed.js reading that file again.
//
// Nothing here imports anything — it has to run in a Worker.

/** A comment can't contain "--", so anything a person types has to be defanged
 *  before it goes near the header or it breaks the file it is describing. */
export const safeField = (v) =>
  String(v || '').replace(/[\r\n]+/g, ' ').replace(/-{2,}/g, '-').trim().slice(0, 200);

/** Dots survive, which is how claude-fable-5.1 keeps its version number. */
export const slugFor = (model) =>
  (safeField(model) || 'pelican').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');

/** The primary key, everywhere: the feed row, the scores key, the badge route,
 *  the specimen page. `date` is a UTC YYYY-MM-DD.
 *
 *  Two people sending the same model on the same day used to collide silently
 *  and be resolved by GitHub refusing the commit. The worker passes a `taken`
 *  predicate so the second one becomes <slug>-<date>-2 instead. */
export function idFor(model, date, taken = () => false) {
  const base = `${slugFor(model)}-${date}`;
  if (!taken(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken(candidate)) return candidate;
  }
  // 99 pelicans of one model in one day is not a collision, it is a script.
  return `${base}-${Date.now()}`;
}

/** The `<!-- pelicanzoo ... -->` block at the top of every submissions/*.svg.
 *  feed.js parses it back; keeping both spellings in one file is the point. */
export function headerFor({ model, by, date, note }) {
  return `<!-- pelicanzoo\nmodel: ${safeField(model)}\nby: ${safeField(by) || 'anonymous'}\ndate: ${date}\nnote: ${safeField(note)}\n-->\n`;
}

/** Today, in UTC, the way every date in the collection is written. */
export const utcDate = (d = new Date()) => d.toISOString().slice(0, 10);
