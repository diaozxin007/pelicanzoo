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
- **The feed pen** — paste the SVG a model gave you and it goes up on the wall.

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

## Papers

A merged submission goes in front of the zoo's critic once, by hand:

```sh
npm run score            # or: node scripts/score-submissions.mjs [--only <id>] [--force]
```

That calls the live `/api/roast` — same prompt, same model, same cache as the
button on the site, so the page and the badge cannot disagree — and files the
verdict in `data/scores.json`. The score is the zoo's, not the submitter's:
nothing in `submissions/` can set it, and there is no re-rolling it until it
comes out flattering. A review that arrives without a number is left unfiled
rather than rounded into one.

Anything on file gets `/badge/<id>.svg`, built by `src/pages/badge/[id].svg.js`
on every build rather than committed, so a re-scored pelican's badge updates
wherever it has already been pasted. The specimen page hands over the `<a>`-
wrapped snippet to put it on your own site — which is the trade: a badge for a
link back.

`CRITIC_VERSION` in `worker/index.js` rides along in the response and is stored
with each record. Bump it and `npm run score --force` re-assesses everything
against the new critic.

## Submitting a pelican

Use the feed box on the site: it sanitises your SVG, fills in the file, and
opens the pull request for you. Details, including the file format if you are
writing one by hand, are in [`submissions/README.md`](submissions/README.md).

## Running it

```sh
npm install
npm run dev              # http://localhost:4330
npm run data             # re-scrape Simon's blog and rebuild data/specimens.json
node scripts/check-submissions.mjs
```

`src/lib/sanitize-svg.js` is the one sanitiser, shared by the build, the
browser preview and CI. Model-generated SVG is untrusted markup everywhere.
