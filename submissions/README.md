# Submissions

**Nothing in here is the zoo's record of anything, and putting a file in here
does not put a pelican on the site.**

To feed one, paste the SVG into the feed box on
[pelicanzoo.ai](https://pelicanzoo.ai) and press *Hand it over the fence*. The
page you land on is live immediately, with a number and a badge on it. There is
no file, no pull request and no build in between — the row in the database *is*
the pelican, and every page is rendered from it when someone asks for it.

What this directory is: a backup, written by `npm run backup`, of the drawings
people have sent in. D1's free plan has no point-in-time restore and these SVGs
are the only part of the zoo that cannot be scraped again, so there is a plain
copy of them in git. The script owns the directory — it writes every file here
and deletes any that the database no longer shows.

The shape of one, if you are reading them: a metadata comment, then the SVG the
model produced, unedited.

```xml
<!-- pelicanzoo
model: claude-opus-4.5
by: @yourhandle
date: 2026-09-16
note: one line on how it went
-->
<svg viewBox="0 0 400 300">...</svg>
```

`model` is taken on trust — nobody can verify who drew a pelican — so every fed
pelican is shown labelled self-reported and kept out of the guessing game. That
game only asks about pelicans traced back to a post of Simon's.

The score is not in here. It lives in the row, next to the drawing, because a
score written somewhere the submitter can type is a score the submitter can
choose. `data/scores.json` is the same kind of backup as these files.
