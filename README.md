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
Every specimen links to his original post, notes are quoted with attribution,
and raster images are served from his host rather than copied here. We built
the enclosure; he raised the birds.

Models in the feed pen are self-reported — nobody can check who drew a pelican
— so fed pelicans are shown as such and kept out of the guessing game.

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
