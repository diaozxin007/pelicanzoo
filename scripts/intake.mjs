// The keeper's desk. One `update` here and the site says something different on
// the next request — the pages read D1, so `status` is not a note about what
// should be published, it is what is published.
//
// With AUTO_ADMIT on this is a desk nobody has to sit at: --recent is the round,
// and n is how a pelican comes back off the wall. The sanitiser is still regular
// expressions with three known gaps (`<style>` is not stripped, unquoted
// attributes slip the remote-reference rule, entity encoding slips the
// javascript: rule), and what holds them shut is not this desk — it is that a
// fed drawing is served through <img src="/fed/<id>.svg">, where the browser
// forbids script and external loads outright.
//
// The pictures go in a contact sheet the browser opens; the decisions are made
// in the terminal, because that is where the y is one keystroke.
//
//   node scripts/intake.mjs                 review everything pending
//   node scripts/intake.mjs --recent        look at what the open gate let in
//   node scripts/intake.mjs --list          just print the queue
//   node scripts/intake.mjs --accept <id>   decide without the sheet
//   node scripts/intake.mjs --reject <id>
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { d1 } from './lib/cf.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = path.join(ROOT, 'scripts/tmp/intake.html');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1];
};

const esc = (v) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function decide(id, status) {
  const rows = await d1('update feed set status = ? where id = ? returning id, model, status', [status, id]);
  if (!rows.length) {
    console.error(`  ! ${id}: no such row`);
    return false;
  }
  console.log(`  ${status === 'live' ? '✓' : '✗'} ${id} → ${status}`);
  return true;
}

const COLUMNS = `id, model, fed_by, note, svg, observed, status, score, review, critic, created_at`;

async function pending() {
  return d1(`select ${COLUMNS} from feed where status = 'pending' order by created_at`);
}

/** What the open gate admitted without asking. `ip_hash is not null` is what
 *  separates a pelican somebody fed through the form from one imported out of a
 *  file, which is the only kind worth a second look. */
async function recent(limit = 20) {
  return d1(
    `select ${COLUMNS} from feed
      where ip_hash is not null and status <> 'rejected'
      order by created_at desc limit ${Number(limit) || 20}`,
  );
}

/** Whether the fence is currently letting pelicans straight through. Read from
 *  the source rather than asked of the edge, because the deployed answer is
 *  whatever was last shipped from here anyway. */
function gateOpen() {
  const src = fs.readFileSync(path.join(ROOT, 'src/lib/intake.js'), 'utf8');
  return /^export const AUTO_ADMIT = true;/m.test(src);
}

/** One page, one card per pelican, in the order the terminal will ask about
 *  them. The number is the one the feeder already saw on their receipt — this
 *  is a check on whether the thing is a pelican, not a second opinion on it. */
function sheet(rows, heading) {
  const cards = rows
    .map(
      (r, i) => `
  <article>
    <h2><span class="n">${i + 1}</span> ${esc(r.model)}</h2>
    <div class="stage">${r.svg}</div>
    <dl>
      <dt>id</dt><dd><code>${esc(r.id)}</code></dd>
      <dt>fed by</dt><dd>${esc(r.fed_by || 'anonymous')}</dd>
      <dt>observed</dt><dd>${esc(r.observed)}</dd>
      <dt>status</dt><dd>${esc(r.status)}</dd>
      ${r.note ? `<dt>they said</dt><dd>${esc(r.note)}</dd>` : ''}
      <dt>score</dt><dd>${typeof r.score === 'number' ? `${r.score}/100` : '<em>no number</em>'}</dd>
    </dl>
    ${r.review ? `<blockquote>${esc(r.review)}<cite>${esc(r.critic || 'the critic')}</cite></blockquote>` : ''}
  </article>`,
    )
    .join('\n');

  return `<!doctype html>
<meta charset="utf-8">
<title>Intake — ${heading}</title>
<style>
  body { margin: 0; padding: 2rem 1.5rem 4rem; background: #f4efe2; color: #22201b;
         font: 15px/1.6 -apple-system, system-ui, sans-serif; }
  h1 { font: 700 1.6rem/1.2 Georgia, serif; margin: 0 0 1.5rem; }
  .grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr)); }
  article { background: #fdfaf0; border: 1px solid #d9d2c0; border-radius: 4px; padding: 1rem; }
  h2 { font: 700 1rem/1.3 Georgia, serif; margin: 0 0 .7rem; }
  .n { display: inline-block; min-width: 1.6em; padding: 0 .35em; margin-right: .4em; text-align: center;
       background: #1e3a2b; color: #fdfaf0; border-radius: 3px; font: 600 .8rem/1.7 ui-monospace, monospace; }
  .stage { aspect-ratio: 4/3; background: #fff; border: 1px solid #d9d2c0; border-radius: 3px;
           display: grid; place-items: center; overflow: hidden; }
  .stage svg { max-width: 100%; max-height: 100%; display: block; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: .1rem .7rem; margin: .8rem 0 0; font-size: .82rem; }
  dt { color: #6f6a5c; } dd { margin: 0; word-break: break-word; }
  code { font: .78rem ui-monospace, monospace; }
  blockquote { margin: .8rem 0 0; padding: .6rem .7rem; background: #f4efe2; border-left: 3px solid #1e3a2b;
               font-size: .82rem; font-style: italic; }
  cite { display: block; margin-top: .4rem; font: .72rem ui-monospace, monospace; color: #6f6a5c; font-style: normal; }
</style>
<h1>${heading}</h1>
<div class="grid">${cards}
</div>
`;
}

const accept = flag('accept');
const reject = flag('reject');
if (accept || reject) {
  if (accept) await decide(accept, 'live');
  if (reject) await decide(reject, 'rejected');
  process.exit(0);
}

const open = gateOpen();
const looking = args.includes('--recent');
const rows = looking ? await recent() : await pending();
const noun = looking ? 'fed' : 'pending';

if (!rows.length) {
  console.log(
    looking
      ? 'Nobody has fed a pelican yet.'
      : open
        ? 'Nothing at the gate — AUTO_ADMIT is on in src/lib/intake.js, so fed pelicans go\n' +
          'straight in. `npm run intake -- --recent` shows what walked past.'
        : 'Nothing at the gate.',
  );
  process.exit(0);
}

if (args.includes('--list')) {
  for (const r of rows) {
    const n = typeof r.score === 'number' ? `${r.score}/100` : '  --  ';
    console.log(`  ${n}  ${r.id}  ${r.fed_by || 'anonymous'}  ${r.status}`);
  }
  console.log(`${rows.length} ${noun}.`);
  process.exit(0);
}

const heading = looking
  ? `${rows.length} pelican${rows.length === 1 ? '' : 's'} the gate let in`
  : `${rows.length} pelican${rows.length === 1 ? '' : 's'} at the gate`;

fs.mkdirSync(path.dirname(SHEET), { recursive: true });
fs.writeFileSync(SHEET, sheet(rows, heading));
execFile('open', [SHEET], () => {});
console.log(`${rows.length} ${noun} — contact sheet at ${SHEET.replace(`${ROOT}/`, '')}\n`);
if (looking) {
  // These are already live, so y is a no-op and the useful key is n. Saying so
  // beats letting the habit of pressing y through a queue do the reading.
  console.log('These are already in. n pulls one back out — off the site immediately —\n' +
              'and anything else leaves it.\n');
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let live = 0;
let rejected = 0;
let skipped = 0;

for (const [i, r] of rows.entries()) {
  const n = typeof r.score === 'number' ? `${r.score}/100` : 'unscored';
  const answer = (await rl.question(`${i + 1}/${rows.length}  ${r.id}  (${n})  [y/n/s] `)).trim().toLowerCase();
  if (answer === 'y') {
    await decide(r.id, 'live');
    live++;
  } else if (answer === 'n') {
    await decide(r.id, 'rejected');
    rejected++;
  } else {
    // Anything else leaves the row where it was, which is the safe direction for
    // a queue: nothing moves on a mistyped key, and this run can be repeated.
    console.log(`  · ${r.id} left ${r.status}`);
    skipped++;
  }
}
rl.close();

console.log(
  `\n${rows.length} reviewed: ${live} let in, ${rejected} turned away, ${skipped} untouched.` +
    // No deploy, no build, no export. The next request to the site already
    // reflects this, which is the whole point of the pen being a table.
    (live || rejected ? ' That is live on the site now.' : ''),
);
