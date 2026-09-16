# Pelican Zoo

Every large language model, asked the same thing:

> Generate an SVG of a pelican riding a bicycle.

[pelicanzoo.ai](https://pelicanzoo.ai) puts all of them in one enclosure, and
asks whether you can tell them apart.

## What's in here

- **The enclosure** — 103 pelicans from 66 models, 2024 to 2026, each plaque
  linking back to the post it came from. 24 survive as vector originals, so
  they scale; four of those move.
- **Who drew this one?** — 73 rounds, 51 models. Decoys come from other vendors
  where possible, because three Gemini variants side by side is unguessable
  rather than hard.
- **The feed pen** — paste the SVG a model gave you and it is on the wall
  before you have finished reading this sentence, with the critic's number and
  a badge arriving a few seconds behind it.

## Whose is what

The benchmark, the pelicans and the keeper's notes are
[Simon Willison's](https://simonwillison.net/tags/pelican-riding-a-bicycle/).
Every specimen links to his original post and notes are quoted with
attribution. We built the enclosure; he raised the birds.

Raster specimens used to be hotlinked from his server, on the grounds of not
copying his work. That cost him more, not less: a hotlink bills his bandwidth
once per visitor per image, forever. They are now mirrored into
`public/specimen/` by `scripts/mirror-specimens.mjs`, which fetches each file
exactly once, and served from here — faster for readers, and one fetch total
for him. `asset` in `data/specimens.json` still records where each came from.

Models in the feed pen are self-reported — nobody can check who drew a pelican
— so fed pelicans are shown as such and kept out of the guessing game.

## How a pelican gets in

**The zoo is a database, and the server reads it when you ask for a page.**
There is no build between a stranger pressing the button and the pelican being
on the wall.

Feeding used to mean opening a pull request, which filters on git literacy
rather than on pelicans. Then it meant a row plus an export plus a deploy, which
just moved the barrier from the feeder to the keeper. Now the form POSTs to
`/api/feed`, which sanitises the SVG and writes a row to a D1 database called
`zoo` as `live`, and `/p/<id>` is a real URL by the time the response lands. The
critic runs behind that response — about thirteen seconds — so the feeder waits
on `/receipt?t=<token>` and watches the number arrive, with a real badge
rendered from it.

Everything is rendered per request: the homepage, `/p/<id>`, `/badge/<id>.svg`,
`/fed/<id>.svg`, `/sitemap.xml`. That is server-side, not client-side, because
the crawlers that matter for a shared link — X, WeChat, Slack, Discord — do not
run JavaScript, and a pelican nobody can preview is a pelican nobody shares.

The 103 archival pelicans are the exception: they were scraped out of Simon's
blog once and have not changed since, so they are compiled into the worker
bundle rather than queried. A query per page view would buy nothing, and it
would put the whole zoo behind D1's availability instead of just the feed pen.

The share card is rendered the same way, a few seconds behind. It is a PNG, and
rasterising 1200x630 costs more CPU than a Worker on the free plan gets — so the
drawing is done by Cloudflare's own headless Chrome, bound as `BROWSER`, which
runs on their hardware and costs this Worker nothing but the wait. The result is
filed in KV and served by `/og/<id>.png`, which draws a missing card on demand
and answers with the zoo's own in the moment before either. That URL is never
wrong to publish, which is what lets the page name it the instant the row exists.

```sh
npm run intake -- --recent   # look at what the open gate let in; n pulls one back
npm run backup               # copy the pen into submissions/ + data/scores.json
```

Neither is a publishing step, and neither is a step. `intake` takes effect on the
next request; `backup` is insurance. Nothing about feeding a pelican waits for
this machine any more.

`npm run og:specimens` still exists, but only for Simon's 103: those cards are
committed PNGs, because they have not changed since the day they were scraped
and a file is the cheapest way to serve one. The layout both renderers draw is
`src/lib/og-card.js`, shared so they cannot drift.

`AUTO_ADMIT` in `src/lib/intake.js` is the gate. Open — which is how it ships
today — a fed pelican goes into the book as `live` with nobody looking first,
because a queue of nothing is not worth a keeper's round trip. `npm run intake
-- --recent` shows what walked past and `n` there takes one off the site
immediately. Shut the gate the day the first thing arrives that should not have,
and submissions wait at `pending` until `npm run intake` says yes.

What makes publish-on-submit safe is not the keeper and not the sanitiser.
`src/lib/sanitize-svg.js` is regular expressions with three known gaps —
`<style>` is not stripped, unquoted attribute values slip the remote-reference
rule, HTML entities slip the `javascript:` rule. What holds those shut is that a
fed drawing is served through `<img src="/fed/<id>.svg">`, and an SVG inside an
`<img>` cannot run script or load anything external. That is a browser
guarantee, not a promise about a regex. Archival pelicans are still inlined —
they came from Simon's blog, not from strangers.

## Backups

`submissions/*.svg` and `data/scores.json` used to be what the site was built
from. Now they are a copy of the book, written by `npm run backup`, and nothing
reads them at runtime. D1's free plan has no point-in-time restore and the
drawings people sent in are the only part of this zoo that cannot be scraped
again, so there is a plain copy in git. `npm run backup -- --dry-run` says what
it would write. The script owns that directory: it writes every file in it and
deletes any whose row the book no longer shows.

## Papers

The score is the zoo's, not the submitter's. It is written into the row by the
worker, so nothing a feeder can type reaches it, and there is no re-rolling it
until it comes out flattering — the critic's answer is cached by pelican, so
asking twice gets the same verdict. A review that arrives without a number is
left unfiled rather than rounded into one.

A pelican is scored on its way in and needs nothing further. The one case that
does is a rewritten critic:

```sh
npm run score            # or: node scripts/score-pen.mjs [--only <id>] [--force]
```

That calls the live `/api/roast` by id — same prompt, same model, same cache
entry as the button on the site, so the page and the badge cannot disagree — and
writes the verdict back into the row. `CRITIC_VERSION` in `src/lib/critic.js`
rides along in the response and is stored with each record; bump it and `npm run
score` re-assesses everything the old critic judged, because the version is part
of the cache key too.

`/badge/<id>.svg` is rendered from the row on request, so a re-scored pelican's
badge updates wherever it has already been pasted, with nothing to rebuild. The
specimen page hands over the `<a>`-wrapped snippet to put it on your own site —
which is the trade: a badge for a link back.

## Submitting a pelican

Use the feed box on the site. Nothing to sign up for and nothing to install; the
page is live immediately and the number and badge follow a few seconds later.

## Running it

```sh
npm install
npm run dev              # http://localhost:4330
npm run data             # re-scrape Simon's blog and rebuild data/specimens.json
npm run deploy
```

`wrangler dev` talks to a *local* D1 by default, so the pen looks empty until you
feed it something; its proxy to remote Workers AI also hangs after a couple of
minutes, which means questions about the critic can only be settled in
production. Deploying is how you ship code — it is not how a pelican gets on the
wall.

Three generated files under `data/` are written by scripts and read by the
server, because a worker at the edge has no filesystem to ask: `mirrored.json`
(`npm run mirror`), `og-cards.json` (`npm run og:specimens`, archival cards only
— a fed pelican's card is looked up in KV, not in a manifest) and
`specimens.json` (`npm run data`).

`wrangler kv key list` reads a *local* namespace unless you pass `--remote`, the
same trap D1 sets. An empty list is the usual first symptom.

`src/lib/sanitize-svg.js` is the one sanitiser, shared by the API and the
browser preview. Model-generated SVG is untrusted markup everywhere.
