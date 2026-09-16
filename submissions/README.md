# Submissions

One pelican per file. The site writes these for you — paste your SVG into the
feed box on [pelicanzoo.ai](https://pelicanzoo.ai) and press *Submit to the
collection*, and it opens a pull request with the file already filled in.

If you are writing one by hand, the shape is a metadata comment followed by the
SVG the model produced, unedited:

```xml
<!-- pelicanzoo
model: claude-opus-4.5
by: @yourhandle
date: 2026-09-16
note: one line on how it went
-->
<svg viewBox="0 0 400 300">...</svg>
```

`model` is the only required field. It is taken on trust — nobody can verify who
drew a pelican — so everything in here is shown in the feed pen, labelled
self-reported, and kept out of the guessing game. The game only asks about
pelicans traced back to a post of Simon's.

CI rejects anything with a script, an event handler, or a remote reference in
it. The site strips those before it builds the pull request, so if you hit that
check, the file was hand-edited.
